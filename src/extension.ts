import { getNotePeriod, type NotePeriod } from "./notes/period";
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
    register("daily-notes.openTodaysDailyNote", () => openCurrentNote("day")),
    register("daily-notes.openThisWeeksWeeklyNote", () => openCurrentNote("week")),
    register("daily-notes.openThisMonthsMonthlyNote", () => openCurrentNote("month")),
    register("daily-notes.openThisQuartersQuarterlyNote", () => openCurrentNote("quarter")),
    register("daily-notes.openThisYearsYearlyNote", () => openCurrentNote("year")),
    register("daily-notes.previousDailyNote", () => navigateDailyNote("previous")),
    register("daily-notes.nextDailyNote", () => navigateDailyNote("next")),
    register("daily-notes.openSameDayLastYear", () => navigateDailyNote("lastYear")),
    register("daily-notes.setUpNotebook", setUpNotebook),
    register("daily-notes.insertTimestamp", insertTimestamp),
    register("daily-notes.showStatusBarActions", showStatusBarActions),
    register("daily-notes.toggleDocumentStats", () => toggleStatusVisibility("showDocumentStats")),
    register("daily-notes.toggleGitStatus", () => toggleStatusVisibility("showGitStatus")),
    register("daily-notes.toggleEnableGit", () => toggleSetting("enableGit")),
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

function parseNoteDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) {
    return;
  }
  const date = new Date(value + "T00:00:00Z");
  if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value) {
    return date;
  }
}

async function getNotebookPath(): Promise<string | undefined> {
  const configured = findWorkspaceDirectory(configManager.get("notebookPath"));
  if (configured) {
    return configured.uri.fsPath;
  }
  if (await setUpNotebook()) {
    const notebookPath = configManager.get("notebookPath");
    if (isExistingDirectory(notebookPath)) {
      return notebookPath;
    }
    void vscode.window.showErrorMessage("Notebook directory does not exist.");
  }
}

async function openCurrentNote(period: NotePeriod) {
  const note = getNotePeriod(period, new Date());
  await runNoteCommand(async () => {
    const notebookPath = await getNotebookPath();
    if (notebookPath) {
      const content = note.heading === undefined
        ? docTemplate.generateContent("dailyNote", note.date)
        : `# ${note.heading}\n`;
      await openOrCreateNote(notebookPath, note.filename, content);
    }
  });
}

async function listDailyNotes(notebookPath: string): Promise<string[]> {
  const entries = await fs.promises.readdir(notebookPath, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith(".md"))
    .map(entry => entry.name.slice(0, -3))
    .filter(date => parseNoteDate(date))
    .sort();
}

async function openOrCreateNote(notebookPath: string, filename: string, content: string) {
  const filePath = path.join(notebookPath, filename);
  try {
    await fs.promises.stat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    try {
      await fs.promises.writeFile(filePath, content, { flag: "wx" });
    } catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== "EEXIST") {
        throw writeError;
      }
    }
  }
  if (!isMarkdownFileInDirectory(vscode.Uri.file(filePath), vscode.Uri.file(notebookPath))) {
    throw new Error("The daily note must resolve to a file inside the notebook.");
  }
  await showNote(filePath);
}

