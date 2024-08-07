// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { configManager } from "./config_manager/config_manager";
import { docTemplate } from "./doc_template/doc_template";
import { gitService } from "./git_service/git_service";
import { Logger } from "./utils/logger";
import { statusBarWidgetManager } from "./widget/status_bar_widget";
import { textService } from "./text_service/text_service";
import { utils } from "./utils/utils";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import Context, { ExtensionState } from "./context/context";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  Logger.init();
  Logger.info("Congratulations, your extension 'daily-notes' is now active!");

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

  // todo tianshihao, remove next time.
  const setNotebookDisposable = vscode.commands.registerCommand(
    "daily-notes.setUpNotebook",
    () => {
      setUpNotebook();
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

// After openTodoysDailyNote, the setUp will work properly in the next time.
function setUp(context: vscode.ExtensionContext) {
  Logger.info("Initializing daily notes extension.");

  // 1. Init context first.
  resetContext();

  // 2. Establish the listeners.
  if (false === Context.getInstance().getIsConfigurationChangeListenerSet()) {
    monitorConfigurationChanges(context);
    Context.getInstance().setIsConfigurationChangeListenerSet(true);
  }
  if (false === Context.getInstance().getIsWorkspaceFolderChangeListenerSet()) {
    monitorWorkspaceChanges(context);
    Context.getInstance().setIsWorkspaceFolderChangeListenerSet(true);
  }

  // 3. Check the extension state and activate or deactivate the extension features.
  if (ExtensionState.Ready === Context.getInstance().getExtensionState()) {
    activateExtensionFeatures(context);
  } else {
    deactivateExtensionFeatures(context);
  }
}

function activateExtensionFeatures(context: vscode.ExtensionContext) {
  // checkWorkspace();

  activateGitService();

  // todo tianshihao, refactor to be toggleable or the manager of listener.
  monitorActiveEditorChanges(context);

  Context.getInstance().setExtensionState(ExtensionState.Running);
}

function deactivateExtensionFeatures(context: vscode.ExtensionContext) {
  disableGitService();

  // todo tianshihao, disable the word count of text service.

  // todo tianshihao, should the toggling the visibility of widgets in a single location?
  statusBarWidgetManager.hideAll();
}

function resetContext() {
  const context = Context.getInstance();

  if (true === utils.isValidNotebookPath(configManager.get("notebookPath"))) {
    context.setExtensionState(ExtensionState.Ready);
    context.setIsNotebookConfigured(true);
  } else {
    context.setExtensionState(ExtensionState.Waiting);
    context.setIsNotebookConfigured(false);
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
      if (
        false ===
        utils.isPathPresentInWorkspace(configManager.get("notebookPath"))
      ) {
        // The notebook path is not present in the workspace.
        context.setExtensionState(ExtensionState.Waiting);
      }
    } else {
      // If the workspace is not configured, the extension also does nothing.
      context.setExtensionState(ExtensionState.Waiting);
    }
  }
}

// function deactivateExtension() {
//   console.log(
//     "Deactivating extension as no notebook directory is present in the workspace."
//   );
//   vscode.commands.executeCommand(
//     "workbench.action.unloadExtension",
//     "daily-notes"
//   );
// }

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

// The entry of the extension.
async function openTodaysDailyNote() {
  Logger.info("openTodaysDailyNote");

  if (utils.isValidNotebookPath(configManager.get("notebookPath")) === false) {
    Logger.warn("Notebook directory is not set.");
    // todo tianshihao, should it return by a boolean value?
    if (false === (await setUpNotebook())) {
      Logger.error("Failed to set up notebook directory.");
      vscode.window.showErrorMessage("Failed to set up notebook directory.");
      return;
    }
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const fileName = `${year}-${month}-${day}.md`;

  let notebookPath = String(configManager.get("notebookPath"));
  if (!fs.existsSync(notebookPath)) {
    Logger.error("Notebook directory is not exists.");
    vscode.window.showErrorMessage("Notebook directory is not exists.");
    return;
  }
  let filePath = path.join(notebookPath, fileName);

  Logger.info(`Opening today's daily note: ${filePath}`);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      const initialContent = docTemplate.generateContent("dailyNote");
      fs.writeFile(filePath, initialContent, (err) => {
        if (err) {
          Logger.error("Failed to create file");
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

async function setUpNotebook(): Promise<boolean> {
  Logger.info("setUpNotebook");

  let notebookInfo = { path: "", name: "" };

  let ret = await setNotebookPath(notebookInfo);
  if (false === ret) {
    Logger.error("Failed to setup notebook path.");
    vscode.window.showErrorMessage("Failed to setup notebook path.");
    return false;
  }

  ret = await openNotebook(notebookInfo);
  if (false === ret) {
    Logger.error("Failed to open notebook path.");
    vscode.window.showErrorMessage("Failed to open notebook path.");
  }

  return true;
}

async function setNotebookPath(notebookInfo: { path: string; name: string }) {
  Logger.info("setNotebookPath");

  enum Action {
    Create = "Create",
    Update = "Update",
  }

  const actions: vscode.QuickPickItem[] = [
    {
      label: Action.Create,
      description: "Create a new directory for notebook",
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

              notebookInfo.path = notebookPathLocal;
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
          notebookInfo.path = directoryLocal;
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
  Logger.info("selectDirectory");

  const directory = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectMany: false,
  });

  return directory && directory[0] ? directory[0].fsPath : null;
}

async function openNotebook(notebookInfo: {
  path: string;
  name: string;
}): Promise<boolean> {
  Logger.info("openNotebook");

  enum Action {
    Current = "Current",
    New = "New",
  }

  const actions: vscode.QuickPickItem[] = [
    {
      label: Action.Current,
      description: "Open notebook folder in the current window",
    },
    {
      label: Action.New,
      description: "Open notebook folder in a new window",
    },
  ];

  const action = await vscode.window.showQuickPick(actions, {
    placeHolder: "debug",
  });

  if (action) {
    switch (action.label) {
      case Action.Current: {
        return await openNotebookInCurrentWindow(notebookInfo);
      }
      case Action.New: {
        return await openNotebookInNewWindow(notebookInfo);
      }
    }
  }

  return false;
}

async function openNotebookInCurrentWindow(notebookInfo: {
  path: string;
  name: string;
}): Promise<boolean> {
  Logger.info("openNotebookInCurrentWindow");

  if (!vscode.workspace.workspaceFolders) {
    Logger.warn("Open notebook within current empty window.");

    // Open the notebook folder in the current window as single-folder workspace.
    vscode.commands.executeCommand(
      "vscode.openFolder",
      vscode.Uri.file(notebookInfo.path),
      // false represents that the new folder will be opened in the current window.
      false
    );
  } else if (vscode.workspace.workspaceFolders) {
    Logger.info("Open notebook within current workspace.");

    // Add the notebookPath to the workspace.
    vscode.workspace.updateWorkspaceFolders(
      vscode.workspace.workspaceFolders.length,
      0,
      { uri: vscode.Uri.file(notebookInfo.path) }
    );
  }

  // Update the configuration with the new notebook path.
  await configManager.update(
    "notebookPath",
    notebookInfo.path,
    vscode.ConfigurationTarget.Workspace
  );
  await configManager.update(
    "notebookName",
    notebookInfo.name,
    vscode.ConfigurationTarget.Workspace
  );

  return true;
}

async function openNotebookInNewWindow(notebookInfo: {
  path: string;
  name: string;
}): Promise<boolean> {
  Logger.info("openNotebookInNewWindow");

  vscode.commands.executeCommand(
    "vscode.openFolder",
    vscode.Uri.file(notebookInfo.path),
    true
  );

  return true;
}

function activateGitService() {
  Logger.info("activateGitService");

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
  statusBarWidgetManager
    .getWidget("autoSync")
    .updateContent(
      `Auto Sync: ${configManager.get("autoSync") ? "On" : "Off"}`
    );
}

function disableGitService() {
  Logger.info("disableGitService");

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
  Logger.info("commit");

  await gitService.commit();
  if (true === configManager.get("autoSync")) {
    await gitService.sync();
  }
}

async function sync() {
  Logger.info("sync");

  await gitService.commit();
  await gitService.sync();
}

function updateTextState(activeEditor: vscode.TextEditor) {
  Logger.info("updateTextState");

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
  Logger.info("toggleEnableGit");

  configManager.update(
    "enableGit",
    !configManager.get("enableGit"),
    vscode.ConfigurationTarget.Workspace
  );
}

function toggleAutoCommit() {
  Logger.info("toggleAutoCommit");

  configManager.update(
    "autoCommit",
    !configManager.get("autoCommit"),
    vscode.ConfigurationTarget.Workspace
  );
}

async function resetAutoCommitInterval() {
  Logger.info("resetAutoCommitInterval");

  let isValid = false;
  let interval;

  while (!isValid) {
    interval = await vscode.window.showInputBox({
      prompt: "Enter the new interval for auto commit in minutes",
      validateInput: (text) => {
        const value = parseInt(text, 10);
        if (false === utils.isValidAutoCommitInterval(value)) {
          return "please enter a value between 2 and 600.";
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
  Logger.info("toggleautoSync");

  configManager.update(
    "autoSync",
    !configManager.get("autoSync"),
    vscode.ConfigurationTarget.Workspace
  );
}

// This function is modified to monitor changes in the active editor only
function monitorActiveEditorChanges(context: vscode.ExtensionContext) {
  Logger.info("monitorActiveEditorChanges");

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

// function handleActiveEditorChange(editor: vscode.TextEditor | undefined) {
//   if (editor) {
//     console.log(`Active editor changed: ${editor.document.uri.fsPath}`);
//     // Add your logic here
//   }
// }

// function toggleActiveEditorChangeListener() {
//   if (Context.getInstance().getIsActiveEditorChangeListenerEnabled()) {
//     // Unregister the listener
//     if (Context.getInstance().getActiveEditorChangeListener()) {
//       Context.getInstance().getActiveEditorChangeListener()?.dispose();
//       Context.getInstance().setActiveEditorChangeListener(undefined);
//     }
//     vscode.window.showInformationMessage(
//       "Active editor change listener disabled."
//     );
//   } else {
//     // Register the listener
//     Context.getInstance().setActiveEditorChangeListener(
//       vscode.window.onDidChangeActiveTextEditor(handleActiveEditorChange)
//     );
//     vscode.window.showInformationMessage(
//       "Active editor change listener enabled."
//     );
//   }
//   Context.getInstance().setIsActiveEditorChangeListenerEnabled(
//     !Context.getInstance().getIsActiveEditorChangeListenerEnabled()
//   );
// }

// This function also repsonds to changes of workspace folders.
function monitorConfigurationChanges(context: vscode.ExtensionContext) {
  Logger.info("monitorConfigurationChanges");

  vscode.workspace.onDidChangeConfiguration((event) => {
    // Will respond to changes in the dailyNotes configuration, even if the dailyNotes.fuck!
    if (event.affectsConfiguration("dailyNotes")) {
      Logger.info("dailyNotes configuration changed.");

      if (event.affectsConfiguration("dailyNotes.notebookPath")) {
        setUp(context);
      }

      if (event.affectsConfiguration("dailyNotes.enableGit")) {
        if (true === configManager.get("enableGit")) {
          activateGitService();
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

      if (event.affectsConfiguration("dailyNotes.autoSync")) {
        if (true === configManager.get("enableGit")) {
          statusBarWidgetManager
            .getWidget("autoSync")
            .updateContent(
              `Auto Sync: ${configManager.get("autoSync") ? "On" : "Off"}`
            );
        }
      }
    }
  });
}

// This function only responds to changes in workspace folders.
function monitorWorkspaceChanges(context: vscode.ExtensionContext) {
  Logger.info("monitorWorkspaceChanges");

  vscode.workspace.onDidChangeWorkspaceFolders((event) => {
    setUp(context);
  });
}
