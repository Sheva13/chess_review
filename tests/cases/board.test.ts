import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { labelSquareStyles } from "../../src/components/Board.tsx";

describe("labelSquareStyles", () => {
  it("tints blunder squares red and chips them solid", () => {
    const s = labelSquareStyles("blunder");
    assert.equal(s.tintBg, "#B8545073");
    assert.equal(s.chipBg, "#B85450");
  });

  it("uses each label's own color", () => {
    assert.equal(labelSquareStyles("brilliant").chipBg, "#2E9D8F");
    assert.ok(labelSquareStyles("best").tintBg.startsWith("#4A7A4E"));
  });
});
