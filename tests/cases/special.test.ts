import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applySpecial,
  detectSacrifice,
  isBrilliantCandidate,
  isGreatCandidate,
} from "../../src/lib/analysis/special.ts";
import type { EvalInput } from "../../src/lib/analysis/classifier.ts";
import type { ClassifiedMove } from "../../src/lib/analysis/classifier.ts";

const CUSTOM_START =
  "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
const CUSTOM_AFTER_BXF7 =
  "r1bqkbnr/pppp1Bpp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1";

function ev(lines: Array<{ cp?: number; mate?: number }>, bestUci: string | null = null): EvalInput {
  return {
    lines: lines.map((l, i) => ({ multipv: i + 1, depth: 18, pv: [], ...l })),
    bestUci,
    terminal: null,
  };
}

function base(over: Partial<ClassifiedMove> = {}): ClassifiedMove {
  return {
    ply: 1,
    san: "e4",
    uci: "e2e4",
    label: "best",
    epLoss: 0,
    epBefore: 0.5,
    epAfter: 0.5,
    bestUci: "e2e4",
    reason: "Langkah terbaik menurut engine.",
    ...over,
  };
}

describe("detectSacrifice", () => {
  it("detects a real bishop sacrifice (Bxf7+ line)", () => {
    const info = detectSacrifice(CUSTOM_START, CUSTOM_AFTER_BXF7, ["e8f7", "f3g5"], "w");
    assert.equal(info.sacrificed, true);
    assert.equal(info.pieceName, "Gajah");
    assert.ok(info.netLoss >= 2);
  });

  it("ignores a line that wins material (quiet reply)", () => {
    const info = detectSacrifice(CUSTOM_START, CUSTOM_AFTER_BXF7, ["e8d8"], "w");
    assert.equal(info.sacrificed, false);
  });

  it("ignores a balanced rook exchange", () => {
    const before = "r2r2k1/pppqpppp/8/8/4P3/8/PPP2PPP/R2QKR2 w - - 0 1";
    const after = "r2R2k1/pppqpppp/8/8/4P3/8/PPP2PPP/R2QK3 b - - 0 1";
    const info = detectSacrifice(before, after, ["d7d8"], "w");
    assert.equal(info.sacrificed, false);
    assert.equal(info.netLoss, 0);
  });

  it("returns false on empty or illegal PV", () => {
    assert.equal(detectSacrifice(CUSTOM_START, CUSTOM_AFTER_BXF7, [], "w").sacrificed, false);
    assert.equal(
      detectSacrifice(CUSTOM_START, CUSTOM_AFTER_BXF7, ["e2e9"], "w").sacrificed,
      false,
    );
    assert.equal(detectSacrifice("nope", CUSTOM_AFTER_BXF7, ["e8f7"], "w").sacrificed, false);
  });
});

describe("isGreatCandidate", () => {
  const twoLines = (best: number, second: number) =>
    ev([{ cp: best }, { cp: second }]).lines;

  it("needs a 0.15 EP gap to the second line", () => {
    assert.equal(isGreatCandidate("best", 0.6, twoLines(100, -100), "w"), true);
    assert.equal(isGreatCandidate("best", 0.6, twoLines(100, 50), "w"), false);
  });

  it("rejects won positions, non-best labels and missing multipv 2", () => {
    assert.equal(isGreatCandidate("best", 0.951, twoLines(100, -500), "w"), false);
    assert.equal(isGreatCandidate("best", 0.95, twoLines(100, -500), "w"), true);
    assert.equal(isGreatCandidate("excellent", 0.5, twoLines(100, -500), "w"), false);
    assert.equal(isGreatCandidate("best", 0.5, ev([{ cp: 100 }]).lines, "w"), false);
  });
});

