import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePgn, validateFenString, getFenAtPly, uciToSanLine, getCheckArrow, buildMoveArrows, hashPgn, parsePgnGame } from "../../src/lib/chess/index.ts";

const fixtures = join(import.meta.dirname, "..", "fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(fixtures, name), "utf-8");
}

describe("parsePgn", () => {
  it("parses a simple valid game", () => {
    const pgn = loadFixture("simple-game.pgn");
    const game = parsePgn(pgn);

    assert.equal(game.headers.white, "Player A");
    assert.equal(game.headers.black, "Player B");
    assert.equal(game.headers.result, "1-0");
    assert.equal(game.plyCount, 20);
    assert.equal(game.moves[0].san, "e4");
    assert.equal(game.moves[0].color, "w");
    assert.equal(game.moves[1].san, "e5");
    assert.equal(game.moves[1].color, "b");
    assert.equal(game.moves[19].san, "Nbd7");
  });

  it("each move has correct fenBefore and fenAfter", () => {
    const pgn = loadFixture("simple-game.pgn");
    const game = parsePgn(pgn);

    assert.equal(game.moves[0].fenBefore, game.startFen);
    assert.notEqual(game.moves[0].fenBefore, game.moves[0].fenAfter);
    // fenAfter of move N should equal fenBefore of move N+1
    for (let i = 0; i < game.moves.length - 1; i++) {
      assert.equal(game.moves[i].fenAfter, game.moves[i + 1].fenBefore);
    }
  });

  it("parses special moves: castling for both sides", () => {
    const pgn = loadFixture("special-moves.pgn");
    const game = parsePgn(pgn);

    assert.ok(game.plyCount > 0);
    const castles = game.moves.filter((m) => m.san === "O-O");
    assert.ok(castles.length >= 2, "should have at least 2 castling moves");
    assert.equal(castles[0].color, "w");
    assert.equal(castles[1].color, "b");
  });

  it("parses game with custom starting FEN (SetUp header)", () => {
    const pgn = loadFixture("custom-fen.pgn");
    const game = parsePgn(pgn);

    assert.equal(game.headers.setUp, "1");
    assert.equal(
      game.startFen,
      "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    );
    assert.equal(game.moves[0].san, "Bxf7+");
    assert.equal(game.moves[0].fenBefore, game.startFen);
  });

  it("throws on empty PGN", () => {
    assert.throws(
      () => parsePgn(""),
      (err: Error & { code: string }) => err.code === "INVALID_PGN",
    );
  });

  it("throws on garbage PGN", () => {
    assert.throws(
      () => parsePgn("this is not a pgn at all"),
      (err: Error & { code: string }) => err.code === "INVALID_PGN",
    );
  });
});

describe("validateFenString", () => {
  it("accepts the standard starting position", () => {
    const result = validateFenString(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
    assert.equal(result.ok, true);
  });

  it("rejects an invalid FEN", () => {
    const result = validateFenString("not a fen");
    assert.equal(result.ok, false);
    assert.ok(result.error);
  });

  it("rejects a FEN with no kings", () => {
    const result = validateFenString("8/8/8/8/8/8/8/8 w - - 0 1");
    assert.equal(result.ok, false);
  });
});

describe("uciToSanLine", () => {
  it("converts a UCI line to SAN", () => {
    const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    assert.deepEqual(uciToSanLine(start, ["e2e4", "e7e5", "g1f3"]), [
      "e4",
      "e5",
      "Nf3",
    ]);
  });

  it("stops at the first illegal move", () => {
    const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    assert.deepEqual(uciToSanLine(start, ["e2e4", "a7a6", "e2e4"]), ["e4", "a6"]);
  });
});

describe("getCheckArrow", () => {
  it("points from checker to king on fool's mate", () => {
    assert.deepEqual(
      getCheckArrow("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 0 3"),
      { from: "h4", to: "e1" },
    );
  });

  it("returns null when not in check", () => {
    assert.equal(
      getCheckArrow("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
      null,
    );
  });

  it("returns null for invalid FEN", () => {
    assert.equal(getCheckArrow("not a fen"), null);
  });
});

describe("buildMoveArrows", () => {
  it("orders last, best, check with fixed colors", () => {
    assert.deepEqual(
      buildMoveArrows({
        lastMove: { from: "e2", to: "e4" },
        bestUci: "d2d4",
        check: { from: "h4", to: "e1" },
      }),
      [
        { from: "e2", to: "e4", color: "#EAB308" },
        { from: "d2", to: "d4", color: "#81B64C" },
        { from: "h4", to: "e1", color: "#E03131" },
      ],
    );
  });

  it("skips the best arrow when it duplicates the played move", () => {
    assert.deepEqual(
      buildMoveArrows({ lastMove: { from: "e2", to: "e4" }, bestUci: "e2e4" }),
      [{ from: "e2", to: "e4", color: "#EAB308" }],
    );
  });

  it("returns empty array with no inputs", () => {
    assert.deepEqual(buildMoveArrows({}), []);
  });
});

describe("parsePgnGame", () => {
  it("selects a game by index", () => {
    const pgn = loadFixture("multi-game.pgn");
    const first = parsePgnGame(pgn, 0);
    assert.equal(first.headers.white, "Alpha");
    assert.equal(first.headers.result, "1-0");
    const second = parsePgnGame(pgn, 1);
    assert.equal(second.headers.white, "Gamma");
    assert.equal(second.headers.result, "0-1");
  });

  it("throws on out-of-range index", () => {
    const pgn = loadFixture("multi-game.pgn");
    assert.throws(() => parsePgnGame(pgn, 2));
  });
});

describe("hashPgn", () => {
  it("is stable across whitespace differences", () => {
    const a = '[White "A"]\n\n1. e4 e5 *';
    const b = '[White "A"]\r\n\r\n\r\n1.  e4   e5  *  ';
    assert.equal(hashPgn(a), hashPgn(b));
  });

  it("differs between games", () => {
    assert.notEqual(hashPgn("1. e4 *"), hashPgn("1. d4 *"));
  });
});

describe("getFenAtPly", () => {
  it("returns startFen at ply 0", () => {
    const pgn = loadFixture("simple-game.pgn");
    const game = parsePgn(pgn);
    assert.equal(getFenAtPly(game, 0), game.startFen);
  });

  it("returns fenAfter at ply N", () => {
    const pgn = loadFixture("simple-game.pgn");
    const game = parsePgn(pgn);
    assert.equal(getFenAtPly(game, 1), game.moves[0].fenAfter);
    assert.equal(getFenAtPly(game, game.plyCount), game.moves[game.plyCount - 1].fenAfter);
  });

  it("throws on out-of-range ply", () => {
    const pgn = loadFixture("simple-game.pgn");
    const game = parsePgn(pgn);
    assert.throws(() => getFenAtPly(game, -1));
    assert.throws(() => getFenAtPly(game, game.plyCount + 1));
  });
});
