import { configManager } from "../config_manager/config_manager";
import { simpleGit, SimpleGit, StatusResult } from "simple-git";
import { utils } from "../utils/utils";
import * as fs from "fs";
import * as vscode from "vscode";
import path from "path";

class GitService {
  private static instance?: GitService = undefined;
  private gitP?: SimpleGit = undefined;
  private autoCommitIntervalId?: NodeJS.Timeout = undefined;

  private constructor() {
    const notebookPath = configManager.get("notebookPath");

    if (notebookPath) {
      this.gitP = simpleGit(notebookPath);
    } else {
      this.gitP = undefined;
    }
  }

  static getInstance(): GitService {
    if (!GitService.instance) {
      GitService.instance = new GitService();
    }

    return GitService.instance;
  }

  async init(): Promise<void> {
    vscode.window.showInformationMessage("Initializing git repository...");

    if (this.gitP) {
      try {
        const gitDirectory = await this.gitP.revparse(["--show-toplevel"]);

        if (fs.existsSync(path.join(gitDirectory, ".git"))) {
          vscode.window.showInformationMessage(
            "Git repository already exists."
          );
        } else {
          await this.gitP.init();
          vscode.window.showInformationMessage("Git repository initialized.");
        }
      } catch (err) {
        vscode.window.showErrorMessage("Failed to initialize git repository.");
      }
    }
  }

  async checkIfWorkingDirectoryIsClean(
    statusResult: StatusResult
  ): Promise<boolean> {
    return statusResult.isClean();
  }

  async commit(): Promise<void> {
    vscode.window.showInformationMessage("Checking for changes to commit...");

    // Get commit message from configManager
    const commitMessage =
      configManager.get("commitMessage") || "Auto commited by Daily Notes";

    // Append the timestamp to the commit message
    const commitMessageWithDate = `${commitMessage} at ${utils.getTimestamp()}`;

    if (this.gitP) {
      try {
        const notebookPath = configManager.get("notebookPath");

        // todo tianshihao, will this include files in subdirectories?
        for (const doc of vscode.workspace.textDocuments) {
          if (doc.fileName.startsWith(notebookPath) && doc.isDirty) {
            await doc.save();
          }
        }

        // Check if there are any uncommitted changes
        const status = await this.gitP.status();

        if ((await this.checkIfWorkingDirectoryIsClean(status)) === false) {
          vscode.window.showInformationMessage("Staging changes...");

          // Stage all changes
          await this.gitP.add(".");

          // Commit the staged changes
          await this.gitP.commit(commitMessageWithDate);

          vscode.window.showInformationMessage("Changes committed.");
        } else {
          vscode.window.showInformationMessage("No changes to commit.");
        }
      } catch (err) {
        console.error("Error during commit:", err);
      }
    }

    if (true === configManager.get("autoSync")) {
      await this.sync();
    }
  }

  public scheduleAutoCommit() {
    // min to ms.
    const autoCommitInterval =
      configManager.get("autoCommitInterval") * 60 * 1000;
    const notebookPath = configManager.get("notebookPath");

    // todo tianshihao, move the check of auto commit interval to the utils.
    if (notebookPath && !isNaN(autoCommitInterval)) {
      if (this.autoCommitIntervalId) {
        clearInterval(this.autoCommitIntervalId);
      }

      setTimeout(async () => {
        this.autoCommitIntervalId = setInterval(async () => {
          try {
            console.log("Auto commit...", utils.getTimestamp());
            await this.commit();
          } catch (err) {
            console.error("Error during auto commit:", err);
          }
        }, autoCommitInterval);
      }, autoCommitInterval);
    }
  }

  public stopAutoCommit() {
    if (this.autoCommitIntervalId) {
      clearInterval(this.autoCommitIntervalId);
    }
  }

  // todo tianshihao, the sync takes too long, could be optimized.
  async sync(): Promise<void> {
    vscode.window.showInformationMessage("Syncing changes...");

    if (this.gitP) {
      const remotes = await this.gitP.getRemotes(false);
      if (remotes.length === 0) {
        vscode.window.showErrorMessage("No remote repository found.");
      }

      try {
        // Check the status of the repository
        const status = await this.gitP.status();

        // Check if there are any uncommitted changes
        if ((await this.checkIfWorkingDirectoryIsClean(status)) === false) {
          await this.gitP.add(".");

          // Append the timestamp to the stash message
          const stashMessage = `Stashed by Daily Notes at ${utils.getTimestamp()}`;

          // Stash any local changes with a message
          vscode.window.showInformationMessage("Stashing local changes...");
          await this.gitP.stash(["save", stashMessage]);
        }

        // Check if there are any new commits in the remote repository
        const local = await this.gitP.revparse(["HEAD"]);
        await this.gitP.fetch();
        const remoteHead = await this.gitP.revparse(["origin/master"]);

        if (local !== remoteHead) {
          // Pull the changes from the 'master' branch of the 'origin' remote repository
          vscode.window.showInformationMessage("Pulling changes...");
          await this.gitP.pull(
            "origin",
            "master" /* , { "--rebase": "true" } */
          );
        }

        // If there were any stashed changes, apply them
        if ((await this.checkIfWorkingDirectoryIsClean(status)) === false) {
          vscode.window.showInformationMessage("Applying stashed changes...");
          await this.gitP.stash(["pop"]);
        }

        // Check the status of the repository again
        const statusAfterPull = await this.gitP.status();

        // Check if there are any new commits that need to be pushed
        if (statusAfterPull.ahead > 0) {
          // Push the local changes to the 'master' branch of the 'origin' remote repository
          vscode.window.showInformationMessage("Pushing changes...");
          await this.gitP.push("origin", "master");
        }

        vscode.window.showInformationMessage("Changes synced successfully.");
      } catch (err) {
        vscode.window.showErrorMessage("Failed to sync changes.");
        console.error("Error during sync:", err);
      }
    }
  }
}

export const gitService = GitService.getInstance();
