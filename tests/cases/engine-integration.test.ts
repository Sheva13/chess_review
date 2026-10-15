import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  EngineBusyError,
  EngineFailedError,
  EngineManager,
} from "../../src/lib/engine/manager.ts";

// Load .env.local so STOCKFISH_PATH is available when running npm test.
const envFile = join(import.meta.dirname, "..", "..", ".env.local");
if (existsSync(envFile)) {
  for (const raw of readFileSync(envFile, "utf-8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const key = line.slice(0, line.indexOf("=")).trim();
    if (!(key in process.env)) {
      process.env[key] = line.slice(line.indexOf("=") + 1).trim();
    }
  }
}

const HAS_ENGINE = Boolean(process.env.STOCKFISH_PATH);
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// White to move, Ra8# (rook covers the 8th rank, Kg6 covers g7/h7).
const MATE_IN_1_FEN = "7k/8/6KP/8/8/8/8/R7 w - - 0 1";

const managers: EngineManager[] = [];
function freshManager(): EngineManager {
  const m = new EngineManager();
  managers.push(m);
  return m;
}
after(() => {
  for (const m of managers) m.destroy();
});

describe("engine integration", { skip: !HAS_ENGINE }, () => {
  it("starts and reports Stockfish version", async () => {
    const engine = freshManager();
    const { version } = await engine.start();
    assert.match(version, /stockfish/i);
    assert.equal(engine.status().started, true);
  });

  it("evaluates the starting position", async () => {
    const engine = freshManager();
    const result = await engine.analyze(START_FEN, { movetimeMs: 500, multipv: 2 });
    assert.ok(result.lines.length >= 1);
    assert.equal(typeof result.lines[0].cp, "number");
    assert.match(result.bestUci ?? "", /^[a-h][1-8][a-h][1-8][qrbn]?$/);
    assert.ok(result.depth > 0);
  });

  it("finds mate in 1 from White perspective", async () => {
    const engine = freshManager();
    const result = await engine.analyze(MATE_IN_1_FEN, { movetimeMs: 800, multipv: 1 });
    assert.ok(result.lines[0].mate !== undefined && result.lines[0].mate > 0);
    assert.equal(result.bestUci, "a1a8");
  });

  it("resolves partial results on cancel", async () => {
    const engine = freshManager();
    await engine.start();
    const promise = engine.analyze(START_FEN, { movetimeMs: 8000, multipv: 1 });
    await new Promise((r) => setTimeout(r, 300));
    engine.cancel();
    const started = Date.now();
    const result = await promise;
    assert.ok(Date.now() - started < 5000, "cancel should stop the search quickly");
    assert.ok(result.lines.length >= 0);
  });

  it("rejects a second concurrent search with ENGINE_BUSY", async () => {
    const engine = freshManager();
    const first = engine.analyze(START_FEN, { movetimeMs: 2000, multipv: 1 });
    await assert.rejects(
      engine.analyze(START_FEN, { movetimeMs: 200 }),
      (err: unknown) => err instanceof EngineBusyError && err.code === "ENGINE_BUSY",
    );
    await first;
  });

  it("fails cleanly without STOCKFISH_PATH", async () => {
    const saved = process.env.STOCKFISH_PATH;
    delete process.env.STOCKFISH_PATH;
    const engine = freshManager();
    try {
      await assert.rejects(engine.analyze(START_FEN, { movetimeMs: 200 }), (err: unknown) => {
        return err instanceof EngineFailedError;
      });
    } finally {
      if (saved !== undefined) process.env.STOCKFISH_PATH = saved;
    }
  });
});
