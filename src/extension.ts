// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { configManager } from "./config_manager/config_manager";
import { docTemplate } from "./doc_template/doc_template";
import { gitService } from "./git_service/git_service";
import { statusBarWidgetManager } from "./widget/status_bar_widget";
import { textService } from "./text_service/text_service";
import { utils } from "./utils/utils";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { utils } from "./utils/utils";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "daily-notes" is now active!');

  setUp(context);

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

  const toggleEnableGitDisposable = vscode.commands.registerCommand(
    "daily-notes.toggleEnableGit",
    async () => {
      toggleEnableGit();
    }
  );

  const commitDisposable = vscode.commands.registerCommand(
    "daily-notes.commit",
    () => {
      commit();
    }
  );

  const toggleAutoCommitDisposable = vscode.commands.registerCommand(
    "daily-notes.toggleAutoCommit",
    async () => {
      toggleAutoCommit();
    }
  );

  const resetAutoCommitIntervalDisposable = vscode.commands.registerCommand(
    "daily-notes.resetAutoCommitInterval",
    async () => {
      resetAutoCommitInterval();
    }
  );

  const syncDisposable = vscode.commands.registerCommand(
    "daily-notes.sync",
    () => {
      sync();
    }
  );

  const toggleautoSyncDisposable = vscode.commands.registerCommand(
    "daily-notes.toggleautoSync",
    async () => {
      toggleautoSync();
    }
  );

  context.subscriptions.push(
    helloWorldDisposable,
    openTodaysDailyNoteDisposable,
    setNotebookDisposable,
    insertTimestampDisposable,
    toggleEnableGitDisposable,
    commitDisposable,
    toggleAutoCommitDisposable,
    resetAutoCommitIntervalDisposable,
    syncDisposable,
    toggleautoSyncDisposable
  );
}

