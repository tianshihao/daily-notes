import * as assert from "node:assert/strict";
import * as vscode from "vscode";

suite("Status bar commands", () => {
  const keys = ["showDocumentStats", "showGitStatus", "enableGit", "autoCommit", "autoSync"] as const;
  const commands = [
    ["daily-notes.toggleDocumentStats", "showDocumentStats"],
    ["daily-notes.toggleGitStatus", "showGitStatus"],
  ] as const;

  function effectiveSettings() {
    const config = vscode.workspace.getConfiguration("dailyNotes");
    return Object.fromEntries(keys.map((key) => [key, config.get<boolean>(key)]));
  }

  for (const [command, key] of commands) {
    test(`${command} toggles only its display setting`, async () => {
      const hasWorkspace = !!(vscode.workspace.workspaceFile || vscode.workspace.workspaceFolders?.length);
      const target = hasWorkspace ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
      const scope = hasWorkspace ? "workspaceValue" : "globalValue";
      const config = vscode.workspace.getConfiguration("dailyNotes");
      const before = effectiveSettings();
      const original = config.inspect<boolean>(key);
      assert.strictEqual(original?.defaultValue, true);

      try {
        for (const expected of [!before[key], before[key]]) {
          await vscode.commands.executeCommand(command);
          assert.deepStrictEqual(effectiveSettings(), { ...before, [key]: expected });
          const current = vscode.workspace.getConfiguration("dailyNotes").inspect<boolean>(key);
          assert.strictEqual(current?.[scope], expected);
        }
      } finally {
        await config.update(key, original[scope], target);
      }
    });
  }
});
