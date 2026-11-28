import * as assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { parse } from "jsonc-parser";
import { saveNotebookFolderSettings } from "../src/notes/notebook_setup";

suite("Notebook folder settings", () => {
  let directory: string;
  let settings: string;

  setup(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "daily-notes-setup-"));
    settings = path.join(directory, ".vscode", "settings.json");
  });

  teardown(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test("creates folder settings before opening a notebook in a new window", async () => {
    await saveNotebookFolderSettings({ path: directory, name: "Journal" });
    assert.deepEqual(parse(await readFile(settings, "utf8")), {
      "dailyNotes.notebookPath": directory,
      "dailyNotes.notebookName": "Journal",
    });
  });

  test("preserves comments and unrelated folder settings", async () => {
    await mkdir(path.dirname(settings));
    await writeFile(settings, '{\n  // Keep this preference\n  "editor.tabSize": 4,\n}\n');

    await saveNotebookFolderSettings({ path: directory, name: "Journal" });

    const contents = await readFile(settings, "utf8");
    assert.match(contents, /\/\/ Keep this preference/);
    assert.equal(parse(contents)["editor.tabSize"], 4);
    assert.equal(parse(contents)["dailyNotes.notebookName"], "Journal");
  });

  test("leaves invalid settings untouched", async () => {
    const invalid = '{ "editor.tabSize": }';
    await mkdir(path.dirname(settings));
    await writeFile(settings, invalid);
    await assert.rejects(saveNotebookFolderSettings({ path: directory, name: "Journal" }), /valid settings object/);
    assert.equal(await readFile(settings, "utf8"), invalid);
  });
});
