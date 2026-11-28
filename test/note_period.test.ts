import * as assert from "node:assert/strict";
import { getNotePeriod } from "../src/notes/period";

suite("Note periods", () => {
  test("uses the Monday date and ISO week number across calendar years", () => {
    assert.deepEqual(getNotePeriod("week", new Date(2027, 0, 1, 12)), {
      filename: "2026-12-28.W53.md",
      heading: "Week 53 · 2026-12-28 – 2027-01-03",
    });
    assert.equal(getNotePeriod("week", new Date(2027, 0, 4, 12)).filename, "2027-01-04.W01.md");
  });

  test("uses the first day of each period in the filename", () => {
    const date = new Date(2026, 10, 28, 12);
    assert.equal(getNotePeriod("day", date).filename, "2026-11-28.md");
    assert.equal(getNotePeriod("month", date).filename, "2026-11-01.month.md");
    assert.equal(getNotePeriod("quarter", date).filename, "2026-10-01.quarter.md");
    assert.equal(getNotePeriod("year", date).filename, "2026-01-01.year.md");
  });
});
