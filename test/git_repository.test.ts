import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { GitRepository } from "../src/git_service/git_repository";
import { addTestRemote, git, initTestRepository } from "./git_fixture";

suite("Git repository", function () {
  this.timeout(20000);

  let directory: string;
  let repository: string;
  let notebook: string;
  let note: string;
  let gitRepository: GitRepository | undefined;

  setup(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "daily-notes-git-"));
    repository = path.join(directory, "project");
    notebook = path.join(repository, "notes");
    note = path.join(notebook, "today.md");
    fs.mkdirSync(notebook, { recursive: true });
    initTestRepository(repository);
    fs.writeFileSync(note, "Original note\n");
    git(repository, "add", "notes/today.md");
    git(repository, "commit", "-qm", "Initial note");
    gitRepository = new GitRepository(notebook);
  });

  teardown(() => {
    try {
      gitRepository?.dispose();
      gitRepository = undefined;
    } finally {
      if (directory) {
        fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
      }
    }
  });

  function advanceUpstream(): void {
    git(repository, "checkout", "-qb", "remote-writer");
    fs.writeFileSync(note, "Remote revision\n");
    git(repository, "commit", "-qam", "Remote revision");
    git(repository, "push", "-q", "backup", "HEAD:main");
    git(repository, "checkout", "-q", "-");
  }

  test("commits notebook changes and preserves the index and worktree of a sibling", async () => {
    const sibling = path.join(repository, "notes-archive");
    fs.mkdirSync(sibling);
    const outside = path.join(sibling, "outside.md");
    fs.writeFileSync(outside, "Staged outside\n");
    git(repository, "add", "notes-archive/outside.md");
    fs.writeFileSync(outside, "Unstaged outside\n");
    fs.writeFileSync(path.join(sibling, "untracked.md"), "Untracked outside\n");
    const before = git(repository, "status", "--porcelain", "-uall", "--", "notes-archive");

    fs.unlinkSync(note);
    fs.writeFileSync(path.join(notebook, "new.md"), "New note\n");
    await gitRepository!.commit("Update notebook");

    assert.equal(git(repository, "ls-tree", "-r", "--name-only", "HEAD"), "notes/new.md");
    assert.equal(git(repository, "status", "--porcelain", "-uall", "--", "notes-archive"), before);
    assert.equal(git(repository, "show", ":notes-archive/outside.md"), "Staged outside");
    assert.equal(fs.readFileSync(outside, "utf8"), "Unstaged outside\n");
    assert.equal(git(repository, "status", "--porcelain", "--", "notes"), "");
  });

  test("syncs the checked-out branch to its differently named upstream on a local remote", async () => {
    const remote = addTestRemote(directory, repository);
    git(repository, "checkout", "-qb", "journal");
    git(repository, "branch", "--set-upstream-to", "backup/main");
    advanceUpstream();
    await gitRepository!.sync("Import upstream changes");
    assert.equal(fs.readFileSync(note, "utf8"), "Remote revision\n");

    fs.writeFileSync(note, "Synced note\n");
    await gitRepository!.sync("Sync notebook");

    assert.equal(git(repository, "branch", "--show-current"), "journal");
    assert.equal(git(remote, "rev-parse", "refs/heads/main"), git(repository, "rev-parse", "HEAD"));
    assert.equal(git(remote, "show", "main:notes/today.md"), "Synced note");
  });

  test("adds a remote without pushing and publishes on the first sync", async () => {
    const remote = path.join(directory, "journal.git");
    git(directory, "init", "-q", "--bare", "--template=", remote);
    assert.deepEqual(await gitRepository!.getSyncRemotes(), { branch: "main", remotes: [] });

    await gitRepository!.setSyncRemote("origin", remote);

    assert.equal(git(repository, "remote", "get-url", "origin"), remote);
    assert.deepEqual(await gitRepository!.getSyncRemotes(), { remotes: ["origin"] });
    assert.equal(git(remote, "for-each-ref", "refs/heads"), "");
    await gitRepository!.sync("Sync notebook");
    assert.equal(git(remote, "show", "main:notes/today.md"), "Original note");

    git(remote, "update-ref", "-d", "refs/heads/main");
    await assert.rejects(gitRepository!.sync("Do not recreate an established upstream"));
    assert.equal(git(remote, "for-each-ref", "refs/heads"), "");
  });

  test("sets up an existing remote for a branch without changing the remote", async () => {
    const remote = addTestRemote(directory, repository);
    git(repository, "branch", "--unset-upstream");
    git(repository, "checkout", "-qb", "journal");
    assert.deepEqual(await gitRepository!.getSyncRemotes(), { remotes: ["backup"] });

    await assert.rejects(gitRepository!.setSyncRemote("backup", undefined, "main"), /branch changed during setup/);
    await gitRepository!.setSyncRemote("backup", undefined, "journal");

    assert.equal(git(repository, "config", "branch.journal.merge"), "refs/heads/journal");
    assert.equal(git(remote, "for-each-ref", "--format=%(refname)", "refs/heads"), "refs/heads/main");
    await gitRepository!.sync("Publish journal branch");
    assert.equal(git(remote, "show", "journal:notes/today.md"), "Original note");
    assert.equal(git(remote, "rev-parse", "main"), git(repository, "rev-parse", "main"));
  });

  test("configures sync before the first local commit", async () => {
    const newNotebook = path.join(directory, "new-notebook");
    const remote = path.join(directory, "new-notebook.git");
    fs.mkdirSync(newNotebook);
    initTestRepository(newNotebook);
    git(directory, "init", "-q", "--bare", "--template=", remote);
    const freshRepository = new GitRepository(newNotebook);
    try {
      fs.writeFileSync(path.join(newNotebook, "first.md"), "First note\n");
      await freshRepository.setSyncRemote("origin", remote);
      assert.deepEqual(await freshRepository.getSyncRemotes(), { remotes: ["origin"] });
      assert.equal(git(newNotebook, "for-each-ref", "refs/heads"), "");
      await freshRepository.sync("Publish first note");
      assert.equal(git(remote, "show", "main:first.md"), "First note");
    } finally {
      freshRepository.dispose();
    }
  });

  test("commits locally when there is no upstream and rejects unsupported remote helpers", async () => {
    fs.writeFileSync(note, "Keep local changes\n");
    await assert.rejects(gitRepository!.sync("Local changes"), /No Git remote is configured/);
    assert.equal(git(repository, "show", "HEAD:notes/today.md"), "Keep local changes");

    await assert.rejects(gitRepository!.setSyncRemote("origin", "ext::not-a-repository"), /Enter a Git remote/);
    assert.equal(git(repository, "remote"), "");
  });

  test("reports divergence and keeps both histories, the working files and the index", async () => {
    const remote = addTestRemote(directory, repository);
    advanceUpstream();
    const upstream = git(remote, "rev-parse", "refs/heads/main");
    fs.writeFileSync(note, "Local revision\n");
    fs.writeFileSync(path.join(repository, "outside.md"), "Staged outside\n");
    git(repository, "add", "outside.md");

    await assert.rejects(gitRepository!.sync("Local revision"));

    assert.equal(git(remote, "rev-parse", "refs/heads/main"), upstream);
    assert.equal(fs.readFileSync(note, "utf8"), "Local revision\n");
    assert.equal(git(repository, "show", "HEAD:notes/today.md"), "Local revision");
    assert.equal(git(repository, "status", "--porcelain"), "A  outside.md");
    assert.equal(git(repository, "stash", "list"), "");
  });

  test("preserves a retained ignored file staged for deletion", async () => {
    const head = git(repository, "rev-parse", "HEAD");
    fs.appendFileSync(path.join(repository, ".git", "info", "exclude"), "\n/notes/today.md\n");
    git(repository, "rm", "--cached", "--", "notes/today.md");
    fs.writeFileSync(note, "This content must remain private\n");
    fs.writeFileSync(path.join(repository, "outside.md"), "Keep staged\n");
    git(repository, "add", "outside.md");

    await assert.rejects(gitRepository!.commit("Notebook changes"), /staged for deletion/);

    assert.equal(git(repository, "rev-parse", "HEAD"), head);
    assert.equal(git(repository, "status", "--porcelain"), "D  notes/today.md\nA  outside.md");
    assert.equal(fs.readFileSync(note, "utf8"), "This content must remain private\n");
  });

  test("keeps local work accessible when fetching the upstream fails", async () => {
    const remote = addTestRemote(directory, repository);
    fs.renameSync(remote, remote + ".offline");
    fs.writeFileSync(note, "Pending offline note\n");

    await assert.rejects(gitRepository!.sync("Keep offline changes"));

    assert.equal(fs.readFileSync(note, "utf8"), "Pending offline note\n");
    assert.equal(git(repository, "show", "HEAD:notes/today.md"), "Pending offline note");
    assert.equal(git(repository, "stash", "list"), "");
  });

  test("cancels queued operations when the notebook session closes", async () => {
    fs.writeFileSync(note, "Pending in the previous notebook\n");
    const head = git(repository, "rev-parse", "HEAD");
    const commit = gitRepository!.commit("Queued commit");
    gitRepository!.dispose();
    await assert.rejects(commit, /no longer active/);
    assert.equal(git(repository, "rev-parse", "HEAD"), head);
  });

  test("checks for a remote without waiting on a queued sync", async () => {
    addTestRemote(directory, repository);
    let signalSave!: () => void;
    let resumeSave!: () => void;
    const saving = new Promise<void>(resolve => { signalSave = resolve; });
    const pendingSave = new Promise<void>(resolve => { resumeSave = resolve; });
    const pausedRepository = new GitRepository(notebook, () => {
      signalSave();
      return pendingSave;
    });
    const sync = pausedRepository.sync("Sync notebook");
    const timeout = new AbortController();
    try {
      await saving;
      const details = await Promise.race([
        pausedRepository.getSyncRemotes(),
        delay(3000, undefined, { signal: timeout.signal }).then(() => {
          throw new Error("Remote check blocked on a queued sync.");
        }),
      ]);
      assert.deepEqual(details, { remotes: ["backup"] });
    } finally {
      timeout.abort();
      resumeSave();
      await sync;
      pausedRepository.dispose();
    }
  });

  test("accepts queued commits after a transient index lock is released", async () => {
    fs.writeFileSync(note, "Retry this change\n");
    const indexLock = path.join(repository, ".git", "index.lock");
    fs.writeFileSync(indexLock, "");
    await assert.rejects(gitRepository!.commit("Locked commit"));
    fs.unlinkSync(indexLock);

    await Promise.all([gitRepository!.commit("Retry"), gitRepository!.commit("Already committed")]);

    assert.equal(git(repository, "rev-list", "--count", "HEAD"), "2");
    assert.equal(git(repository, "show", "HEAD:notes/today.md"), "Retry this change");
    assert.equal(git(repository, "status", "--porcelain"), "");
  });
});
