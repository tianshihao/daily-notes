// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "daily-notes" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "daily-notes.helloWorld",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from Daily Notes!");
    }
  );

  const openTodaysDailyNoteDisposable = vscode.commands.registerCommand(
    "daily-notes.openTodaysDailyNote",
    () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");

      const fileName = `${year}-${month}-${day}.md`;
      let filePath = "";
      if (vscode.workspace.workspaceFolders) {
        const rootFolder = vscode.workspace.workspaceFolders[0];
        if (rootFolder) {
          filePath = path.join(rootFolder.uri.fsPath, fileName);
        }
      }

      fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
          fs.writeFile(filePath, "", (err) => {
            if (err) {
              vscode.window.showErrorMessage("Failed to create file");
            } else {
              vscode.workspace.openTextDocument(filePath).then((doc) => {
                vscode.window.showTextDocument(doc);
              });
            }
          });
        } else {
          vscode.workspace.openTextDocument(filePath).then((doc) => {
            vscode.window.showTextDocument(doc);
          });
        }
      });
    }
  );

  context.subscriptions.push(disposable, openTodaysDailyNoteDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
