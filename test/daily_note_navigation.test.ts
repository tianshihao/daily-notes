import * as assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
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
});
