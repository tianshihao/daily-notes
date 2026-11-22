import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
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
