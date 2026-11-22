import * as vscode from "vscode";
import { configManager } from "../config_manager/config_manager";
import { Logger } from "../utils/logger";
import { isInDirectory } from "../utils/filesystem";
import { dateTime } from "../utils/datetime";
import { AutoCommitScheduler, isValidCommitInterval } from "./auto_commit";
import { GitService } from "./git_service";

async function saveNotebookEditors(folder: vscode.WorkspaceFolder, signal: AbortSignal): Promise<void> {
  for (const doc of vscode.workspace.textDocuments) {
    signal.throwIfAborted();
    if (doc.isDirty && isInDirectory(doc.uri, folder.uri) && !(await doc.save())) {
      throw new Error(`Could not save ${doc.fileName}. Git operation cancelled.`);
    }
  }
}

/** Owns the Git client and timer for the notebook open in this window. */
export class NotebookGit implements vscode.Disposable {
  private readonly scheduler = new AutoCommitScheduler();
  private session?: { folder: vscode.WorkspaceFolder; git: GitService };
  private interval?: number;

  configure(folder: vscode.WorkspaceFolder | undefined): void {
    if (!folder || !configManager.get("enableGit")) {
      this.dispose();
      return;
    }

    const changed = this.session?.folder.uri.toString() !== folder.uri.toString();
    if (changed) {
      this.dispose();
      const git = new GitService(folder.uri.fsPath, (signal) => saveNotebookEditors(folder, signal));
      this.session = { folder, git };
    }

    const minutes = configManager.get("autoCommitInterval");
    const interval = configManager.get("autoCommit") && isValidCommitInterval(minutes) ? minutes : undefined;
    if (interval !== this.interval) {
      this.interval = interval;
      if (interval === undefined) {
        this.scheduler.dispose();
      } else {
        this.scheduler.schedule(interval, () => this.runAutomatically());
      }
    }

    if (changed && interval !== undefined && configManager.get("autoSync")) {
      void this.runAutomatically();
    }
  }

  async run(action: "commit" | "sync"): Promise<void> {
    const session = this.session;
    if (!session) {
      throw new Error("Open a configured notebook and enable Daily Notes Git first.");
    }

    const prefix = configManager.get("commitMessage") || "Auto commited by Daily Notes";
    const message = `${prefix} at ${dateTime.getTimestamp()}`;
    if (action === "sync" || configManager.get("autoSync")) {
      await session.git.sync(message);
    } else {
      await session.git.commit(message);
    }
  }

  private async runAutomatically(): Promise<void> {
    const session = this.session;
    try {
      await this.run("commit");
    } catch (error) {
      if (session === this.session) {
        const message = `Daily Notes automatic Git operation failed: ${error instanceof Error ? error.message : error}`;
        Logger.error(message);
        void vscode.window.showErrorMessage(message);
      }
    }
  }

  dispose(): void {
    this.scheduler.dispose();
    this.session?.git.dispose();
    this.session = undefined;
    this.interval = undefined;
  }
}
