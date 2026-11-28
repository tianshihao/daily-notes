import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import { getNotePeriod } from "../src/notes/period";
import { DocumentAnalyzer } from "../src/document_analysis/document_analyzer";

suite("Document analysis", () => {
  const analyzer = new DocumentAnalyzer();

  function openNote(content: string) {
    return vscode.workspace.openTextDocument({ content, language: "markdown" });
  }

  async function editNote(document: vscode.TextDocument, ...changes: vscode.TextEdit[]) {
    const edit = new vscode.WorkspaceEdit();
    edit.set(document.uri, changes);
    assert.ok(await vscode.workspace.applyEdit(edit));
  }

  function trackChanges(document: vscode.TextDocument, tracked: DocumentAnalyzer) {
    return vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document === document) {
        tracked.recordChanges(event);
      }
    });
  }

  test("counts each Han character and each written word in mixed notes", async () => {
    assert.equal(analyzer.analyze(await openNote("Meeting notes: 讨论")).wordCount, 4);
    assert.equal(analyzer.analyze(await openNote("𠮷野 café don't 2026")).wordCount, 4);
  });

  test("counts the contents of HTML elements and ignores their tags and attributes", async () => {
    const document = await openNote('<span lang="en">two words</span> 讨论');
    assert.equal(analyzer.analyze(document).wordCount, 4);
  });

  test("detects the language of the note, including English with an isolated Han character", async () => {
    const samples = [
      ["en", "Today I learned how to write the character 字. I will practice it in my notebook tomorrow."],
      ["zh", "今天我们一起讨论了周末的计划，准备去公园散步，然后找一家安静的书店看书。"],
      ["ja", "今日は友達と公園を散歩しました。そのあと、小さな喫茶店でゆっくり本を読みました。"],
    ] as const;
    for (const [language, content] of samples) {
      assert.equal(analyzer.analyze(await openNote(content)).language, language, content);
    }
  });

  test("leaves the language undetermined until a note contains prose", async () => {
    assert.deepEqual(analyzer.analyze(await openNote("")), { wordCount: 0, language: "und" });
    const newDailyNote = await openNote(`# ${getNotePeriod("day", new Date(2026, 10, 28, 12)).heading}\n`);
    assert.equal(analyzer.analyze(newDailyNote).language, "und");
  });

  test("reuses results for the same document version and updates after an edit", async () => {
    const document = await openNote("First entry");
    const before = analyzer.analyze(document);
    assert.equal(before.wordCount, 2);
    assert.equal(analyzer.analyze(document), before);

    await editNote(document, vscode.TextEdit.insert(new vscode.Position(0, 0), "Another "));
    assert.equal(analyzer.analyze(document).wordCount, 3);
  });

  test("matches a fresh analysis across batched edits and multiline HTML boundaries", async () => {
    const document = await openNote('Today\n<span\n title="draft">notes</span>\nEnd');
    const tracked = new DocumentAnalyzer();
    assert.equal(tracked.analyze(document).wordCount, 3);
    const listener = trackChanges(document, tracked);
    try {
      await editNote(document,
        vscode.TextEdit.insert(document.lineAt(0).range.end, "\n新"),
        vscode.TextEdit.insert(document.lineAt(3).range.end, " of day"));

      // A second edit arrives before the status bar renders the first one.
      await editNote(document, vscode.TextEdit.delete(new vscode.Range(0, 5, 1, 0)));
      assert.deepEqual(tracked.analyze(document), new DocumentAnalyzer().analyze(document));
      assert.equal(tracked.analyze(document).wordCount, 6);

      // Removing the opening bracket also changes which words count on the following line.
      await editNote(document, vscode.TextEdit.delete(new vscode.Range(1, 0, 1, 1)));
      const revealed = tracked.analyze(document);
      assert.deepEqual(revealed, new DocumentAnalyzer().analyze(document));
      assert.ok(revealed.wordCount > 6);
    } finally {
      listener.dispose();
    }
  });

  test("resumes at the current version after changes were missed in another editor", async () => {
    const document = await openNote("First entry");
    const tracked = new DocumentAnalyzer();
    tracked.analyze(document);
    tracked.analyze(await openNote("Another note"));

    await editNote(document, vscode.TextEdit.insert(new vscode.Position(0, 0), "昨天\n"));

    const listener = trackChanges(document, tracked);
    try {
      await editNote(document, vscode.TextEdit.insert(document.lineAt(1).range.end, " today"));
      const result = tracked.analyze(document);
      assert.deepEqual(result, new DocumentAnalyzer().analyze(document));
      assert.equal(result.wordCount, 5);
    } finally {
      listener.dispose();
    }
  });

  test("counts edits inside words and around supplementary Han in a long unbroken line", async () => {
    const prefix = "汉".repeat(10000) + "𠮷";
    const document = await openNote(prefix + "can t𠮷尾");
    const tracked = new DocumentAnalyzer();
    const initial = tracked.analyze(document).wordCount;
    const listener = trackChanges(document, tracked);
    async function replace(start: number, end: number, text: string, difference: number) {
      await editNote(document, vscode.TextEdit.replace(new vscode.Range(0, prefix.length + start, 0, prefix.length + end), text));
      const result = tracked.analyze(document);
      assert.equal(result.wordCount, initial + difference);
      assert.deepEqual(result, new DocumentAnalyzer().analyze(document));
    }
    try {
      await replace(3, 4, "'", -1);       // can t → can't
      await replace(3, 4, "𠮷", 1);      // can't → can𠮷t
      await replace(3, 5, "", -1);        // can𠮷t → cant
      await replace(1, 2, "a\u0301", -1); // combining accent inside the word
      await replace(0, 0, "<b>", -1);    // HTML outside the plain-text fast path
    } finally {
      listener.dispose();
    }
  });
});
