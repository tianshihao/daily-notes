import * as assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { findWorkspaceDirectory, isExistingDirectory, isInDirectory } from "../src/utils/filesystem";

suite("Filesystem", () => {
  let root: string;

  setup(() => {
    root = mkdtempSync(path.join(tmpdir(), "daily-notes-filesystem-"));
  });

  teardown(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test("recognizes an existing directory and rejects files and missing paths", () => {
    const file = path.join(root, "entry.md");
    writeFileSync(file, "");
    assert.equal(isExistingDirectory(root), true);
    for (const invalid of ["", ".", file, path.join(root, "missing"), path.join(file, "child")]) {
      assert.equal(isExistingDirectory(invalid), false);
    }
  });

  test("resolves only an existing absolute workspace root", () => {
    const notebook = path.join(root, "notes");
    const child = path.join(notebook, "archive");
    mkdirSync(child, { recursive: true });
    const folders = [
      { uri: vscode.Uri.file(root), name: "project", index: 0 },
      { uri: vscode.Uri.file(notebook), name: "notes", index: 1 },
    ];
    assert.equal(findWorkspaceDirectory(notebook, folders), folders[1]);
    assert.equal(findWorkspaceDirectory(notebook + path.sep, folders), folders[1]);
    assert.equal(findWorkspaceDirectory(child, folders), undefined);
    assert.equal(findWorkspaceDirectory(path.relative(process.cwd(), notebook), folders), undefined);
    assert.equal(findWorkspaceDirectory("", folders), undefined);
    rmSync(notebook, { recursive: true });
    assert.equal(findWorkspaceDirectory(notebook, folders), undefined);
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
});
