import { createNoteContent, openNoteTemplate } from "./notes/templates";
import { setUpNotebook } from "./notes/notebook_setup";
import { getNotePeriod, notePeriodFromFilename, type NotePeriod } from "./notes/period";
import { configManager } from "./config_manager/config_manager";
import { GitService } from "./git_service/git_service";
import { Logger } from "./utils/logger";
import { NotebookStatusBar, type NotebookStatusOptions } from "./widget/notebook_status_bar";
import { findWorkspaceDirectory, isExistingDirectory, isMarkdownFileInDirectory, matchWorkspaceDirectory } from "./utils/filesystem";
import { isValidCommitInterval, normalizeCommitInterval } from "./git_service/auto_commit";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export async function activate(context: vscode.ExtensionContext) {
  const git = new GitService();
  let statusBar: NotebookStatusBar | undefined;
  let folder: vscode.WorkspaceFolder | undefined;
  let activeNote: vscode.TextDocument | undefined;
  let statusOptions: NotebookStatusOptions;
  let editorCheck = 0;
  let gitCheck: Promise<void> | undefined;

  function clearStatus() {
    if (activeNote) {
      activeNote = undefined;
      statusBar?.render(undefined, statusOptions);
    }
  }

  async function refreshEditor(editor = vscode.window.activeTextEditor) {
    const check = ++editorCheck;
    const document = editor?.document;
    if (!document || !folder || !(statusOptions.showDocumentStats || statusOptions.showGitStatus)) {
      clearStatus();
      return;
    }
    if (document !== activeNote) {
      clearStatus();
    }
    const eligible = await isMarkdownFileInDirectory(document.uri, folder.uri);
    if (check !== editorCheck) {
      return;
    }
    if (!eligible) {
      clearStatus();
      return;
    }
    if (!statusBar) {
      statusBar = new NotebookStatusBar();
      context.subscriptions.push(statusBar);
    }
    activeNote = document;
    statusBar.render(document, statusOptions);
  }

  function configureGit() {
    const selected = folder;
    if (!selected || !configManager.get("enableGit")) {
      gitCheck = undefined;
      git.configure(undefined);
      return;
    }
    const check = isExistingDirectory(selected.uri.fsPath).then(exists => {
      if (check === gitCheck) {
        git.configure(exists ? selected : undefined);
      }
    });
    gitCheck = check;
  }

  async function waitForGit() {
    let pending: Promise<void> | undefined;
    do {
      pending = gitCheck;
      await pending;
    } while (pending !== gitCheck);
  }

  async function runSync(operation: "Sync" | "Sync and Quit" | "Sync after Commit") {
    try {
      await waitForGit();
      await git.sync();
    } catch (error) {
      const detail = Logger.error(`Git / ${operation}`, error);
      if (operation === "Sync and Quit") {
        void vscode.window.showErrorMessage(`Daily Notes could not sync. VS Code will stay open. ${detail}`);
      }
      return;
    }
    if (operation === "Sync and Quit") {
      await vscode.commands.executeCommand("workbench.action.quit");
    } else if (operation === "Sync") {
      void vscode.window.showInformationMessage("Daily Notes sync complete.");
    }
  }

  function configureStatus() {
    statusOptions = {
      notebookName: configManager.get("notebookName"),
      showDocumentStats: configManager.get("showDocumentStats"),
      showGitStatus: configManager.get("showGitStatus"),
      enableGit: configManager.get("enableGit"),
      autoCommit: configManager.get("autoCommit"),
      autoSync: configManager.get("autoSync"),
    };
    if (activeNote && activeNote === vscode.window.activeTextEditor?.document &&
      (statusOptions.showDocumentStats || statusOptions.showGitStatus)) {
      statusBar?.render(activeNote, statusOptions);
      return;
    }
    return refreshEditor();
  }

  async function configureNotebook() {
    const selected = matchWorkspaceDirectory(configManager.get("notebookPath"));
    if (selected?.uri.toString() !== folder?.uri.toString()) {
      git.dispose();
      clearStatus();
    }
    folder = selected;
    configureGit();
    await Promise.all([gitCheck, configureStatus()]);
  }

  const register = vscode.commands.registerCommand;
  context.subscriptions.push(
    Logger,
    git,
    { dispose() {
      editorCheck++;
      gitCheck = undefined;
    } },
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("dailyNotes.notebookPath")) {
        void configureNotebook();
        return;
      }
      const changed = (key: string) => event.affectsConfiguration(`dailyNotes.${key}`);
      if (["enableGit", "autoCommit", "autoCommitInterval", "autoSync"].some(changed)) {
        configureGit();
      }
      if (["notebookName", "showDocumentStats", "showGitStatus", "enableGit", "autoCommit", "autoSync"].some(changed)) {
        void configureStatus();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(configureNotebook),
    vscode.window.onDidChangeActiveTextEditor(refreshEditor),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const { document, contentChanges } = event;
      if (
        contentChanges.length > 0 &&
        statusOptions.showDocumentStats &&
        document === activeNote && document === vscode.window.activeTextEditor?.document
      ) {
        statusBar?.scheduleEdit(event, statusOptions);
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
    register("daily-notes.commit", async () => {
      await waitForGit();
      if (configManager.get("autoSync")) {
        await runSync("Sync after Commit");
        return;
      }
      await git.commit();
    }),
    register("daily-notes.sync", () => runSync("Sync")),
    register("daily-notes.syncAndQuit", () => runSync("Sync and Quit")),
    register("daily-notes.toggleAutoCommit", () => toggleSetting("autoCommit")),
    register("daily-notes.resetAutoCommitInterval", resetAutoCommitInterval),
    register("daily-notes.toggleautoSync", () => toggleSetting("autoSync"))
  );
  await configureNotebook();
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

async function getNotebookPath(): Promise<string | undefined> {
  const configured = await findWorkspaceDirectory(configManager.get("notebookPath"));
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
  if (!(await isMarkdownFileInDirectory(vscode.Uri.file(filePath), vscode.Uri.file(notebookPath)))) {
    throw new Error("The daily note must resolve to a file inside the notebook.");
  }
  await showNote(filePath);
}

async function navigateNote(direction: "previous" | "next" | "lastYear") {
  await runNoteCommand(async () => {
    const notebook = await findWorkspaceDirectory(configManager.get("notebookPath"));
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
        !(await isMarkdownFileInDirectory(document.uri, notebook.uri))) {
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
      const lastYear = String(year).padStart(4, "0") + date.slice(4) + ".md";
      if (notePeriodFromFilename(lastYear, "day")) {
        const candidate = vscode.Uri.joinPath(notebook.uri, lastYear);
        if (await isMarkdownFileInDirectory(candidate, notebook.uri) &&
            (await fs.promises.stat(candidate.fsPath)).isFile()) {
          target = candidate;
        }
      }
    } else {
      const entries = await fs.promises.readdir(notebook.uri.fsPath, { withFileTypes: true });
      const previous = direction === "previous";
      let adjacent: string | undefined;
      for (const entry of entries) {
        const name = entry.name;
        if (!entry.isFile() || (previous ? name >= fileName : name <= fileName)) {
          continue;
        }
        if (adjacent && (previous ? name <= adjacent : name >= adjacent)) {
          continue;
        }
        if (notePeriodFromFilename(name, period)) {
          adjacent = name;
        }
      }
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
  }, "navigate to the note");
}

async function showNote(filePath: string) {
  const document = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(document);
}

async function runNoteCommand(action: () => Promise<void>, operation = "open the note") {
  try {
    await action();
  } catch (error) {
    const detail = Logger.error(`Notes / ${operation.charAt(0).toUpperCase()}${operation.slice(1)}`, error);
    void vscode.window.showErrorMessage(`Could not ${operation}. ${detail}`);
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
