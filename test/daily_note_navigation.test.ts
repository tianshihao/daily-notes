import * as assert from "node:assert/strict";
import { access, unlink, writeFile } from "node:fs/promises";
import * as vscode from "vscode";

suite("Daily note navigation", function () {
  this.timeout(15000);

  const previous = "daily-notes.previousDailyNote";
  const next = "daily-notes.nextDailyNote";
  const target = vscode.ConfigurationTarget.Workspace;
  let earlier: vscode.Uri;
  let later: vscode.Uri;
  let originalNotebookPath: string | undefined;

  suiteSetup(async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, "The extension test runner must open a workspace folder.");
    earlier = vscode.Uri.joinPath(folder.uri, "2026-11-01.md");
    later = vscode.Uri.joinPath(folder.uri, "2026-11-03.md");
    await Promise.all([
      writeFile(earlier.fsPath, "# Earlier note\n"),
      writeFile(later.fsPath, "# Later note\n"),
      writeFile(vscode.Uri.joinPath(folder.uri, "README.md").fsPath, "# Other Markdown\n"),
    ]);
    const config = vscode.workspace.getConfiguration("dailyNotes");
    originalNotebookPath = config.inspect<string>("notebookPath")?.workspaceValue;
    await config.update("notebookPath", folder.uri.fsPath, target);
  });

  suiteTeardown(async () => {
    if (earlier) {
      await vscode.workspace.getConfiguration("dailyNotes").update("notebookPath", originalNotebookPath, target);
    }
  });

  async function showSource(uri: vscode.Uri) {
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
  }

  async function assertPreview(date: string) {
    const activeTab = () => vscode.window.tabGroups.activeTabGroup.activeTab;
    const matches = () => {
      const tab = activeTab();
      return tab?.input instanceof vscode.TabInputWebview && tab.label.includes(date);
    };
    if (!matches()) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          subscription.dispose();
          reject(new Error(`Expected Markdown preview for ${date}, found ${activeTab()?.label}.`));
        }, 5000);
        const subscription = vscode.window.tabGroups.onDidChangeTabs(() => {
          if (matches()) {
            clearTimeout(timer);
            subscription.dispose();
            resolve();
          }
        });
      });
    }
  }

  test("skips missing dates in both directions and stays on the first or last note", async () => {
    await showSource(earlier);
    await vscode.commands.executeCommand(previous);
    assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), earlier.toString());
    await vscode.commands.executeCommand(next);
    assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), later.toString());
    await vscode.commands.executeCommand(next);
    assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), later.toString());
    await vscode.commands.executeCommand(previous);
    assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), earlier.toString());
  });

  const periodPairs = [
    ["2026-11-02.W45.md", "2026-11-23.W48.md"],
    ["2026-02-01.month.md", "2026-11-01.month.md"],
    ["2026-01-01.quarter.md", "2026-10-01.quarter.md"],
    ["2024-01-01.year.md", "2026-01-01.year.md"],
  ] as const;

  test("navigates existing notes of the same period in a mixed notebook", async () => {
    const root = vscode.workspace.workspaceFolders![0].uri;
    const pairs = periodPairs.map(pair => pair.map(filename => vscode.Uri.joinPath(root, filename)));
    const files = [...pairs.flat(), vscode.Uri.joinPath(root, "2026-11-09.W99.md")];
    await Promise.all(files.map(file => writeFile(file.fsPath, "# Period note\n")));
    try {
      for (const [first, last] of pairs) {
        await showSource(first);
        await vscode.commands.executeCommand(next);
        assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), last.toString());
        await vscode.commands.executeCommand(next);
        assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), last.toString());
        await vscode.commands.executeCommand(previous);
        assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), first.toString());
      }

      await showSource(pairs[0][0]);
      await vscode.commands.executeCommand("markdown.showPreview");
      await assertPreview("2026-11-02.W45");
      await vscode.commands.executeCommand(next);
      await assertPreview("2026-11-23.W48");
      const preview = vscode.window.tabGroups.activeTabGroup.activeTab;
      assert.ok(preview);
      await vscode.window.tabGroups.close(preview);
    } finally {
      await Promise.all(files.map(file => unlink(file.fsPath)));
    }
  });

  test("keeps Markdown preview open when skipping dates in either direction", async () => {
    await showSource(earlier);
    await vscode.commands.executeCommand("markdown.showPreview");
    await assertPreview("2026-11-01");
    await vscode.commands.executeCommand(next);
    await assertPreview("2026-11-03");
    await vscode.commands.executeCommand(previous);
    await assertPreview("2026-11-01");
  });

  test("keeps the last note in preview when there is no next note", async () => {
    await showSource(later);
    await vscode.commands.executeCommand("markdown.showPreview");
    await assertPreview("2026-11-03");
    await vscode.commands.executeCommand(next);
    await assertPreview("2026-11-03");
  });

  test("opens the same date last year and leaves missing notes absent", async () => {
    const command = "daily-notes.openSameDayLastYear";
    const folder = vscode.workspace.workspaceFolders![0].uri;
    const existing = vscode.Uri.joinPath(folder, "2025-11-01.md");
    const missing = vscode.Uri.joinPath(folder, "2025-11-03.md");
    await writeFile(existing.fsPath, "# Last year\n", { flag: "wx" });
    try {
      await showSource(earlier);
      await vscode.commands.executeCommand(command);
      assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), existing.toString());

      await showSource(later);
      await vscode.commands.executeCommand(command);
      assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), later.toString());
      await assert.rejects(access(missing.fsPath), { code: "ENOENT" });
    } finally {
      await unlink(existing.fsPath);
    }
  });
});