async function navigateDailyNote(direction: "previous" | "next" | "lastYear") {
  await runNoteCommand(async () => {
    const notebook = findWorkspaceDirectory(configManager.get("notebookPath"));
    const tabInput = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    const inPreview = tabInput instanceof vscode.TabInputWebview &&
      tabInput.viewType.replace(/^mainThreadWebview-/, "") === "markdown.preview";
    // The built-in preview tab does not expose its source URI through the tab API.
    const editor = inPreview
      ? await vscode.commands.executeCommand<vscode.TextEditor | undefined>("markdown.showSource")
      : vscode.window.activeTextEditor;
    const document = editor?.document;
    const fileName = document && path.basename(document.uri.fsPath);
    const date = fileName?.endsWith(".md") ? fileName.slice(0, -3) : undefined;
    if (!notebook || !document || !date || !parseNoteDate(date) ||
        path.relative(notebook.uri.fsPath, path.dirname(document.uri.fsPath)) !== "" ||
        !isMarkdownFileInDirectory(document.uri, notebook.uri)) {
      if (inPreview && document) {
        await vscode.commands.executeCommand("markdown.showPreview", document.uri);
      }
      void vscode.window.showInformationMessage("Open a daily note in the notebook folder first.");
      return;
    }
    let target: vscode.Uri | undefined;
    if (direction === "lastYear") {
      const year = Number(date.slice(0, 4)) - 1;
      const lastYear = String(year).padStart(4, "0") + date.slice(4);
      if (parseNoteDate(lastYear)) {
        const candidate = vscode.Uri.joinPath(notebook.uri, lastYear + ".md");
        if (isMarkdownFileInDirectory(candidate, notebook.uri) &&
            (await fs.promises.stat(candidate.fsPath)).isFile()) {
          target = candidate;
        }
      }
    } else {
      const dates = await listDailyNotes(notebook.uri.fsPath);
      const adjacent = direction === "previous"
        ? dates.reverse().find(candidate => candidate < date)
        : dates.find(candidate => candidate > date);
      if (adjacent) {
        target = vscode.Uri.joinPath(notebook.uri, adjacent + ".md");
      }
    }

    if (inPreview) {
      await vscode.commands.executeCommand("markdown.showPreview", target ?? document.uri);
    } else if (target) {
      await showNote(target.fsPath);
    }
    if (!target) {
      const message = direction === "lastYear"
        ? "There is no daily note for the same date last year."
        : `There is no ${direction} daily note.`;
      void vscode.window.showInformationMessage(message);
    }
  });
}

async function showNote(filePath: string) {
  const document = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(document);
}

async function runNoteCommand(action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    Logger.error(String(error));
    void vscode.window.showErrorMessage(`Could not open the daily note. ${String(error)}`);
  }
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

async function showStatusBarActions() {
  const actions = [
    { label: "Document Stats", key: "showDocumentStats", command: "daily-notes.toggleDocumentStats" },
    { label: "Git Status", key: "showGitStatus", command: "daily-notes.toggleGitStatus" },
    { label: "Auto Commit", key: "autoCommit", command: "daily-notes.toggleAutoCommit" },
    { label: "Auto Sync", key: "autoSync", command: "daily-notes.toggleautoSync" },
  ] as const;
  const choice = await vscode.window.showQuickPick(
    actions.map(action => ({
      ...action,
      description: configManager.get(action.key) ? "On" : "Off",
    })),
    { placeHolder: "Choose a Daily Notes setting to toggle" }
  );
  if (choice) {
    await vscode.commands.executeCommand(choice.command);
  }
}

function toggleStatusVisibility(key: "showDocumentStats" | "showGitStatus") {
  const target = vscode.workspace.workspaceFolders?.length || vscode.workspace.workspaceFile
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  return configManager.update(key, !configManager.get(key), target);
}

function toggleSetting(key: "enableGit" | "autoCommit" | "autoSync") {
  return configManager.update(key, !configManager.get(key), vscode.ConfigurationTarget.Workspace);
}

async function resetAutoCommitInterval() {
  const current = configManager.get("autoCommitInterval");
  const interval = await vscode.window.showInputBox({
    prompt: "Minutes between automatic commits",
    value: String(current === 2 ? 3 : current),
    validateInput: (text) => {
      const minutes = Number(text);
      return isValidCommitInterval(minutes)
        ? undefined : "Enter a whole number between 3 and 600.";
    },
  });
  if (interval !== undefined) {
    await configManager.update("autoCommitInterval", Number(interval), vscode.ConfigurationTarget.Workspace);
  }
}
