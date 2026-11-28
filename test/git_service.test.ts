import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { configManager } from "../src/config_manager/config_manager";
import type { IConfigurationKeyTypeMap } from "../src/config_manager/model";
import { GitService } from "../src/git_service/git_service";
import { addTestRemote, git, initTestRepository } from "./git_fixture";

suite("Git service", function () {
  this.timeout(20000);

  const originalGet = configManager.get;
  let directory: string;
  let settings: IConfigurationKeyTypeMap;
  let service: GitService;
  let documents: vscode.TextDocument[];

  setup(() => {
    directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "daily-notes-service-")));
    settings = {
      notebookName: "", notebookPath: "", templates: {}, showDocumentStats: true, showGitStatus: true, enableGit: true, autoCommit: false,
      autoCommitInterval: 10, autoSync: false, commitMessage: "Save note",
    };
    configManager.get = (key) => settings[key];
    service = new GitService();
    documents = [];
  });

  teardown(async () => {
    service.dispose();
    configManager.get = originalGet;
    try {
      for (const doc of documents) {
        if (doc.isDirty) {
          await doc.save();
        }
      }
      const uris = new Set(documents.map((doc) => doc.uri.toString()));
      const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs).filter(
        (tab) => tab.input instanceof vscode.TabInputText && uris.has(tab.input.uri.toString())
      );
      if (tabs.length) {
        await vscode.window.tabGroups.close(tabs);
      }
    } finally {
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  function createFolder(name: string): vscode.WorkspaceFolder {
    const uri = vscode.Uri.file(path.join(directory, name));
    fs.mkdirSync(uri.fsPath);
    fs.writeFileSync(path.join(uri.fsPath, "entry.md"), "Original\n");
    return { uri, name, index: 0 };
  }

  function initNotebook(folder: vscode.WorkspaceFolder): void {
    initTestRepository(folder.uri.fsPath);
    git(folder.uri.fsPath, "add", "entry.md");
    git(folder.uri.fsPath, "commit", "-qm", "Initial note");
  }

  async function openNote(folder: vscode.WorkspaceFolder): Promise<vscode.TextDocument> {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, "entry.md"));
    documents.push(doc);
    await vscode.window.showTextDocument(doc, { preview: false });
    return doc;
  }

  async function editNotes(notes: vscode.TextDocument[]): Promise<void> {
    const edits = new vscode.WorkspaceEdit();
    for (const doc of notes) {
      edits.insert(doc.uri, new vscode.Position(0, 0), "Edited\n");
    }
    assert.equal(await vscode.workspace.applyEdit(edits), true);
    for (const doc of notes) {
      assert.equal(doc.isDirty, true);
    }
  }

  test("switches repositories and saves only dirty editors inside the new notebook", async () => {
    const first = createFolder("first");
    const second = createFolder("notes");
    const sibling = createFolder("notes-archive");
    initNotebook(first);
    initNotebook(second);
    const firstHead = git(first.uri.fsPath, "rev-parse", "HEAD");
    service.configure(first);
    fs.writeFileSync(path.join(first.uri.fsPath, "pending.md"), "Pending on disk\n");
    service.configure(second);

    const previous = await openNote(first);
    const outside = await openNote(sibling);
    const current = await openNote(second);
    await editNotes([previous, outside, current]);
    await service.commit();

    assert.equal(current.isDirty, false);
    assert.equal(git(second.uri.fsPath, "show", "HEAD:entry.md"), current.getText().trimEnd());
    assert.equal(git(first.uri.fsPath, "rev-parse", "HEAD"), firstHead);
    for (const doc of [previous, outside]) {
      assert.equal(doc.isDirty, true);
      assert.equal(fs.readFileSync(doc.uri.fsPath, "utf8"), "Original\n");
    }
  });

  test("syncs on request with auto-sync off and syncs each commit with it on", async () => {
    const folder = createFolder("notes");
    const repository = folder.uri.fsPath;
    const note = path.join(repository, "entry.md");
    initNotebook(folder);
    const remote = addTestRemote(directory, repository);
    service.configure(folder);

    fs.writeFileSync(note, "Local note\n");
    await service.commit();
    assert.equal(git(repository, "show", "HEAD:entry.md"), "Local note");
    assert.equal(git(remote, "show", "main:entry.md"), "Original");

    await service.sync();
    assert.equal(git(remote, "show", "main:entry.md"), "Local note");

    settings.autoSync = true;
    service.configure(folder);
    fs.writeFileSync(note, "Automatic sync\n");
    await service.commit();
    assert.equal(git(remote, "show", "main:entry.md"), "Automatic sync");
  });

  for (const change of ["disable Git", "clear notebook"] as const) {
    test(`blocks commits and leaves the editor unsaved after ${change}`, async () => {
      const folder = createFolder("notes");
      initNotebook(folder);
      const originalHead = git(folder.uri.fsPath, "rev-parse", "HEAD");
      service.configure(folder);
      const doc = await openNote(folder);
      await editNotes([doc]);

      if (change === "disable Git") {
        settings.enableGit = false;
        service.configure(folder);
      } else {
        service.configure(undefined);
      }

      await assert.rejects(service.commit(), /enable Daily Notes Git/i);
      assert.equal(doc.isDirty, true);
      assert.equal(fs.readFileSync(doc.uri.fsPath, "utf8"), "Original\n");
      assert.equal(git(folder.uri.fsPath, "rev-parse", "HEAD"), originalHead);
    });
  }
});
