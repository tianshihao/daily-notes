import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";

export class GitService {
  private queue = Promise.resolve();
  private readonly lifetime = new AbortController();

  constructor(
    private readonly notebookPath: string,
    private readonly savePendingEdits?: (signal: AbortSignal) => Promise<void>
  ) {}

  commit(message: string): Promise<void> {
    return this.run((git) => this.commitNotebook(git, message));
  }

  sync(message: string): Promise<void> {
    return this.run(async (git) => {
      const name = (await git.raw("branch", "--show-current")).trim();
      if (!name) {
        throw new Error("Check out a local branch before syncing the notebook.");
      }
      const branch = `refs/heads/${name}`;
      await this.commitNotebook(git, message);
      const tracking = await git.raw(
        "for-each-ref",
        "--format=%(upstream)%00%(upstream:remotename)%00%(upstream:remoteref)",
        branch
      );
      const [upstream, remote, remoteRef] = tracking.trimEnd().split("\0");
      if (!upstream || !remote || !remoteRef?.startsWith("refs/heads/")) {
        throw new Error("Set an upstream branch for the current notebook branch before syncing.");
      }

      this.lifetime.signal.throwIfAborted();
      await git.raw("fetch", "--no-tags", "--", remote, remoteRef);
      const remoteTip = (await git.raw("rev-parse", "--verify", upstream)).trim();
      const counts = await git.raw("rev-list", "--left-right", "--count", `${branch}...${remoteTip}`);
      const [ahead, behind] = counts.trim().split(/\s+/).map(Number);
      if (ahead && behind) {
        throw new Error("The notebook branch and its upstream have diverged. Reconcile them in Git before syncing.");
      }

      const currentBranch = (await git.raw("symbolic-ref", "--quiet", "HEAD")).trim();
      if (currentBranch !== branch) {
        throw new Error("The current notebook branch changed during sync.");
      }
      this.lifetime.signal.throwIfAborted();
      if (behind) {
        await git.raw("merge", "--ff-only", "--no-autostash", remoteTip);
      } else if (ahead) {
        await git.raw("push", "--", remote, `${branch}:${remoteRef}`);
      }
    });
  }

  dispose(): void {
    this.lifetime.abort(new Error("The notebook Git service is no longer active."));
  }

  private run(operation: (git: SimpleGit) => Promise<void>): Promise<void> {
    const result = this.queue.then(async () => {
      this.lifetime.signal.throwIfAborted();
      const git = simpleGit(this.notebookPath);
      const gitDir = (await git.raw("rev-parse", "--absolute-git-dir")).trimEnd();
      const files = await readdir(gitDir);
      const busy = ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply", "sequencer"];
      const hasConflicts = await git.raw("ls-files", "--unmerged", "-z", "--", ":/");
      if (busy.some((name) => files.includes(name)) || hasConflicts) {
        throw new Error("Finish the current Git operation and resolve conflicts before committing or syncing notes.");
      }
      this.lifetime.signal.throwIfAborted();
      // Save inside the queue so an editor write cannot overlap a previous sync.
      await this.savePendingEdits?.(this.lifetime.signal);
      this.lifetime.signal.throwIfAborted();
      await operation(git);
    });
    // A failed command rejects its caller but does not block later commands.
    this.queue = result.catch(() => {});
    return result;
  }

  private async commitNotebook(git: SimpleGit, message: string): Promise<void> {
    const changes = await git.raw("status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ".");
    if (!changes) {
      return;
    }
    this.lifetime.signal.throwIfAborted();
    await git.raw("add", "-A", "--", ".");
    if (await git.raw("diff", "--cached", "--name-only", "-z", "--", ".")) {
      await this.checkStagedDeletions(git);
      this.lifetime.signal.throwIfAborted();
      // --only leaves staged files outside a nested notebook in the index.
      await git.raw("commit", "--only", "-m", message, "--", ".");
    }
  }

  private async checkStagedDeletions(git: SimpleGit): Promise<void> {
    // A path-limited commit reads the worktree. An ignored file can still be on
    // disk after git rm --cached, even though the index records a deletion.
    const output = await git.raw(
      "diff", "--cached", "--diff-filter=D", "--no-renames", "--name-only",
      "--relative", "-z", "--", "."
    );
    for (const name of output.split("\0").filter(Boolean)) {
      const file = join(this.notebookPath, name);
      try {
        if ((await lstat(file)).isDirectory()) {
          // A file replaced by an ordinary directory can be committed safely.
          // A retained submodule directory can instead be staged as a gitlink.
          await lstat(join(file, ".git"));
        }
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "ENOTDIR") {
          continue;
        }
        throw error;
      }
      throw new Error(
        `"${name}" is staged for deletion but still exists on disk. Review the staged changes ` +
        "and commit the deletion in Git before retrying the notebook command."
      );
    }
  }
}
