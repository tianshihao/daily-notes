import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import { NotebookStatusBar } from "../src/widget/notebook_status_bar";

class RecordingItem implements vscode.StatusBarItem {
  text = "";
  name: string | undefined;
  tooltip = undefined;
  color = undefined;
  backgroundColor = undefined;
  command = undefined;
  accessibilityInformation = undefined;
  visible = false;
  disposed = false;

  constructor(readonly id: string, readonly alignment: vscode.StatusBarAlignment, readonly priority: number) {}

  show(): void { this.visible = true; }
  hide(): void { this.visible = false; }
  dispose(): void { this.disposed = true; }
}

suite("Notebook status bar", () => {
  const options = {
    notebookName: "", showDocumentStats: true, showGitStatus: true,
    enableGit: true, autoCommit: true, autoSync: false,
  };
  let document: vscode.TextDocument;
  let items: RecordingItem[];
  let statusBar: NotebookStatusBar;

  function createBar(analyzer?: ConstructorParameters<typeof NotebookStatusBar>[1]): NotebookStatusBar {
    return new NotebookStatusBar((id, alignment, priority) => {
      const item = new RecordingItem(id, alignment, priority);
      items.push(item);
      return item;
    }, analyzer);
  }

  suiteSetup(async () => {
    document = await vscode.workspace.openTextDocument({ language: "markdown", content: "今天讨论计划" });
  });

  setup(() => {
    items = [];
  });

  test("keeps statistics and Git adjacent in one named status bar item", () => {
    statusBar = createBar();
    statusBar.render(document, options);
    assert.equal(items.length, 1);
    const [item] = items;
    assert.equal(item.id, "dailyNotes.notebookStatus");
    assert.equal(item.name, "Daily Notes: Notebook Status");
    assert.equal(item.alignment, vscode.StatusBarAlignment.Left);
    assert.equal(item.priority, 0);
    assert.equal(item.text, "Words: 6 · Language: zh  |  Git: On · Auto Commit: On · Auto Sync: Off");
    assert.equal(item.visible, true);

    statusBar.render(document, { ...options, enableGit: false, autoSync: true });
    assert.equal(item.text, "Words: 6 · Language: zh  |  Git: Off");
    assert.equal(item.visible, true);
    statusBar.dispose();
    assert.equal(item.disposed, true);
  });

  test("prefixes the visible groups with the notebook name and hides the item outside the notebook", () => {
    statusBar = createBar();
    const named = { ...options, notebookName: "日记" };
    statusBar.render(document, named);
    const [item] = items;
    assert.equal(item.visible, true);
    assert.equal(item.text, "日记  |  Words: 6 · Language: zh  |  Git: On · Auto Commit: On · Auto Sync: Off");

    statusBar.render(document, { ...named, showDocumentStats: false });
    assert.equal(item.visible, true);
    assert.equal(item.text, "日记  |  Git: On · Auto Commit: On · Auto Sync: Off");

    statusBar.render(document, { ...named, showGitStatus: false });
    assert.equal(item.visible, true);
    assert.equal(item.text, "日记  |  Words: 6 · Language: zh");

    statusBar.render(document, { ...named, showDocumentStats: false, showGitStatus: false });
    assert.equal(item.visible, false);

    statusBar.render(document, named);
    statusBar.render(undefined, named);
    assert.equal(item.visible, false);

    statusBar.render(document, { ...named, notebookName: "My $(book)", showGitStatus: false });
    assert.equal(item.text, "My \\$(book)  |  Words: 6 · Language: zh");

    statusBar.render(document, { ...named, notebookName: " \t " });
    assert.equal(item.visible, true);
    assert.equal(item.text, "Words: 6 · Language: zh  |  Git: On · Auto Commit: On · Auto Sync: Off");
    assert.equal(items.length, 1);
    statusBar.dispose();
  });

  test("cancels hidden and superseded analyses and keeps the latest Git display", async () => {
    const other = await vscode.workspace.openTextDocument({ content: "A different note" });
    const jobs: { signal: AbortSignal; finish: () => void }[] = [];
    const completed: vscode.TextDocument[] = [];
    statusBar = createBar({
      prepare(_document, signal) {
        return new Promise<void>(finish => jobs.push({ signal, finish }));
      },
      analyze(document) {
        completed.push(document);
        return { wordCount: 3, language: "en" };
      },
      recordChanges() {},
    });
    const [item] = items;
    const hidden = { ...options, showDocumentStats: false };
    statusBar.render(document, hidden);
    assert.equal(jobs.length, 0);
    assert.deepEqual(completed, []);

    statusBar.render(document, options);
    assert.match(item.text, /^Words: … · Language: …/);
    statusBar.render(document, hidden);
    assert.ok(jobs[0].signal.aborted);
    jobs[0].finish();
    await Promise.resolve();
    assert.deepEqual(completed, []);
    assert.match(item.text, /^Git: On/);

    statusBar.render(document, options);
    statusBar.render(other, options);
    assert.ok(jobs[1].signal.aborted);
    statusBar.render(other, { ...options, notebookName: "Journal", enableGit: false });
    assert.equal(jobs.length, 3);
    assert.equal(item.text, "Journal  |  Words: … · Language: …  |  Git: Off");
    jobs[1].finish();
    jobs[2].finish();
    await Promise.resolve();
    assert.deepEqual(completed, [other]);
    assert.equal(item.text, "Journal  |  Words: 3 · Language: en  |  Git: Off");

    statusBar.render(document, options);
    statusBar.render(undefined, { ...options, notebookName: "Journal" });
    assert.ok(jobs[3].signal.aborted);
    jobs[3].finish();
    await Promise.resolve();
    assert.equal(item.visible, false);
    assert.deepEqual(completed, [other]);

    statusBar.render(document, options);
    statusBar.dispose();
    assert.ok(jobs[4].signal.aborted);
    jobs[4].finish();
    await Promise.resolve();
    assert.deepEqual(completed, [other]);
  });

  test("reflects edits made while document statistics were hidden", async () => {
    const note = await vscode.workspace.openTextDocument({ content: "One two" });
    statusBar = createBar();
    statusBar.render(note, options);
    assert.match(items[0].text, /^Words: 2 /);
    statusBar.render(note, { ...options, showDocumentStats: false });
    const edit = new vscode.WorkspaceEdit();
    edit.insert(note.uri, note.lineAt(0).range.end, " 今天");
    assert.ok(await vscode.workspace.applyEdit(edit));
    statusBar.render(note, options);
    assert.match(items[0].text, /^Words: 4 /);
    statusBar.dispose();
  });

  test("debounces edits and cancels pending refreshes when leaving the notebook", async () => {
    const note = await vscode.workspace.openTextDocument({ content: "One" });
    let finishFirst!: () => void;
    let onAnalyze!: (version: number) => void;
    const updated = new Promise<number>(resolve => { onAnalyze = resolve; });
    const firstVersion = note.version;
    let preparedVersion = firstVersion;
    statusBar = createBar({
      prepare(document) {
        preparedVersion = document.version;
        if (document.version === firstVersion) {
          return new Promise<void>(resolve => { finishFirst = resolve; });
        }
      },
      analyze() {
        onAnalyze(preparedVersion);
        return { wordCount: 2, language: "en" };
      },
      recordChanges() {},
    });
    statusBar.render(note, options);
    const listener = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document === note && event.contentChanges.length) {
        statusBar.scheduleEdit(event, options);
      }
    });
    try {
      const edit = new vscode.WorkspaceEdit();
      edit.insert(note.uri, note.lineAt(0).range.end, " two");
      assert.ok(await vscode.workspace.applyEdit(edit));
      finishFirst();
      assert.equal(await updated, note.version);
      assert.match(items[0].text, /^Words: 2 /);

      const lastAnalyzedVersion = note.version;
      const nextEdit = new vscode.WorkspaceEdit();
      nextEdit.insert(note.uri, note.lineAt(0).range.end, " three");
      assert.ok(await vscode.workspace.applyEdit(nextEdit));
      statusBar.render(undefined, options);
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(preparedVersion, lastAnalyzedVersion);
      assert.equal(items[0].visible, false);
    } finally {
      listener.dispose();
      statusBar.dispose();
    }
  });
});
