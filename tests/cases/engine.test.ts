import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isReadyOk,
  isUciOk,
  parseBestmove,
  parseIdName,
  parseInfoLine,
  splitLines,
  toWhitePerspective,
} from "../../src/lib/engine/uci.ts";

const fixtures = join(import.meta.dirname, "..", "fixtures");

describe("splitLines", () => {
  it("keeps incomplete tail for the next chunk", () => {
    const first = splitLines("uciok\ninfo depth 1 score cp 10 node");
    assert.deepEqual(first.lines, ["uciok"]);
    assert.equal(first.rest, "info depth 1 score cp 10 node");

    const second = splitLines(first.rest + "s 20 pv e2e4\nbestmove e2e4\n");
    assert.deepEqual(second.lines, [
      "info depth 1 score cp 10 nodes 20 pv e2e4",
      "bestmove e2e4",
    ]);
    assert.equal(second.rest, "");
  });

  it("strips carriage returns", () => {
    const { lines } = splitLines("uciok\r\nreadyok\r\n");
    assert.deepEqual(lines, ["uciok", "readyok"]);
  });
});

describe("handshake lines", () => {
  it("detects uciok and readyok", () => {
    assert.equal(isUciOk("uciok"), true);
    assert.equal(isUciOk("uciok "), true);
    assert.equal(isUciOk("readyok"), false);
    assert.equal(isReadyOk("readyok"), true);
  });

  it("parses id name", () => {
    assert.equal(parseIdName("id name Stockfish 19"), "Stockfish 19");
    assert.equal(parseIdName("id author somebody"), null);
  });

  it("parses bestmove with and without ponder", () => {
    assert.deepEqual(parseBestmove("bestmove e2e4 ponder e7e5"), {
      best: "e2e4",
      ponder: "e7e5",
    });
    assert.deepEqual(parseBestmove("bestmove e2e4"), {
      best: "e2e4",
      ponder: undefined,
    });
    assert.deepEqual(parseBestmove("bestmove (none)"), {
      best: null,
      ponder: undefined,
    });
    assert.equal(parseBestmove("info depth 1 score cp 1 pv e2e4"), null);
  });
});

describe("parseInfoLine", () => {
  it("parses cp score with pv", () => {
    const info = parseInfoLine(
      "info depth 12 seldepth 18 multipv 1 score cp 12 nodes 35410 nps 863658 time 41 pv f1g1 f8g8 g2g3",
    );
    assert.deepEqual(info, {
      multipv: 1,
      depth: 12,
      cp: 12,
      pv: ["f1g1", "f8g8", "g2g3"],
    });
  });

  it("parses negative cp and multipv 2", () => {
    const info = parseInfoLine(
      "info depth 12 multipv 2 score cp -34 nodes 1 pv g1f3 d7d5",
    );
    assert.equal(info?.multipv, 2);
    assert.equal(info?.cp, -34);
    assert.deepEqual(info?.pv, ["g1f3", "d7d5"]);
  });

  it("parses mate score", () => {
    const info = parseInfoLine(
      "info depth 18 multipv 1 score mate 3 nodes 99120 pv e2e4 e7e5",
    );
    assert.equal(info?.mate, 3);
    assert.equal(info?.cp, undefined);
  });

  it("defaults multipv to 1", () => {
    const info = parseInfoLine("info depth 1 score cp 85 nodes 20 pv g2g4");
    assert.equal(info?.multipv, 1);
  });

  it("accepts lowerbound lines", () => {
    const info = parseInfoLine(
      "info depth 14 multipv 1 score cp 55 lowerbound nodes 50000 pv d2d4",
    );
    assert.equal(info?.cp, 55);
  });

  it("rejects lines without score", () => {
    assert.equal(
      parseInfoLine("info depth 10 currmovenumber 5 currmove g1f3 currmoves 32"),
      null,
    );
    assert.equal(parseInfoLine("uciok"), null);
    assert.equal(parseInfoLine("bestmove e2e4"), null);
    assert.equal(parseInfoLine(""), null);
  });

  it("parses a stored transcript", () => {
    const text = readFileSync(join(fixtures, "uci-transcript.txt"), "utf-8");
    const { lines } = splitLines(text);
    const infos = lines.map(parseInfoLine).filter((l) => l !== null);
    assert.equal(infos.length, 6);
    const mates = infos.filter((l) => l.mate !== undefined);
    assert.equal(mates.length, 1);
    assert.equal(mates[0].mate, 3);
    assert.equal(parseBestmove(lines[lines.length - 1])?.best, "f1g1");
  });
});

describe("toWhitePerspective", () => {
  it("keeps scores for White to move", () => {
    assert.deepEqual(toWhitePerspective({ cp: 34 }, "w"), { cp: 34 });
    assert.deepEqual(toWhitePerspective({ mate: 3 }, "w"), { mate: 3 });
  });

  it("flips sign for Black to move", () => {
    assert.deepEqual(toWhitePerspective({ cp: 34 }, "b"), { cp: -34 });
    assert.deepEqual(toWhitePerspective({ cp: -20 }, "b"), { cp: 20 });
    assert.deepEqual(toWhitePerspective({ mate: 3 }, "b"), { mate: -3 });
  });
});
