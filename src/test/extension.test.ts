import * as assert from "assert";
import { textService } from "../text_service/text_service";

suite("Notebook word count", () => {
  test("counts English words and Chinese characters in the same note", () => {
    assert.strictEqual(textService.countWords("Meeting notes: 讨论", "today.md"), 4);
  });
});
