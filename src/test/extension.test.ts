import * as assert from "assert";
import { getDocumentStats } from "../text_service/text_service";

suite("Notebook word count", () => {
  test("counts English words and Chinese characters in the same note", () => {
    assert.deepStrictEqual(getDocumentStats("Meeting notes: 讨论"), { wordCount: 4, language: "zh" });
  });
});
