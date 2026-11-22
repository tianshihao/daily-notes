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
    showDocumentStats: true, showGitStatus: true,
    enableGit: true, autoCommit: true, autoSync: false,
  };
  let document: vscode.TextDocument;
  let items: RecordingItem[];
  let statusBar: NotebookStatusBar;

  suiteSetup(async () => {
    document = await vscode.workspace.openTextDocument({ language: "markdown", content: "Today 讨论" });
  });

  setup(() => {
    items = [];
    statusBar = new NotebookStatusBar((id, alignment, priority) => {
      const item = new RecordingItem(id, alignment, priority);
      items.push(item);
      return item;
    });
  });

  test("keeps statistics and Git adjacent in one named status bar item", () => {
    statusBar.render(document, options);
    assert.equal(items.length, 1);
    const [item] = items;
    assert.equal(item.id, "dailyNotes.notebookStatus");
    assert.equal(item.name, "Daily Notes: Notebook Status");
    assert.equal(item.alignment, vscode.StatusBarAlignment.Left);
    assert.equal(item.priority, 0);
    assert.equal(item.text, "Words: 3 · Language: zh  |  Git: On · Auto Commit: On · Auto Sync: Off");
    assert.equal(item.visible, true);

    statusBar.render(document, { ...options, enableGit: false, autoSync: true });
    assert.equal(item.text, "Words: 3 · Language: zh  |  Git: Off");
    assert.equal(item.visible, true);
    statusBar.dispose();
    assert.equal(item.disposed, true);
  });

  test("toggles each group independently and hides both outside the notebook", () => {
    statusBar.render(document, { ...options, showDocumentStats: false });
    const [item] = items;
    assert.equal(item.visible, true);
    assert.equal(item.text, "Git: On · Auto Commit: On · Auto Sync: Off");

    statusBar.render(document, { ...options, showGitStatus: false });
    assert.equal(item.visible, true);
    assert.equal(item.text, "Words: 3 · Language: zh");

    statusBar.render(document, { ...options, showDocumentStats: false, showGitStatus: false });
    assert.equal(item.visible, false);

    statusBar.render(document, options);
    statusBar.render(undefined, options);
    assert.equal(item.visible, false);

    statusBar.render(document, options);
    assert.equal(item.visible, true);
    assert.equal(items.length, 1);
    statusBar.dispose();
  });
});
