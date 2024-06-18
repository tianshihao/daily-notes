// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { configManager } from "./manager/manager";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "daily-notes" is now active!');

  init();

  context.subscriptions.push(configManager);

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const helloWorldDisposable = vscode.commands.registerCommand(
    "daily-notes.helloWorld",
    () => {
      // The code you place here will be executed every time your command is
      // executed. Display a message box to the user
      vscode.window.showInformationMessage("Hello World from Daily Notes!");
    }
  );

  const openTodaysDailyNoteDisposable = vscode.commands.registerCommand(
    "daily-notes.openTodaysDailyNote",
    () => {
      openTodaysDailyNote();
    }
  );

  const setNotebookDisposable = vscode.commands.registerCommand(
    "daily-notes.setupNotebook",
    () => {
      setupNotebook();
    }
  );

  const insertTimestampDisposable = vscode.commands.registerCommand(
    "daily-notes.insertTimestamp",
    () => {
      insertTimestamp();
    }
  );

  context.subscriptions.push(
    helloWorldDisposable,
    openTodaysDailyNoteDisposable,
    setNotebookDisposable,
    insertTimestampDisposable
  );
}

function insertTimestamp() {
  const editor = vscode.window.activeTextEditor;

  if (editor) {
    const selection = editor.selection;
    const date = new Date();
    const timestamp = date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });

    editor.edit((editBuilder) => {
      editBuilder.insert(selection.start, timestamp);
    });
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}

async function openTodaysDailyNote() {
  if (
    configManager.get("notebookDirectory") === undefined ||
    configManager.get("notebookDirectory") === ""
  ) {
    console.log("Notebook directory is not set.");
    await setupNotebook();
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const fileName = `${year}-${month}-${day}.md`;

  let notebookDirectory = String(configManager.get("notebookDirectory"));
  let filePath = path.join(notebookDirectory, fileName);

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

async function setupNotebook() {
  console.log("Setting up notebook directory.");
  let notebookInfo = { directory: "", name: "" };

  const isSetupSuccessful = await setupNotebookDirectory(notebookInfo);

  if (!isSetupSuccessful) {
    vscode.window.showErrorMessage("Failed to setup notebook directory.");
    return;
  }

  await openNotebook(notebookInfo);
}

async function setupNotebookDirectory(notebookInfo: {
  directory: string;
  name: string;
}) {
  enum Action {
    Create = "Create",
    Update = "Update",
  }

  const actions: vscode.QuickPickItem[] = [
    {
      label: Action.Create,
      description: "Create a new single-folder workspace",
    },
    {
      label: Action.Update,
      description: "Update an existing folder as notebook folder",
    },
  ];

  const action = await vscode.window.showQuickPick(actions, {
    placeHolder: "Setup your notebook folder first.",
  });

  if (action) {
    switch (action.label) {
      case Action.Create: {
        const notebookNameLocal = await vscode.window.showInputBox({
          prompt: "Enter the notebook name",
        });

        if (notebookNameLocal) {
          const directorySelected = await selectDirectory();

          if (directorySelected) {
            const notebookDirectoryLocal = path.join(
              directorySelected,
              notebookNameLocal
            );

            try {
              // Create a directory called notebookNameLocal
              fs.mkdirSync(notebookDirectoryLocal);
              vscode.window.showInformationMessage(
                "Directory created successfully."
              );

              notebookInfo.directory = notebookDirectoryLocal;
              notebookInfo.name = notebookNameLocal;

              return true;
            } catch (error) {
              vscode.window.showErrorMessage("Failed to create directory.");
              return false;
            }
          }
        }
        break;
      }
      case Action.Update: {
        const directoryLocal = await selectDirectory();

        if (directoryLocal) {
          notebookInfo.name = path.basename(directoryLocal);
          notebookInfo.directory = directoryLocal;
          return true;
        } else {
          return false;
        }
      }
    }
  }

  return false;
}

async function selectDirectory() {
  const directory = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectMany: false,
  });

  return directory && directory[0] ? directory[0].fsPath : null;
}

async function openNotebook(notebookInfo: { directory: string; name: string }) {
  if (!vscode.workspace.workspaceFolders) {
    console.log("Open notebook with an empty window.");

    // Open the notebook folder in the current window as single-folder workspace.
    vscode.commands.executeCommand(
      "vscode.openFolder",
      vscode.Uri.file(notebookInfo.directory),
      // false represents that the new folder will be opened in the current window.
      false
    );
  } else if (vscode.workspace.workspaceFolders) {
    console.log("Open notebook with a workspace.");

    // Check if notebook directory is opened in the current workspace.
    const isNotebookDirectoryOpened = vscode.workspace.workspaceFolders.some(
      (folder) => folder.uri.fsPath === notebookInfo.directory
    );

    if (!isNotebookDirectoryOpened) {
      vscode.commands.executeCommand(
        "vscode.openFolder",
        vscode.Uri.file(notebookInfo.directory),
        true
      );
    } else {
      // The notebook directory is already opened in the workspace.
      await configManager.update(
        "notebookDirectory",
        notebookInfo.directory,
        vscode.ConfigurationTarget.Workspace
      );
      await configManager.update(
        "notebookName",
        notebookInfo.name,
        vscode.ConfigurationTarget.Workspace
      );
    }
  }
}

function init() {
  console.log("Initializing daily notes extension.");

  if (!vscode.workspace.workspaceFolders) {
    // do nothing.
  } else if (vscode.workspace.workspaceFolders) {
    // Single-folder workspace.
    if (vscode.workspace.workspaceFolders.length === 1) {
      // Both configurations will write to the .vscode/settings.json
      configManager.update(
        "notebookDirectory",
        vscode.workspace.workspaceFolders[0].uri.fsPath
      );

      configManager.update(
        "notebookName",
        vscode.workspace.workspaceFolders[0].name,
        vscode.ConfigurationTarget.Workspace
      );
    } else {
    }
  }
}
