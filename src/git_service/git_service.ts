import * as vscode from "vscode";
import { configManager } from "../config_manager/config_manager";
import { Logger } from "../utils/logger";
import { isInDirectory } from "../utils/filesystem";
import { dateTime } from "../utils/datetime";
import { AutoCommitScheduler, isValidCommitInterval } from "./auto_commit";
import { GitRepository } from "./git_repository";

async function saveNotebookEditors(folder: vscode.WorkspaceFolder, signal: AbortSignal): Promise<void> {
  for (const doc of vscode.workspace.textDocuments) {
    signal.throwIfAborted();
    if (doc.isDirty && isInDirectory(doc.uri, folder.uri) && !(await doc.save())) {
      throw new Error(`Could not save ${doc.fileName}. Git operation cancelled.`);
    }
  }
}

/** Owns the Git client and timer for the notebook open in this window. */
export class GitService implements vscode.Disposable {
  private readonly scheduler = new AutoCommitScheduler();
  private session?: { folder: vscode.WorkspaceFolder; repository: GitRepository };
  private interval?: number;

  configure(folder: vscode.WorkspaceFolder | undefined): void {
    if (!folder || !configManager.get("enableGit")) {
      this.dispose();
      return;
    }

    const changed = this.session?.folder.uri.toString() !== folder.uri.toString();
    if (changed) {
      this.dispose();
      const repository = new GitRepository(folder.uri.fsPath, (signal) => saveNotebookEditors(folder, signal));
      this.session = { folder, repository };
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

  async commit(): Promise<void> {
    if (configManager.get("autoSync")) {
      return this.sync();
    }
    return this.requireRepository().commit(this.commitMessage());
  }

  async sync(): Promise<void> {
    return this.requireRepository().sync(this.commitMessage());
  }

  private requireRepository(): GitRepository {
    if (!this.session) {
      throw new Error("Open a configured notebook and enable Daily Notes Git first.");
    }
    return this.session.repository;
  }

  private commitMessage(): string {
    const prefix = configManager.get("commitMessage") || "Auto commited by Daily Notes";
    return `${prefix} at ${dateTime.getTimestamp()}`;
  }

  private async runAutomatically(): Promise<void> {
    const session = this.session;
    try {
      await this.commit();
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
    this.session?.repository.dispose();
    this.session = undefined;
    this.interval = undefined;
  }
}
