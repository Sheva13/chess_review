import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyUciMoves,
  buildUci,
  isPawnPromotion,
  legalTargets,
  pieceAt,
  sideToMove,
} from "../../src/lib/chess/index.ts";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("buildUci", () => {
  it("joins squares with optional promotion", () => {
    assert.equal(buildUci("e2", "e4"), "e2e4");
    assert.equal(buildUci("e7", "e8", "q"), "e7e8q");
  });
});

describe("applyUciMoves", () => {
  it("returns the input for an empty line", () => {
    assert.equal(applyUciMoves(START, []), START);
  });

  it("replays a legal line", () => {
    assert.equal(
      applyUciMoves(START, ["e2e4", "e7e5"]),
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    );
  });

  it("throws on the first illegal move", () => {
    assert.throws(() => applyUciMoves(START, ["e2e4", "e2e4"]));
    assert.throws(() => applyUciMoves("not a fen", ["e2e4"]));
  });
});

describe("pieceAt", () => {
  it("reads pieces and empty squares", () => {
    assert.deepEqual(pieceAt(START, "e2"), { type: "p", color: "w" });
    assert.deepEqual(pieceAt(START, "b8"), { type: "n", color: "b" });
    assert.equal(pieceAt(START, "e4"), null);
    assert.equal(pieceAt(START, "z9"), null);
    assert.equal(pieceAt("nope", "e2"), null);
  });
});

describe("sideToMove", () => {
  it("reads the turn field", () => {
    assert.equal(sideToMove(START), "w");
    assert.equal(
      sideToMove("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"),
      "b",
    );
    assert.equal(sideToMove("garbage"), "w");
  });
});

describe("legalTargets", () => {
  it("lists pawn and knight moves from the start", () => {
    assert.deepEqual(legalTargets(START, "e2"), ["e3", "e4"]);
    assert.deepEqual(legalTargets(START, "g1"), ["f3", "h3"]);
  });

  it("is empty for empty squares, enemy pieces and bad input", () => {
    assert.deepEqual(legalTargets(START, "e4"), []);
    assert.deepEqual(legalTargets(START, "e7"), []);
    assert.deepEqual(legalTargets(START, "z9"), []);
    assert.deepEqual(legalTargets("nope", "e2"), []);
  });

  it("includes captures", () => {
    const fen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1";
    assert.ok(legalTargets(fen, "e4").includes("d5"));
  });
});

describe("isPawnPromotion", () => {
  it("detects pawns reaching the last rank", () => {
    const fen = "8/4P3/8/8/8/8/8/4K2k w - - 0 1";
    assert.equal(isPawnPromotion(fen, "e7", "e8"), true);
    assert.equal(isPawnPromotion(fen, "e7", "e7"), false);
  });

  it("rejects non-pawns and normal moves", () => {
    assert.equal(isPawnPromotion(START, "g1", "f3"), false);
    assert.equal(isPawnPromotion(START, "e2", "e4"), false);
    assert.equal(isPawnPromotion("nope", "e7", "e8"), false);
  });
});
