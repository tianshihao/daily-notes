import * as assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { findWorkspaceDirectory, isExistingDirectory, isInDirectory, isMarkdownFileInDirectory } from "../src/utils/filesystem";

suite("Filesystem", () => {
  let root: string;

  setup(() => {
    root = mkdtempSync(path.join(tmpdir(), "daily-notes-filesystem-"));
  });

  teardown(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test("recognizes an existing directory and rejects files and missing paths", async () => {
    const file = path.join(root, "entry.md");
    writeFileSync(file, "");
    assert.equal(await isExistingDirectory(root), true);
    for (const invalid of ["", ".", file, path.join(root, "missing"), path.join(file, "child")]) {
      assert.equal(await isExistingDirectory(invalid), false);
    }
  });

  test("resolves only an existing absolute workspace root", async () => {
    const notebook = path.join(root, "notes");
    const child = path.join(notebook, "archive");
    mkdirSync(child, { recursive: true });
    const folders = [
      { uri: vscode.Uri.file(root), name: "project", index: 0 },
      { uri: vscode.Uri.file(notebook), name: "notes", index: 1 },
    ];
    assert.equal(await findWorkspaceDirectory(notebook, folders), folders[1]);
    assert.equal(await findWorkspaceDirectory(notebook + path.sep, folders), folders[1]);
    assert.equal(await findWorkspaceDirectory(child, folders), undefined);
    assert.equal(await findWorkspaceDirectory(path.relative(process.cwd(), notebook), folders), undefined);
    assert.equal(await findWorkspaceDirectory("", folders), undefined);
    rmSync(notebook, { recursive: true });
    assert.equal(await findWorkspaceDirectory(notebook, folders), undefined);
  });

  test("checks URI origin and complete directory components", () => {
    const directory = vscode.Uri.parse("vscode-remote://ssh-remote+first/project/notes");
    const child = vscode.Uri.joinPath(directory, "archive", "entry.md");
    assert.equal(isInDirectory(directory, directory), true);
    assert.equal(isInDirectory(child, directory), true);
    assert.equal(isInDirectory(directory.with({ path: "/project/notes-old/entry.md" }), directory), false);
    assert.equal(isInDirectory(child.with({ authority: "ssh-remote+second" }), directory), false);
    assert.equal(isInDirectory(child.with({ scheme: "other" }), directory), false);
  });

  test("accepts only files with a final .md extension inside the notebook", async () => {
    const notebook = vscode.Uri.file(path.join(root, "notes"));
    const cases = [
      ["notes/entry.md", true],
      ["notes/archive/meeting.notes.MD", true],
      ["notes/entry.txt", false],
      ["notes/entry.md.bak", false],
      ["notes-old/entry.md", false],
    ] as const;
    for (const [name, expected] of cases) {
      const file = path.join(root, name);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, "");
      assert.equal(await isMarkdownFileInDirectory(vscode.Uri.file(file), notebook), expected, name);
    }
  });

  test("allows a linked notebook root and excludes links to outside directories", async () => {
    const notebook = path.join(root, "notes");
    const outside = path.join(root, "outside");
    mkdirSync(notebook);
    mkdirSync(outside);
    writeFileSync(path.join(notebook, "entry.md"), "");
    writeFileSync(path.join(outside, "entry.md"), "");

    const alias = vscode.Uri.file(path.join(root, "my-notes"));
    symlinkSync(notebook, alias.fsPath, "junction");
    symlinkSync(outside, path.join(notebook, "linked"), "junction");
    assert.equal(await isMarkdownFileInDirectory(vscode.Uri.joinPath(alias, "entry.md"), alias), true);
    assert.equal(await isMarkdownFileInDirectory(vscode.Uri.joinPath(alias, "linked", "entry.md"), alias), false);
  });

  test("excludes a linked Markdown file whose target is outside the notebook", async function () {
    const notebook = vscode.Uri.file(path.join(root, "notes"));
    mkdirSync(notebook.fsPath);
    const outside = path.join(root, "outside.md");
    writeFileSync(outside, "");
    const link = vscode.Uri.joinPath(notebook, "entry.md");
    try {
      symlinkSync(outside, link.fsPath, "file");
    } catch (error) {
      if (process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EPERM") {
        return this.skip();
      }
      throw error;
    }
    assert.equal(await isMarkdownFileInDirectory(link, notebook), false);
  });
});
