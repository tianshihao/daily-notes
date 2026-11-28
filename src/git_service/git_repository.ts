import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { SimpleGit } from "simple-git";

const pendingRemoteKey = (branch: string) => `branch.${branch}.dailyNotesPendingRemote`;

async function currentBranch(git: SimpleGit): Promise<string> {
  const name = (await git.raw("branch", "--show-current")).trim();
  if (!name) {
    throw new Error("Check out a local branch before syncing the notebook.");
  }
  return name;
}

async function listRemotes(git: SimpleGit): Promise<string[]> {
  return (await git.raw("remote")).trimEnd().split("\n").filter(Boolean);
}

async function syncRemotes(git: SimpleGit, name: string) {
  const remotes = await listRemotes(git);
  if (!remotes.length) {
    return { hasUpstream: false, remotes };
  }
  const { value: remote } = await git.getConfig(`branch.${name}.remote`);
  const { value: ref } = await git.getConfig(`branch.${name}.merge`);
  return {
    hasUpstream: !!remote && remotes.includes(remote) && !!ref?.startsWith("refs/heads/"),
    remotes,
  };
}

function validateRemoteUrl(url: string): void {
  const transport = /^([a-z][a-z0-9+.-]*):\/\//i.exec(url)?.[1].toLowerCase();
  if (!url.trim() || /[\u0000\r\n]/.test(url) || url.startsWith("-") || /^[^/:\\]+::/.test(url) ||
      (transport && !["http", "https", "ssh", "git", "file"].includes(transport))) {
    throw new Error("Enter a Git remote URL or repository path.");
  }
}

export class GitRepository {
  private queue = Promise.resolve();
  private readonly lifetime = new AbortController();

  constructor(
    private readonly notebookPath: string,
    private readonly savePendingEdits?: (signal: AbortSignal) => Promise<void>
  ) {}

  commit(message: string): Promise<void> {
    return this.run((git) => this.commitNotebook(git, message));
  }

  async getSyncRemotes(): Promise<{ remotes: string[]; branch?: string }> {
    this.lifetime.signal.throwIfAborted();
    // This local check must stay responsive while a sync is waiting on a remote.
    const git = this.createGit();
    const remotes = await listRemotes(git);
    const result = remotes.length ? { remotes } : { remotes, branch: await currentBranch(git) };
    this.lifetime.signal.throwIfAborted();
    return result;
  }

  setSyncRemote(remote: string, url?: string, expectedBranch?: string): Promise<void> {
    return this.run(async (git) => {
      const name = await currentBranch(git);
      if (expectedBranch !== undefined && name !== expectedBranch) {
        throw new Error("The current notebook branch changed during setup. Enable automatic sync again.");
      }
      const { hasUpstream, remotes } = await syncRemotes(git, name);
      if (hasUpstream) {
        return;
      }
      if (url !== undefined) {
        validateRemoteUrl(url);
        if (remotes.length > 0) {
          throw new Error("The notebook's Git remotes changed during setup. Enable automatic sync again.");
        }
      } else if (!remotes.includes(remote)) {
        throw new Error("The selected Git remote no longer exists.");
      }

      await this.requireCurrentBranch(git, `refs/heads/${name}`);
      if (url !== undefined) {
        await git.raw("remote", "add", "--", remote, url);
      }
      // Direct configuration also works before the branch's first commit.
      await git.raw("config", "--local", "--replace-all", "--", pendingRemoteKey(name), remote);
      await git.raw("config", "--local", "--replace-all", "--", `branch.${name}.merge`, `refs/heads/${name}`);
      await git.raw("config", "--local", "--replace-all", "--", `branch.${name}.remote`, remote);
    }, false);
  }

  sync(message: string): Promise<void> {
    return this.run(async (git) => {
      const name = await currentBranch(git);
      const branch = `refs/heads/${name}`;
      await this.commitNotebook(git, message);
      const tracking = await git.raw(
        "for-each-ref",
        "--format=%(upstream)%00%(upstream:remotename)%00%(upstream:remoteref)",
        branch
      );
      const [upstream, remote, remoteRef] = tracking.trimEnd().split("\0");
      const pending = (await git.getConfig(pendingRemoteKey(name), "local")).value;
      if (!tracking && pending) {
        throw new Error("Create a local commit before syncing the notebook.");
      }
      if (!upstream || !remote || remote === "." || !remoteRef?.startsWith("refs/heads/")) {
        if (!(await git.raw("remote")).trim()) {
          throw new Error("No Git remote is configured. Enable Auto Sync to set one up.");
        }
        throw new Error("Set an upstream branch for the current notebook branch before syncing.");
      }

      const firstSync = remote === pending && remoteRef === branch;
      this.lifetime.signal.throwIfAborted();
      try {
        await git.raw("fetch", "--no-tags", "--", remote, remoteRef);
      } catch (error) {
        const heads = firstSync
          ? await git.raw("ls-remote", "--heads", "--", remote, remoteRef).catch(() => undefined)
          : undefined;
        if (heads !== "") {
          throw error;
        }
        await this.requireCurrentBranch(git, branch);
        // An empty lease permits creation only if the ref is still absent.
        await git.raw("push", `--force-with-lease=${remoteRef}:`, "--", remote, `${branch}:${remoteRef}`);
        await this.finishRemoteSetup(git, name, remote);
        return;
      }
      const remoteTip = (await git.raw("rev-parse", "--verify", upstream)).trim();
      const counts = await git.raw("rev-list", "--left-right", "--count", `${branch}...${remoteTip}`);
      const [ahead, behind] = counts.trim().split(/\s+/).map(Number);
      if (ahead && behind) {
        throw new Error("The notebook branch and its upstream have diverged. Reconcile them in Git before syncing.");
      }

      await this.requireCurrentBranch(git, branch);
      if (behind) {
        await git.raw("merge", "--ff-only", "--no-autostash", remoteTip);
      } else if (ahead) {
        await git.raw("push", "--", remote, `${branch}:${remoteRef}`);
      }
      if (firstSync) {
        await this.finishRemoteSetup(git, name, remote);
      }
    });
  }

  dispose(): void {
    this.lifetime.abort(new Error("The notebook Git service is no longer active."));
  }

  private async requireCurrentBranch(git: SimpleGit, branch: string): Promise<void> {
    const selected = (await git.raw("symbolic-ref", "--quiet", "HEAD")).trim();
    if (selected !== branch) {
      throw new Error("The current notebook branch changed during sync.");
    }
    this.lifetime.signal.throwIfAborted();
  }

  private async finishRemoteSetup(git: SimpleGit, name: string, remote: string): Promise<void> {
    const key = pendingRemoteKey(name);
    if ((await git.getConfig(key, "local")).value === remote) {
      await git.raw("config", "--local", "--unset-all", "--", key);
    }
  }

  private createGit(): SimpleGit {
    const { simpleGit } = require("simple-git") as typeof import("simple-git");
    return simpleGit(this.notebookPath);
  }

  private run<T>(operation: (git: SimpleGit) => Promise<T>, checkWorktree = true): Promise<T> {
    const result = this.queue.then(async () => {
      this.lifetime.signal.throwIfAborted();
      const git = this.createGit();
      if (checkWorktree) {
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
      }
      this.lifetime.signal.throwIfAborted();
      return operation(git);
    });
    // A failed command rejects its caller but does not block later commands.
    this.queue = result.then(() => {}, () => {});
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
