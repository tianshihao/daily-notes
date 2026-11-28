import { createNoteContent, openNoteTemplate } from "./notes/templates";
import { setUpNotebook } from "./notes/notebook_setup";
import { getNotePeriod, type NotePeriod } from "./notes/period";
import { configManager } from "./config_manager/config_manager";
import { GitService } from "./git_service/git_service";
import { Logger } from "./utils/logger";
import { NotebookStatusBar, type NotebookStatusOptions } from "./widget/notebook_status_bar";
import { findWorkspaceDirectory, isMarkdownFileInDirectory } from "./utils/filesystem";
import { isValidCommitInterval, normalizeCommitInterval } from "./git_service/auto_commit";
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
    register("daily-notes.previousDailyNote", () => navigateNote("previous")),
    register("daily-notes.nextDailyNote", () => navigateNote("next")),
    register("daily-notes.openSameDayLastYear", () => navigateNote("lastYear")),
    register("daily-notes.setUpNotebook", setUpNotebook),
    register("daily-notes.openNoteTemplate", () => runNoteCommand(async () => {
      const root = await getNotebookPath();
      if (root) {
        await openNoteTemplate(root);
      }
    }, "open the note template")),
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
    register("daily-notes.syncAndQuit", async () => {
      try {
        await git.sync();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Logger.error(`Sync and Quit failed: ${message}`);
        void vscode.window.showErrorMessage(`Daily Notes could not sync. VS Code will stay open. ${message}`);
        return;
      }
      await vscode.commands.executeCommand("workbench.action.quit");
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
  return setUpNotebook();
}

async function openCurrentNote(period: NotePeriod) {
  const note = getNotePeriod(period, new Date());
  await runNoteCommand(async () => {
    const notebookPath = await getNotebookPath();
    if (notebookPath) {
      await openOrCreateNote(notebookPath, note.filename, () => createNoteContent(notebookPath, period, note.variables));
    }
  });
}

function notePeriodFromFilename(filename: string): NotePeriod | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})(?:\.(W\d{2}|month|quarter|year))?\.md$/.exec(filename);
  const date = match && parseNoteDate(match[1]);
  if (!date || !match) {
    return;
  }
  const suffix = match[2];
  if (!suffix) {
    return "day";
  }
  const period = suffix.startsWith("W") ? "week" : suffix as NotePeriod;
  const localDate = new Date(0);
  localDate.setHours(12, 0, 0, 0);
  localDate.setFullYear(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return getNotePeriod(period, localDate).filename === filename ? period : undefined;
}

async function openOrCreateNote(notebookPath: string, filename: string, createContent: () => Promise<string>) {
  const filePath = path.join(notebookPath, filename);
  try {
    await fs.promises.stat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    try {
      await fs.promises.writeFile(filePath, await createContent(), { flag: "wx" });
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

async function navigateNote(direction: "previous" | "next" | "lastYear") {
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
    const period = fileName && notePeriodFromFilename(fileName);
    if (!notebook || !document || !fileName || !period || (direction === "lastYear" && period !== "day") ||
        path.relative(notebook.uri.fsPath, path.dirname(document.uri.fsPath)) !== "" ||
        !isMarkdownFileInDirectory(document.uri, notebook.uri)) {
      if (inPreview && document) {
        await vscode.commands.executeCommand("markdown.showPreview", document.uri);
      }
      void vscode.window.showInformationMessage(direction === "lastYear"
        ? "Open a daily note in the notebook folder first."
        : "Open a dated note in the notebook folder first.");
      return;
    }
    let target: vscode.Uri | undefined;
    if (direction === "lastYear") {
      const date = fileName.slice(0, -3);
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
      const entries = await fs.promises.readdir(notebook.uri.fsPath, { withFileTypes: true });
      const filenames = entries
        .filter(entry => entry.isFile() && notePeriodFromFilename(entry.name) === period)
        .map(entry => entry.name)
        .sort();
      const adjacent = direction === "previous"
        ? filenames.reverse().find(candidate => candidate < fileName)
        : filenames.find(candidate => candidate > fileName);
      if (adjacent) {
        target = vscode.Uri.joinPath(notebook.uri, adjacent);
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
        : `There is no ${direction} note for this period type.`;
      void vscode.window.showInformationMessage(message);
    }
  });
}

async function showNote(filePath: string) {
  const document = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(document);
}

async function runNoteCommand(action: () => Promise<void>, operation = "open the daily note") {
  try {
    await action();
  } catch (error) {
    Logger.error(String(error));
    void vscode.window.showErrorMessage(`Could not ${operation}. ${String(error)}`);
  }
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
  const current = normalizeCommitInterval(configManager.get("autoCommitInterval"));
  const interval = await vscode.window.showInputBox({
    prompt: "Minutes between automatic commits",
    value: String(current),
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
