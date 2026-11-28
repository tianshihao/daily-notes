import * as assert from "node:assert/strict";
import { defaultNoteTemplates, getNotePeriod, renderNoteTemplate } from "../src/notes/period";

suite("Note periods", () => {
  test("uses the Monday date and ISO week number across calendar years", () => {
    const note = getNotePeriod("week", new Date(2027, 0, 1, 12));
    assert.equal(note.filename, "2026-12-28.W53.md");
    assert.equal(note.heading, "Week 53 · 2026-12-28 – 2027-01-03");
    assert.equal(getNotePeriod("week", new Date(2027, 0, 4, 12)).filename, "2027-01-04.W01.md");
  });

  test("uses the first day of each period in the filename", () => {
    const date = new Date(2026, 10, 28, 12);
    assert.equal(getNotePeriod("day", date).filename, "2026-11-28.md");
    assert.equal(getNotePeriod("month", date).filename, "2026-11-01.month.md");
    assert.equal(getNotePeriod("quarter", date).filename, "2026-10-01.quarter.md");
    assert.equal(getNotePeriod("year", date).filename, "2026-01-01.year.md");
  });

  test("renders placeholders without changing whitespace", () => {
    const note = getNotePeriod("day", new Date(2026, 10, 28, 12));
    assert.equal(renderNoteTemplate(defaultNoteTemplates.day, note.variables), "# 2026-11-28 Sat\n");
    assert.equal(
      renderNoteTemplate("{date}.  \n{week}\n\n", note.variables),
      "2026-11-28.  \nW48\n\n"
    );
    const quarter = getNotePeriod("quarter", new Date(2026, 10, 28, 12));
    assert.equal(quarter.variables["date:end"], "2026-12-31");
  });

  test("reports the name and line of an unknown placeholder", () => {
    const { variables } = getNotePeriod("day", new Date(2026, 10, 28, 12));
    assert.throws(
      () => renderNoteTemplate("{date:full}\n{date:mont}", variables),
      /Unknown placeholder \{date:mont\} on line 2/
    );
    assert.throws(() => renderNoteTemplate("{constructor}", variables), /Unknown placeholder \{constructor\}/);
  });
});
