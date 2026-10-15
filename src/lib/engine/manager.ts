import { spawn, type ChildProcess } from "child_process";
import type {
  AnalyzeOptions,
  EngineConfig,
  EvalLine,
  PositionEval,
  SideToMove,
} from "../../types";
import {
  isReadyOk,
  isUciOk,
  parseBestmove,
  parseIdName,
  parseInfoLine,
  splitLines,
  toEvalLine,
  toWhitePerspective,
} from "./uci";

export class EngineBusyError extends Error {
  readonly code = "ENGINE_BUSY";
  constructor() {
    super("Engine sedang dipakai pencarian lain.");
    this.name = "EngineBusyError";
  }
}

export class EngineFailedError extends Error {
  readonly code = "ENGINE_FAILED";
  constructor(message = "Engine gagal menjalankan pencarian.") {
    super(message);
    this.name = "EngineFailedError";
  }
}

const HANDSHAKE_TIMEOUT_MS = 10000;
const TIMEOUT_MARGIN_MS = 2000;

interface PendingSearch {
  resolve: (v: PositionEval) => void;
  reject: (e: Error) => void;
  lines: Map<number, EvalLine>;
  timer: ReturnType<typeof setTimeout>;
  sideToMove: SideToMove;
}

function sideToMoveFromFen(fen: string): SideToMove {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

function readEnv(): { path: string; config: EngineConfig } {
  const path = process.env.STOCKFISH_PATH;
  if (!path) {
    throw new EngineFailedError("STOCKFISH_PATH belum diatur.");
  }
  return {
    path,
    config: {
      threads: Number(process.env.ENGINE_THREADS ?? 2) || 2,
      hashMb: Number(process.env.ENGINE_HASH_MB ?? 256) || 256,
      multipv: Number(process.env.ENGINE_MULTIPV ?? 2) || 2,
    },
  };
}

/**
 * Satu proses Stockfish, satu pencarian aktif.
 * Evaluasi yang keluar selalu sudut pandang White.
 */
export class EngineManager {
  private proc: ChildProcess | null = null;
  private buffer = "";
  // Sync guard: set before the first await so two concurrent analyze()
  // calls can never both pass the busy check.
  private claimed = false;
  // Set by cancel() while startup handshake is still running; consumed
  // once the search actually starts.
  private cancelRequested = false;
  private version: string | null = null;
  private config: EngineConfig | null = null;
  private activeMultipv = 0;
  private pending: PendingSearch | null = null;
  private handshake:
    | { kind: "uci"; resolve: () => void; reject: (e: Error) => void }
    | { kind: "ready"; resolve: () => void; reject: (e: Error) => void }
    | null = null;

  status(): { started: boolean; busy: boolean; version: string | null } {
    return {
      started: this.proc !== null,
      busy: this.pending !== null || this.claimed,
      version: this.version,
    };
  }

  async start(): Promise<{ version: string; config: EngineConfig }> {
    if (this.proc) {
      await this.ping();
      if (!this.config) throw new EngineFailedError();
      return { version: this.version ?? "unknown", config: this.config };
    }

    const { path, config } = readEnv();
    const proc = spawn(path, [], { shell: false, stdio: ["pipe", "pipe", "pipe"] });
    this.proc = proc;
    this.buffer = "";
    this.config = config;

    proc.stdout?.on("data", (chunk: Buffer) => this.onData(chunk.toString()));
    proc.stderr?.on("data", () => {
      // Engine chatter on stderr is ignored.
    });
    proc.on("error", () => this.onCrash(new EngineFailedError("Gagal menjalankan Stockfish.")));
    proc.on("exit", () => this.onCrash(new EngineFailedError("Proses Stockfish mati.")));

    try {
      await this.handshakeCmd("uci", "uciok");
      this.send(`setoption name Threads value ${config.threads}`);
      this.send(`setoption name Hash value ${config.hashMb}`);
      this.send(`setoption name MultiPV value ${config.multipv}`);
      this.activeMultipv = config.multipv;
      await this.handshakeCmd("isready", "readyok");
    } catch (err) {
      this.kill();
      throw err instanceof Error ? err : new EngineFailedError();
    }

    return { version: this.version ?? "unknown", config };
  }

  async analyze(fen: string, opts: AnalyzeOptions): Promise<PositionEval> {
    if (this.pending || this.claimed) throw new EngineBusyError();
    this.claimed = true;
    this.cancelRequested = false;
    try {
      await this.start();

      if (opts.multipv && opts.multipv !== this.activeMultipv) {
        this.send(`setoption name MultiPV value ${opts.multipv}`);
        this.activeMultipv = opts.multipv;
        await this.handshakeCmd("isready", "readyok");
      }
    } catch (err) {
      this.claimed = false;
      throw err;
    }

    const sideToMove = sideToMoveFromFen(fen);
    return new Promise<PositionEval>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        this.kill();
        reject(new EngineFailedError("Pencarian melewati batas waktu."));
      }, opts.movetimeMs + TIMEOUT_MARGIN_MS);

      this.pending = { resolve, reject, lines: new Map(), timer, sideToMove };
      this.claimed = false;
      try {
        this.send(`position fen ${fen}`);
        this.send(`go movetime ${opts.movetimeMs}`);
        if (this.cancelRequested) {
          this.cancelRequested = false;
          this.send("stop");
        }
      } catch (err) {
        clearTimeout(timer);
        this.pending = null;
        reject(err instanceof Error ? err : new EngineFailedError());
      }
    });
  }

  /** Minta pencarian aktif berhenti; hasil parsial tetap resolve. */
  cancel(): void {
    if (!this.proc) return;
    if (this.claimed && !this.pending) {
      this.cancelRequested = true;
      return;
    }
    if (!this.pending) return;
    try {
      this.send("stop");
    } catch {
      // Process may already be gone; onCrash handles the pending promise.
    }
  }

  destroy(): void {
    this.kill();
  }

  private async ping(): Promise<void> {
    await this.handshakeCmd("isready", "readyok");
  }

  private handshakeCmd(cmd: "uci" | "isready", want: "uciok" | "readyok"): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.handshake) {
          this.handshake = null;
          reject(new EngineFailedError(`Engine tidak menjawab ${want}.`));
        }
      }, HANDSHAKE_TIMEOUT_MS);
      this.handshake = {
        kind: cmd === "uci" ? "uci" : "ready",
        resolve: () => {
          clearTimeout(timer);
          this.handshake = null;
          resolve();
        },
        reject: (e: Error) => {
          clearTimeout(timer);
          this.handshake = null;
          reject(e);
        },
      };
      try {
        this.send(cmd);
      } catch (err) {
        clearTimeout(timer);
        this.handshake = null;
        reject(err instanceof Error ? err : new EngineFailedError());
      }
    });
  }

  private send(cmd: string): void {
    if (!this.proc || !this.proc.stdin || this.proc.killed) {
      throw new EngineFailedError("Proses Stockfish tidak berjalan.");
    }
    this.proc.stdin.write(cmd + "\n");
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    const { lines, rest } = splitLines(this.buffer);
    this.buffer = rest;
    for (const line of lines) this.onLine(line);
  }

  private onLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    const idName = parseIdName(trimmed);
    if (idName) {
      this.version = idName;
      return;
    }

    if (this.handshake) {
      if (this.handshake.kind === "uci" && isUciOk(trimmed)) {
        this.handshake.resolve();
        return;
      }
      if (this.handshake.kind === "ready" && isReadyOk(trimmed)) {
        this.handshake.resolve();
        return;
      }
    }

    const info = parseInfoLine(trimmed);
    if (info && this.pending) {
      const white = toWhitePerspective(
        { cp: info.cp, mate: info.mate },
        this.pending.sideToMove,
      );
      this.pending.lines.set(info.multipv, toEvalLine({ ...info, ...white }));
      return;
    }

    const best = parseBestmove(trimmed);
    if (best && this.pending) {
      const pending = this.pending;
      this.pending = null;
      clearTimeout(pending.timer);
      const lines = [...pending.lines.values()].sort((a, b) => a.multipv - b.multipv);
      const depth = lines.reduce((m, l) => Math.max(m, l.depth), 0);
      pending.resolve({ lines, bestUci: best.best, depth });
    }
  }

  private onCrash(err: Error): void {
    const wasPending = this.pending;
    this.pending = null;
    this.kill();
    if (wasPending) {
      clearTimeout(wasPending.timer);
      wasPending.reject(err);
    }
    const hs = this.handshake;
    this.handshake = null;
    hs?.reject(err);
  }

  private kill(): void {
    try {
      this.proc?.kill("SIGKILL");
    } catch {
      // Already dead.
    }
    this.proc = null;
    this.buffer = "";
  }
}

let shared: EngineManager | null = null;

/** Singleton untuk route handlers (satu proses per server). */
export function getEngine(): EngineManager {
  if (!shared) shared = new EngineManager();
  return shared;
}