function setUp(context: vscode.ExtensionContext) {
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

function checkWorkspace() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const context = Context.getInstance();

  // A new empty window. The extension should do nothing for now.
  if (!workspaceFolders) {
    context.setExtensionState(ExtensionState.Waiting);
  } else if (workspaceFolders) {
    if (true === context.getIsNotebookConfigured()) {
      if (false === utils.isPathPresent(configManager.get("notebookPath"))) {
        // The notebook path is not present in the workspace.
        context.setExtensionState(ExtensionState.Waiting);
      }
    } else {
      // If the workspace is not configured, the extension also does nothing.
      context.setExtensionState(ExtensionState.Waiting);
    }
  }
}

  monitorActiveEditorChanges(context);
  monitorConfigurationChanges();
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
    configManager.get("notebookPath") === undefined ||
    configManager.get("notebookPath") === ""
  ) {
    console.log("Notebook directory is not set.");
    await setupNotebook();
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const fileName = `${year}-${month}-${day}.md`;

  let notebookPath = String(configManager.get("notebookPath"));
  if (!fs.existsSync(notebookPath)) {
    vscode.window.showErrorMessage("Notebook directory is not exists.");
    return;
  }
  let filePath = path.join(notebookPath, fileName);

  console.log("filePath = ", filePath);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      const initialContent = docTemplate.generateContent("dailyNote");
      fs.writeFile(filePath, initialContent, (err) => {
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

  const isSetupSuccessful = await setUpNotebookPath(notebookInfo);

  if (!isSetupSuccessful) {
    vscode.window.showErrorMessage("Failed to setup notebook directory.");
    return;
  }

  await openNotebook(notebookInfo);
}

async function setUpNotebookPath(notebookInfo: {
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
            const notebookPathLocal = path.join(
              directorySelected,
              notebookNameLocal
            );

            try {
              // Create a directory called notebookNameLocal
              fs.mkdirSync(notebookPathLocal);
              vscode.window.showInformationMessage(
                "Directory created successfully."
              );

              notebookInfo.directory = notebookPathLocal;
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
    const isnotebookPathOpened = vscode.workspace.workspaceFolders.some(
      (folder) => folder.uri.fsPath === notebookInfo.directory
    );

    if (!isnotebookPathOpened) {
      vscode.commands.executeCommand(
        "vscode.openFolder",
        vscode.Uri.file(notebookInfo.directory),
        true
      );
    } else {
      // The notebook directory is already opened in the workspace.
      await configManager.update(
        "notebookPath",
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

function setUpGitService() {
  gitService.init();

  if (true === configManager.get("enableGit")) {
    if (true === configManager.get("autoCommit")) {
      if (true === configManager.get("autoSync")) {
        gitService.sync();
      }

      gitService.scheduleAutoCommit();
    }
  }

  statusBarWidgetManager
    .getWidget("enableGit")
    .updateContent(`Git: ${configManager.get("enableGit") ? "On" : "Off"}`);

  statusBarWidgetManager
    .getWidget("autoCommit")
    .updateContent(
      `Auto Commit: ${configManager.get("autoCommit") ? "On" : "Off"}`
    );
}

function disableGitService() {
  configManager.update(
    "autoCommit",
    false,
    vscode.ConfigurationTarget.Workspace
  );

  configManager.update("autoSync", false, vscode.ConfigurationTarget.Workspace);

  // todo tianshihao, how to make the widget auto response to the change of configuration?
  statusBarWidgetManager.getWidget("enableGit").updateContent("Git: Off");
  statusBarWidgetManager
    .getWidget("autoCommit")
    .updateContent("Auto Commit: Off");
}

async function commit() {
  await gitService.commit();
  if (true === configManager.get("autoSync")) {
    await gitService.sync();
  }
}

async function sync() {
  await gitService.commit();
  await gitService.sync();
}

function updateTextState(activeEditor: vscode.TextEditor) {
  statusBarWidgetManager
    .getWidget("wordCount")
    .updateContent(
      `Words: ${textService.countWords(
        activeEditor.document.getText(),
        activeEditor.document.fileName
      )}`
    );

  statusBarWidgetManager
    .getWidget("language")
    .updateContent(
      `Language: ${textService.getLanguage(activeEditor.document.fileName)}`
    );
}

function toggleEnableGit() {
  configManager.update(
    "enableGit",
    !configManager.get("enableGit"),
    vscode.ConfigurationTarget.Workspace
  );
}

function toggleAutoCommit() {
  configManager.update(
    "autoCommit",
    !configManager.get("autoCommit"),
    vscode.ConfigurationTarget.Workspace
  );
}

async function resetAutoCommitInterval() {
  let isValid = false;
  let interval;

  while (!isValid) {
    interval = await vscode.window.showInputBox({
      prompt: "Enter the new interval for auto commit in minutes",
      validateInput: (text) => {
        const value = parseInt(text, 10);
        if (isNaN(value) || value < 2 || value > 600) {
          return "Please enter a value between 2 and 600.";
        }
        return null;
      },
    });

    if (interval !== undefined) {
      isValid = true;
      // Update the configuration with the new interval
      // Assuming configManager is a placeholder for your actual configuration management logic
      configManager.update(
        "autoCommitInterval",
        parseInt(interval, 10),
        vscode.ConfigurationTarget.Workspace
      );
    } else {
      // User pressed ESC or closed the input box, break the loop
      break;
    }
  }
}

function toggleautoSync() {
  configManager.update(
    "autoSync",
    !configManager.get("autoSync"),
    vscode.ConfigurationTarget.Workspace
  );
}

// This function is modified to monitor changes in the active editor only
function monitorActiveEditorChanges(context: vscode.ExtensionContext) {
  // Immediately perform a word count if there's an active editor when the extension is activated
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    // 1. Check whether the active editor is under the notebook directory.
    if (true === utils.isFileInNotebookPath(activeEditor)) {
      // 2. If so update the text state.
      updateTextState(activeEditor);
      statusBarWidgetManager.showAll();
    } else {
      statusBarWidgetManager.hideAll();
    }
  }

  // Monitor changes in the active editor and perform a word count on change
  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor) {
        // 1. Check whether the active editor is under the notebook directory.
        if (true === utils.isFileInNotebookPath(editor)) {
          // 2. If so update the text state.
          updateTextState(editor);
          statusBarWidgetManager.showAll();
        } else {
          statusBarWidgetManager.hideAll();
        }
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (
        vscode.window.activeTextEditor &&
        event.document === vscode.window.activeTextEditor.document
      ) {
        updateTextState(vscode.window.activeTextEditor);
      }
    },
    null,
    context.subscriptions
  );
}

function monitorConfigurationChanges() {
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("dailyNotes.enableGit")) {
      if (true === configManager.get("enableGit")) {
        setUpGitService();
      } else {
        disableGitService();
      }

      if (true === configManager.get("enableGit")) {
        configManager.update(
          "autoCommit",
          true,
          vscode.ConfigurationTarget.Workspace
        );
      } else {
        configManager.update(
          "autoCommit",
          false,
          vscode.ConfigurationTarget.Workspace
        );
      }

      configManager.update(
        "autoSync",
        false,
        vscode.ConfigurationTarget.Workspace
      );
    }

    if (event.affectsConfiguration("dailyNotes.autoCommit")) {
      if (true === configManager.get("enableGit")) {
        if (true === configManager.get("autoCommit")) {
          gitService.scheduleAutoCommit();
        } else {
          gitService.stopAutoCommit();
        }

        statusBarWidgetManager
          .getWidget("autoCommit")
          .updateContent(
            `Auto Commit: ${configManager.get("autoCommit") ? "On" : "Off"}`
          );
      } else {
        // do nothing
      }
    }

    if (event.affectsConfiguration("dailyNotes.autoCommitInterval")) {
      if (true === configManager.get("enableGit")) {
        if (true === configManager.get("autoCommit")) {
          gitService.scheduleAutoCommit();
        }
      }
    }
  });
}
