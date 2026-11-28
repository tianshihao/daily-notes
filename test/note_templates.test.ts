import * as assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { defaultNoteTemplates, getNotePeriod, notePeriods, type NotePeriod } from "../src/notes/period";
import { createNoteContent } from "../src/notes/templates";

suite("Default note template parity", () => {
  test("creates byte-identical Markdown with all default templates enabled or disabled", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "daily-notes-template-parity-"));
    const config = vscode.workspace.getConfiguration("dailyNotes");
    const target = vscode.ConfigurationTarget.Workspace;
    const original = config.inspect("templates")?.workspaceValue;
    const paths: Partial<Record<NotePeriod, string>> = {};
    const date = new Date(2026, 10, 28, 12);
    const expected = {
      day: "# 2026-11-28 Sat\n",
      week: "# Week 48 · 2026-11-23 – 2026-11-29\n",
      month: "# 2026-11\n",
      quarter: "# 2026 Q4\n",
      year: "# 2026\n",
    };

    try {
      await config.update("templates", {}, target);
      for (const directory of ["without-templates", "with-templates", "templates"]) {
        await mkdir(path.join(root, directory));
      }
      for (const period of notePeriods) {
        const note = getNotePeriod(period, date);
        const templatePath = `templates/${period}.md`;
        paths[period] = templatePath;
        await writeFile(path.join(root, templatePath), defaultNoteTemplates[period]);
        await writeFile(
          path.join(root, "without-templates", note.filename),
          await createNoteContent(root, period, note.variables)
        );
      }

      await config.update("templates", paths, target);
      for (const period of notePeriods) {
        const note = getNotePeriod(period, date);
        const filename = path.join(root, "with-templates", note.filename);
        await writeFile(filename, await createNoteContent(root, period, note.variables));
        const generated = await readFile(filename);
        const originalNote = await readFile(path.join(root, "without-templates", note.filename));
        assert.equal(originalNote.toString("utf8"), expected[period]);
        assert.deepEqual(generated, originalNote, period);
        assert.equal(createHash("md5").update(generated).digest("hex"),
          createHash("md5").update(originalNote).digest("hex"), period);
      }
    } finally {
      await config.update("templates", original, target);
      await rm(root, { recursive: true, force: true });
    }
  });
});
