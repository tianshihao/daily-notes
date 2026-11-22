import { configManager } from "./config_manager/config_manager";
import { docTemplate } from "./doc_template/doc_template";
import { GitService } from "./git_service/git_service";
import { Logger } from "./utils/logger";
import { NotebookStatusBar, type NotebookStatusOptions } from "./widget/notebook_status_bar";
import { findWorkspaceDirectory, isExistingDirectory, isMarkdownFileInDirectory } from "./utils/filesystem";
import { isValidCommitInterval } from "./git_service/auto_commit";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const log = Logger.init();
  const git = new GitService();
  const statusBar = new NotebookStatusBar();
  let folder: vscode.WorkspaceFolder | undefined;
  let activeNote: vscode.TextDocument | undefined;
  let statusOptions: NotebookStatusOptions;

  function refreshEditor(editor = vscode.window.activeTextEditor) {
    const document = editor?.document;
    activeNote = document && folder && isMarkdownFileInDirectory(document.uri, folder.uri) ? document : undefined;
    statusBar.render(activeNote, statusOptions);
  }

  function configure() {
    folder = findWorkspaceDirectory(configManager.get("notebookPath"));
    git.configure(folder);
    statusOptions = {
      notebookName: configManager.get("notebookName"),
      showDocumentStats: configManager.get("showDocumentStats"),
      showGitStatus: configManager.get("showGitStatus"),
      enableGit: configManager.get("enableGit"),
      autoCommit: configManager.get("autoCommit"),
      autoSync: configManager.get("autoSync"),
    };
    refreshEditor();
  }

  const register = vscode.commands.registerCommand;
  context.subscriptions.push(
    log,
    git,
    statusBar,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("dailyNotes")) {
        configure();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(configure),
    vscode.window.onDidChangeActiveTextEditor(refreshEditor),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const { document, contentChanges } = event;
      if (
        contentChanges.length > 0 &&
        statusOptions.showDocumentStats &&
        document === activeNote && document === vscode.window.activeTextEditor?.document
      ) {
        statusBar.scheduleEdit(event, statusOptions);
      }
    }),
    register("daily-notes.helloWorld", () => vscode.window.showInformationMessage("Hello World from Daily Notes!")),
    register("daily-notes.openTodaysDailyNote", openTodaysDailyNote),
    register("daily-notes.setUpNotebook", setUpNotebook),
    register("daily-notes.insertTimestamp", insertTimestamp),
    register("daily-notes.toggleDocumentStats", () => toggleStatusVisibility("showDocumentStats")),
    register("daily-notes.toggleGitStatus", () => toggleStatusVisibility("showGitStatus")),
    register("daily-notes.toggleEnableGit", toggleEnableGit),
    register("daily-notes.commit", () => git.commit()),
    register("daily-notes.sync", async () => {
      await git.sync();
      void vscode.window.showInformationMessage("Daily Notes sync complete.");
    }),
    register("daily-notes.toggleAutoCommit", () => toggleSetting("autoCommit")),
    register("daily-notes.resetAutoCommitInterval", resetAutoCommitInterval),
    register("daily-notes.toggleautoSync", () => toggleSetting("autoSync"))
  );
  configure();
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

// The entry of the extension.
async function openTodaysDailyNote() {
  Logger.info("openTodaysDailyNote");

  let notebookPath = findWorkspaceDirectory(configManager.get("notebookPath"))?.uri.fsPath;
  if (!notebookPath) {
    Logger.warn("Notebook directory is not set.");
    // todo tianshihao, should it return by a boolean value?
    if (false === (await setUpNotebook())) {
      Logger.error("Failed to set up notebook directory.");
      vscode.window.showErrorMessage("Failed to set up notebook directory.");
      return;
    }
    notebookPath = configManager.get("notebookPath");
    if (!isExistingDirectory(notebookPath)) {
      Logger.error("Notebook directory does not exist.");
      vscode.window.showErrorMessage("Notebook directory does not exist.");
      return;
    }
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const fileName = `${year}-${month}-${day}.md`;

  const filePath = path.join(notebookPath, fileName);

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

function toggleStatusVisibility(key: "showDocumentStats" | "showGitStatus") {
  const target = vscode.workspace.workspaceFolders?.length || vscode.workspace.workspaceFile
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  return configManager.update(key, !configManager.get(key), target);
}

async function toggleEnableGit() {
  const target = vscode.ConfigurationTarget.Workspace;
  const enable = !configManager.get("enableGit");
  if (!enable) {
    await configManager.update("enableGit", false, target);
  }
  await configManager.update("autoSync", false, target);
  await configManager.update("autoCommit", enable, target);
  if (enable) {
    await configManager.update("enableGit", true, target);
  }
}

function toggleSetting(key: "autoCommit" | "autoSync") {
  return configManager.update(key, !configManager.get(key), vscode.ConfigurationTarget.Workspace);
}

async function resetAutoCommitInterval() {
  const interval = await vscode.window.showInputBox({
    prompt: "Minutes between automatic commits",
    value: String(configManager.get("autoCommitInterval")),
    validateInput: (text) => {
      const minutes = Number(text);
      return isValidCommitInterval(minutes)
        ? undefined : "Enter a whole number between 2 and 600.";
    },
  });
  if (interval !== undefined) {
    await configManager.update("autoCommitInterval", Number(interval), vscode.ConfigurationTarget.Workspace);
  }
}