describe("isBrilliantCandidate", () => {
  it("requires small loss, fine aftermath and a real sacrifice", () => {
    assert.equal(
      isBrilliantCandidate(0.01, 0.55, 0.5, CUSTOM_START, CUSTOM_AFTER_BXF7, ["e8f7", "f3g5"], "w"),
      true,
    );
  });

  it("rejects big loss, lost aftermath, won-before and no sacrifice", () => {
    const pv = ["e8f7", "f3g5"];
    assert.equal(isBrilliantCandidate(0.03, 0.55, 0.5, CUSTOM_START, CUSTOM_AFTER_BXF7, pv, "w"), false);
    assert.equal(isBrilliantCandidate(0.01, 0.55, 0.4, CUSTOM_START, CUSTOM_AFTER_BXF7, pv, "w"), false);
    assert.equal(isBrilliantCandidate(0.01, 0.91, 0.5, CUSTOM_START, CUSTOM_AFTER_BXF7, pv, "w"), false);
    assert.equal(isBrilliantCandidate(0.01, 0.55, 0.5, CUSTOM_START, CUSTOM_AFTER_BXF7, ["e8d8"], "w"), false);
  });
});

describe("applySpecial", () => {
  const ctx = (over: Record<string, unknown> = {}) => ({
    base: base(),
    before: ev([{ cp: 50 }], "e2e4"),
    after: ev([{ cp: 30 }]),
    fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    prevEpLoss: null as number | null,
    side: "w" as const,
    ...over,
  });

  it("falls back to great when the PV cannot confirm a sacrifice", () => {
    const r = applySpecial({
      ...ctx(),
      base: base({ label: "best", epLoss: 0, epBefore: 0.55, epAfter: 0.5 }),
      before: ev([{ cp: 50 }, { cp: -300 }], "c4f7"),
      after: ev([{ cp: 0 }]),
      fenBefore: CUSTOM_START,
      fenAfter: CUSTOM_AFTER_BXF7,
    });
    assert.equal(r?.label, "great");
  });

  it("prefers brilliant over great when both qualify", () => {
    const r = applySpecial({
      ...ctx(),
      base: base({ label: "best", epLoss: 0.005, epBefore: 0.55, epAfter: 0.5 }),
      before: ev([{ cp: 50 }, { cp: -300 }], "c4f7"),
      after: {
        lines: [{ multipv: 1, depth: 18, pv: ["e8f7", "f3g5"], cp: 0 }],
        bestUci: null,
        terminal: null,
      },
      fenBefore: CUSTOM_START,
      fenAfter: CUSTOM_AFTER_BXF7,
    });
    assert.equal(r?.label, "brilliant");
    assert.equal(r?.needsRecheck, true);
    assert.ok(r?.reason.includes("Gajah"));
  });

  it("assigns great for a lone standout best move", () => {
    const r = applySpecial({
      ...ctx(),
      base: base({ label: "best", epLoss: 0, epBefore: 0.6, epAfter: 0.6 }),
      before: ev([{ cp: 100 }, { cp: -100 }], "e2e4"),
    });
    assert.equal(r?.label, "great");
    assert.equal(r?.needsRecheck, true);
    assert.ok((r?.reason ?? "").toLowerCase().includes("satu-satunya"));
  });

  it("assigns miss only on inaccuracy/mistake after opponent error", () => {
    const miss = applySpecial({
      ...ctx(),
      base: base({ label: "mistake", epLoss: 0.12 }),
      prevEpLoss: 0.15,
    });
    assert.equal(miss?.label, "miss");
    assert.equal(miss?.needsRecheck, false);

    assert.equal(
      applySpecial({ ...ctx(), base: base({ label: "mistake", epLoss: 0.12 }), prevEpLoss: 0.05 }),
      null,
    );
    assert.equal(
      applySpecial({ ...ctx(), base: base({ label: "blunder", epLoss: 0.5 }), prevEpLoss: 0.5 }),
      null,
    );
    assert.equal(
      applySpecial({ ...ctx(), base: base({ label: "best", epLoss: 0 }), prevEpLoss: 0.5 }),
      null,
    );
  });

  it("returns null when nothing special applies", () => {
    assert.equal(applySpecial(ctx()), null);
  });
});
