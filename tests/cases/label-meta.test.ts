import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LABEL_META, tint } from "../../src/components/MoveLabel.tsx";
import type { MoveLabel } from "../../src/types/index.ts";

const ALL_LABELS: MoveLabel[] = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "book",
  "inaccuracy",
  "mistake",
  "miss",
  "blunder",
];

describe("LABEL_META", () => {
  it("covers all 10 labels with a color and name", () => {
    assert.equal(Object.keys(LABEL_META).length, 10);
    for (const label of ALL_LABELS) {
      const meta = LABEL_META[label];
      assert.match(meta.color, /^#[0-9A-Fa-f]{6}$/, `${label} needs a hex color`);
      assert.ok(meta.name.length > 0, `${label} needs a name`);
    }
  });

  it("uses classic text glyphs where chess annotation exists", () => {
    const symbols: Partial<Record<MoveLabel, string | null>> = {
      brilliant: "!!",
      great: "!",
      inaccuracy: "?!",
      mistake: "?",
      blunder: "??",
    };
    for (const [label, symbol] of Object.entries(symbols)) {
      const meta = LABEL_META[label as MoveLabel];
      assert.equal(meta.symbol, symbol);
      assert.equal(meta.icon, null);
    }
  });

  it("uses icons for the other five labels", () => {
    for (const label of ["best", "excellent", "good", "book", "miss"] as MoveLabel[]) {
      const meta = LABEL_META[label];
      assert.equal(meta.symbol, null);
      assert.ok(meta.icon !== null, `${label} needs an icon`);
    }
  });

  it("tint adds 14% alpha to a hex color", () => {
    assert.equal(tint("#B85450"), "#B8545024");
  });
});
