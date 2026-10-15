import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  clearPositionEvals,
  closeDb,
  countPositionEvals,
  createGame,
  deleteGame,
  deleteMoveClasses,
  findGameByHash,
  getGame,
  getMoveClasses,
  getPositionEvals,
  listGames,
  saveMoveClasses,
  savePositionEval,
  updateGameReview,
} from "../../src/lib/db/index.ts";

process.env.DB_PATH = ":memory:";

after(() => closeDb());

const GAME = {
  pgn: '[White "A"]\n\n1. e4 e5 *',
  pgnHash: "test-hash-1",
  white: "A",
  black: "B",
  result: "*",
  source: "paste",
  plyCount: 2,
};

describe("games repository", () => {
  it("creates, finds by hash, gets and lists", () => {
    const created = createGame(GAME);
    assert.ok(created.id > 0);
    assert.equal(created.review_status, "none");

    assert.equal(findGameByHash("test-hash-1")?.id, created.id);
    assert.equal(findGameByHash("nope"), null);
    assert.equal(getGame(created.id)?.white, "A");
    assert.equal(getGame(999999), null);

    const list = listGames();
    assert.ok(list.some((g) => g.id === created.id));
  });

  it("rejects duplicate pgn_hash", () => {
    assert.throws(() => createGame(GAME));
  });

  it("updates review status", () => {
    const created = createGame({ ...GAME, pgnHash: "test-hash-2" });
    updateGameReview(created.id, { review_status: "running" });
    assert.equal(getGame(created.id)?.review_status, "running");
    updateGameReview(created.id, {
      review_status: "done",
      engine_version: "Stockfish 19",
      engine_config: "{}",
    });
    const done = getGame(created.id);
    assert.equal(done?.engine_version, "Stockfish 19");
  });
});

describe("position_evals repository", () => {
  it("saves, reads back and counts", () => {
    const created = createGame({ ...GAME, pgnHash: "test-hash-3" });
    savePositionEval({
      gameId: created.id,
      ply: 0,
      fen: "start",
      terminal: null,
      lines: [{ multipv: 1, cp: 20, depth: 18, pv: ["e2e4"] }],
      bestUci: "e2e4",
      depth: 18,
    });
    assert.equal(countPositionEvals(created.id), 1);
    const [row] = getPositionEvals(created.id);
    assert.equal(row.fen, "start");
    assert.deepEqual(row.lines, [{ multipv: 1, cp: 20, depth: 18, pv: ["e2e4"] }]);
  });

  it("upserts on conflict and clears with re-review", () => {
    const created = createGame({ ...GAME, pgnHash: "test-hash-4" });
    const base = {
      gameId: created.id,
      ply: 0,
      fen: "start",
      terminal: null as string | null,
      lines: [],
      bestUci: null as string | null,
      depth: 10,
    };
    savePositionEval(base);
    savePositionEval({ ...base, depth: 20 });
    assert.equal(getPositionEvals(created.id)[0].depth, 20);
    clearPositionEvals(created.id);
    assert.equal(countPositionEvals(created.id), 0);
  });
});

describe("move_classes repository", () => {
  it("saves, reads and deletes", () => {
    const created = createGame({ ...GAME, pgnHash: "test-hash-6" });
    saveMoveClasses(created.id, [
      {
        ply: 1,
        san: "e4",
        uci: "e2e4",
        label: "best",
        epLoss: 0,
        epBefore: 0.5,
        epAfter: 0.5,
        bestUci: "e2e4",
        reason: "Langkah terbaik menurut engine.",
      },
    ]);
    const [row] = getMoveClasses(created.id);
    assert.equal(row.san, "e4");
    assert.equal(row.label, "best");
    assert.equal(row.ep_loss, 0);
    deleteMoveClasses(created.id);
    assert.equal(getMoveClasses(created.id).length, 0);
  });
});

describe("delete cascade", () => {
  it("removes evals with the game", () => {
    const created = createGame({ ...GAME, pgnHash: "test-hash-5" });
    savePositionEval({
      gameId: created.id,
      ply: 0,
      fen: "start",
      terminal: null,
      lines: [],
      bestUci: null,
      depth: 0,
    });
    assert.equal(deleteGame(created.id), true);
    assert.equal(getGame(created.id), null);
    assert.equal(deleteGame(created.id), false);
  });
});
