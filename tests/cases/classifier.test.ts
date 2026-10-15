import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CLASSIFIER_VERSION,
  classifyGame,
  classifyMove,
  epForMover,
  labelForLoss,
  moveAccuracy,
} from "../../src/lib/analysis/classifier.ts";
import type { EvalInput, MoveInput } from "../../src/lib/analysis/classifier.ts";

const K = 0.00368208;
/** cp (white POV) that yields exactly the given EP. */
function cpForEp(ep: number): number {
  return Math.log(ep / (1 - ep)) / K;
}

function move(over: Partial<MoveInput> = {}): MoveInput {
  return { ply: 1, san: "e4", uci: "e2e4", color: "w", ...over };
}

function ev(over: Partial<EvalInput> = {}): EvalInput {
  return { lines: [], bestUci: null, terminal: null, ...over };
}

function cpEval(cp: number, bestUci: string | null = "e2e4"): EvalInput {
  return ev({ lines: [{ multipv: 1, cp, depth: 20, pv: [] }], bestUci });
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("labelForLoss", () => {
  const cases: Array<[number, boolean, string]> = [
    [0, false, "best"],
    [0.005, false, "best"],
    [0.0051, false, "excellent"],
    [0.02, false, "excellent"],
    [0.0201, false, "good"],
    [0.05, false, "good"],
    [0.0501, false, "inaccuracy"],
    [0.1, false, "inaccuracy"],
    [0.1001, false, "mistake"],
    [0.2, false, "mistake"],
    [0.2001, false, "blunder"],
    [0.9, false, "blunder"],
    [0.5, true, "best"],
  ];
  for (const [loss, isBest, expected] of cases) {
    it(`loss ${loss} best=${isBest} -> ${expected}`, () => {
      assert.equal(labelForLoss(loss, isBest), expected);
    });
  }
});

describe("classifyMove", () => {
  it("labels a small loss as excellent with computed ep values", () => {
    const before = cpEval(0, "d2d4");
    const after = cpEval(Math.round(cpForEp(0.49) * 100) / 100);
    const c = classifyMove(move(), before, after, START_FEN);
    assert.equal(c.label, "excellent");
    assert.ok(Math.abs(c.epLoss - 0.01) < 1e-4);
    assert.equal(c.epBefore, 0.5);
  });

  it("gives zero loss when the played move equals bestUci", () => {
    const before = cpEval(0, "e2e4");
    const after = cpEval(-300, "e7e5");
    const c = classifyMove(move({ uci: "e2e4" }), before, after, START_FEN);
    assert.equal(c.epLoss, 0);
    assert.equal(c.label, "best");
    assert.equal(c.reason, "Langkah terbaik menurut engine.");
  });

  it("calls a missed mate a blunder", () => {
    const before = ev({
      lines: [{ multipv: 1, mate: 1, depth: 20, pv: [] }],
      bestUci: "d1h5",
    });
    const after = cpEval(0);
    const c = classifyMove(move({ san: "a3", uci: "a2a3" }), before, after, START_FEN);
    assert.equal(c.label, "blunder");
    assert.ok(c.reason.includes("Lebih baik"));
  });

  it("forces Best on the checkmating move", () => {
    const before = cpEval(0, "d1h5");
    const after = ev({ lines: [], bestUci: null, terminal: "checkmate" });
    const c = classifyMove(move({ san: "Qxf7#", uci: "h5f7" }), before, after, START_FEN);
    assert.equal(c.label, "best");
    assert.equal(c.epLoss, 0);
  });

  it("treats stalemate delivery as a big loss", () => {
    const before = cpEval(500, "e2e4");
    const after = ev({ lines: [], bestUci: null, terminal: "stalemate" });
    const c = classifyMove(move({ san: "Qd8", uci: "d1d8" }), before, after, START_FEN);
    assert.equal(c.label, "blunder");
  });

  it("flips perspective for Black", () => {
    // White POV improves +100 -> +200, so Black (to move) worsened:
    // loss = (1-EP(100)) - (1-EP(200)) ≈ 0.068 -> inaccuracy.
    // Without the flip it would read loss 0 -> best.
    const before = cpEval(100, "e7e5");
    const after = cpEval(200, "b1c3");
    const c = classifyMove(
      move({ ply: 2, san: "d6", uci: "d7d6", color: "b" }),
      before,
      after,
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    );
    assert.equal(c.label, "inaccuracy");
    assert.ok(c.epLoss > 0.05 && c.epLoss < 0.1);
  });

  it("writes a factual blunder reason with percent and SAN", () => {
    const before = cpEval(0, "e2e4");
    const after = cpEval(Math.round(cpForEp(0.5 - 0.25) * 100) / 100);
    const c = classifyMove(move({ uci: "a2a3" }), before, after, START_FEN);
    assert.equal(c.label, "blunder");
    assert.ok(c.reason.includes("25%"));
    assert.ok(c.reason.includes("e4"));
  });
});

describe("miss in classifyGame", () => {
  it("converts inaccuracy after an opponent error into miss", () => {
    const moves = [
      move({ ply: 1, san: "a3", uci: "a2a3", color: "w" }),
      move({ ply: 2, san: "d6", uci: "d7d6", color: "b" }),
    ];
    const evals: Record<number, EvalInput> = {
      0: cpEval(0, "e2e4"),
      1: cpEval(-300, "e7e5"),
      2: cpEval(-205, "b8c6"),
    };
    const fens = {
      1: START_FEN,
      2: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    };
    const { classes, summary } = classifyGame(moves, evals, fens);
    assert.equal(classes[0].label, "blunder");
    assert.equal(classes[1].label, "miss");
    assert.ok(classes[1].reason.includes("tidak dimanfaatkan"));
    assert.equal(summary.counts.blunder, 1);
    assert.equal(summary.counts.miss, 1);
  });

  it("does not mark miss without a prior opponent error", () => {
    const moves = [move({ ply: 1, san: "a3", uci: "a2a3", color: "w" })];
    const evals: Record<number, EvalInput> = {
      0: cpEval(0, "e2e4"),
      1: cpEval(-300, "e7e5"),
    };
    const { classes } = classifyGame(moves, evals, { 1: START_FEN });
    assert.equal(classes[0].label, "blunder");
  });
});

describe("moveAccuracy", () => {
  it("is ~100 for zero loss and clamped to [0, 100]", () => {
    assert.ok(moveAccuracy(0.5, 0.5) > 99.9);
    assert.ok(moveAccuracy(0.5, 0.5) <= 100);
    assert.equal(moveAccuracy(0.5, -0.5), 0);
    const mid = moveAccuracy(0.5, 0.0);
    assert.ok(mid > 0 && mid < 100);
  });
});

describe("classifyGame", () => {
  it("summarizes accuracy and counts per player", () => {
    const moves = [
      move({ ply: 1, san: "e4", uci: "e2e4", color: "w" }),
      move({ ply: 2, san: "e5", uci: "e7e5", color: "b" }),
    ];
    const evals: Record<number, EvalInput> = {
      0: cpEval(0, "e2e4"),
      1: cpEval(0, "c7c5"),
      2: cpEval(500, "b1c3"),
    };
    const fens = { 1: START_FEN, 2: START_FEN };
    const { classes, summary } = classifyGame(moves, evals, fens);
    assert.equal(classes.length, 2);
    assert.equal(classes[0].label, "best");
    assert.equal(classes[1].label, "blunder");
    assert.equal(summary.counts.best, 1);
    assert.equal(summary.counts.blunder, 1);
    assert.ok(summary.whiteAccuracy > 95);
    assert.ok(summary.blackAccuracy < 20);
    assert.equal(summary.classifierVersion, CLASSIFIER_VERSION);
  });

  it("handles missing evals defensively", () => {
    const { classes } = classifyGame([move()], {}, {});
    assert.equal(classes.length, 1);
    assert.equal(classes[0].label, "best");
  });
});

describe("epForMover", () => {
  it("maps terminals before engine lines", () => {
    assert.equal(epForMover("checkmate", [], "w"), 1);
    assert.equal(epForMover("stalemate", [], "w"), 0.5);
    assert.equal(epForMover("draw", [], "b"), 0.5);
    assert.equal(epForMover(null, [{ multipv: 1, mate: 2, depth: 9, pv: [] }], "b"), 0);
  });
});
