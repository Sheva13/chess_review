"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  FlipHorizontal2,
  History,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Share2,
  Check,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Board } from "@/components/Board";
import { ImportPanel } from "@/components/ImportPanel";
import { MoveList } from "@/components/MoveList";
import { EvalBar } from "@/components/EvalBar";
import { EvalGraph } from "@/components/EvalGraph";
import { MoveCard } from "@/components/MoveCard";
import { LABEL_META } from "@/components/MoveLabel";
import { HistoryDrawer, type HistoryGame } from "@/components/HistoryDrawer";
import {
  applyUciMoves,
  buildMoveArrows,
  buildUci,
  getCheckArrow,
  isPawnPromotion,
  legalTargets,
  pieceAt,
  sideToMove,
  uciToSanLine,
} from "@/lib/chess";
import { epFromWhite } from "@/lib/analysis/ep";
import {
  isMuted,
  playCapture,
  playCastle,
  playCheck,
  playEnd,
  playMove,
  setMuted,
} from "@/lib/sound";
import type { MoveLabel } from "@/types";

interface MoveData {
  ply: number;
  san: string;
  from: string;
  to: string;
  color: string;
  fenBefore: string;
  fenAfter: string;
}

interface GameData {
  /** Database id. Null for transient FEN positions. */
  id: number | null;
  startFen: string;
  moves: MoveData[];
  white: string;
  black: string;
  result: string;
  event?: string;
  playedAt?: string;
  pgn?: string;
  reviewStatus: string;
  summary?: {
    whiteAccuracy: number;
    blackAccuracy: number;
    counts: Partial<Record<MoveLabel, number>>;
    classifierVersion: string;
  } | null;
}

/** Stored position evaluation (from position_evals). */
interface StoredEval {
  cp: number | null;
  mate: number | null;
  bestUci: string | null;
  pvUci: string[];
  depth: number;
  terminal: string | null;
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const BG = "#302E2B";
const PANEL = "#262421";
const PANEL_ALT = "#1F1E1B";
const BORDER = "#3C3833";
const TEXT = "#EDEDED";
const MUTED = "#A09A94";
const FAINT = "#7A766F";
const GREEN = "#81B64C";

type SidebarTab = "moves" | "info";

interface PosAnalysis {
  cp: number | null;
  mate: number | null;
  bestUci: string | null;
  bestSan: string | null;
  pvSan: string[];
  depth: number;
}

function formatEval(cp: number | null, mate: number | null): string {
  if (mate !== null && mate !== undefined) {
    return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  }
  if (cp === null || cp === undefined) return "";
  const v = cp / 100;
  return (v >= 0 ? "+" : "") + v.toFixed(1);
}

interface CachedEval {
  cp: number | null;
  mate: number | null;
  bestUci: string | null;
  pvUci: string[];
  depth: number;
}

/**
 * Fetch one position analysis, reusing cached results by FEN.
 * Stepping through a game reuses the previous position's result,
 * so navigating rarely hits the engine. Throws on failure
 * (e.g. engine busy) — callers keep the previous display.
 */
async function fetchPositionEval(
  cache: Map<string, CachedEval>,
  fen: string,
): Promise<CachedEval> {
  const hit = cache.get(fen);
  if (hit) return hit;
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fen, movetimeMs: 800, multipv: 1 }),
  });
  if (!res.ok) throw new Error(`analyze ${res.status}`);
  const data = await res.json();
  const line = data.lines?.[0];
  const value: CachedEval = {
    cp: line?.cp ?? null,
    mate: line?.mate ?? null,
    bestUci: data.bestUci ?? null,
    pvUci: line?.pv ?? [],
    depth: data.depth ?? 0,
  };
  // ponytail: cap the cache; one game only has N+1 positions.
  if (cache.size > 512) cache.clear();
  cache.set(fen, value);
  return value;
}

function PlayerBar({ name, color }: { name?: string; color: "w" | "b" }) {
  return (
    <div className="flex h-10 w-full items-center gap-2.5">
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center text-[13px] font-bold leading-none"
        style={{
          backgroundColor: color === "w" ? "#E8E8E8" : "#1A1A1A",
          color: color === "w" ? "#1A1A1A" : "#E8E8E8",
          border: color === "b" ? "1px solid #4A4641" : "none",
        }}
      >
        {(name ?? "?").charAt(0).toUpperCase()}
      </div>
      <span className="truncate text-[13.5px] font-medium leading-6" style={{ color: TEXT }}>
        {name ?? "?"}
      </span>
    </div>
  );
}

export default function Home() {
  const [game, setGame] = useState<GameData | null>(null);
  const [ply, setPly] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("moves");
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [posEval, setPosEval] = useState<PosAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const analyzeReq = useRef(0);
  const evalCache = useRef(new Map<string, CachedEval>());
  const [evals, setEvals] = useState<Record<number, StoredEval>>({});
  const [classes, setClasses] = useState<
    Record<number, { label: MoveLabel; reason: string; san: string }>
  >({});
  const labels = useMemo(() => {
    const map: Partial<Record<number, MoveLabel>> = {};
    for (const [ply, c] of Object.entries(classes)) {
      map[Number(ply)] = c.label;
    }
    return map;
  }, [classes]);
  const [review, setReview] = useState<{ done: number; total: number } | null>(null);
  const streamRef = useRef<EventSource | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryGame[]>([]);
  const [muted, setMutedState] = useState(() => isMuted());
  const prevPly = useRef(0);
  // Free exploration line (UCI) from the current main-line position.
  const [exploreMoves, setExploreMoves] = useState<string[]>([]);
  const [pendingPromo, setPendingPromo] = useState<{ from: string; to: string } | null>(null);
  const exploring = exploreMoves.length > 0;
  const [selected, setSelected] = useState<string | null>(null);

  const resetPositionAnalysis = useCallback(() => {
    analyzeReq.current++;
    evalCache.current.clear();
    setPosEval(null);
    setAnalyzing(false);
  }, []);

  const closeStream = useCallback(() => {
    streamRef.current?.close();
    streamRef.current = null;
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/games");
      if (res.ok) setHistory(await res.json());
    } catch {
      // History stays as-is on network errors.
    }
  }, []);

  const fetchGameData = useCallback(async (id: number): Promise<string> => {
    try {
      const res = await fetch(`/api/games/${id}`);
      if (!res.ok) return "";
      const data = await res.json();
      const map: Record<number, StoredEval> = {};
      for (const e of data.evals ?? []) {
        const line = e.lines?.[0];
        map[e.ply] = {
          cp: line?.cp ?? null,
          mate: line?.mate ?? null,
          bestUci: e.best_uci ?? null,
          pvUci: line?.pv ?? [],
          depth: e.depth ?? 0,
          terminal: e.terminal ?? null,
        };
      }
      setEvals(map);
      const status: string = data.review_status ?? "none";
      const classMap: Record<number, { label: MoveLabel; reason: string; san: string }> = {};
      for (const c of data.classes ?? []) {
        classMap[c.ply] = { label: c.label, reason: c.reason, san: c.san };
      }
      setClasses(classMap);
      setGame((g) =>
        g ? { ...g, reviewStatus: status, summary: data.summary ?? null } : g,
      );
      return status;
    } catch {
      // Keep previous state on network errors.
      return "";
    }
  }, []);

  const attachStream = useCallback(
    (id: number) => {
      closeStream();
      const es = new EventSource(`/api/games/${id}/review/stream`);
      streamRef.current = es;
      es.addEventListener("progress", (e) => {
        const d = JSON.parse((e as MessageEvent).data);
        setReview({ done: d.done, total: d.total });
      });
      es.addEventListener("position", (e) => {
        const d = JSON.parse((e as MessageEvent).data);
        const line = d.lines?.[0];
        setEvals((prev) => ({
          ...prev,
          [d.ply]: {
            cp: line?.cp ?? null,
            mate: line?.mate ?? null,
            bestUci: d.bestUci ?? null,
            pvUci: line?.pv ?? [],
            depth: line?.depth ?? 0,
            terminal: null,
          },
        }));
      });
      const finish = () => {
        closeStream();
        setReview(null);
        void fetchGameData(id);
        void refreshHistory();
      };
      es.addEventListener("done", finish);
      es.addEventListener("cancelled", finish);
      es.addEventListener("error", () => {
        // Stream errors (not review errors) just detach.
        if (es.readyState === EventSource.CLOSED) {
          closeStream();
          setReview(null);
        }
      });
    },
    [closeStream, fetchGameData, refreshHistory],
  );

  const handleGameLoaded = useCallback(
    (data: Omit<GameData, "id" | "reviewStatus">, rawPgn?: string, id?: number | null) => {
      closeStream();
      setGame({ ...data, pgn: rawPgn ?? data.pgn, id: id ?? null, reviewStatus: "none" });
      setEvals({});
      setClasses({});
      setReview(null);
      setExploreMoves([]);
      setPendingPromo(null);
      setSelected(null);
      setPly(0);
      setFlipped(false);
      setSidebarTab("moves");
      setPlaying(false);
      resetPositionAnalysis();
      if (id != null) {
        void fetchGameData(id).then((status) => {
          if (status === "running") attachStream(id);
        });
      }
      void refreshHistory();
    },
    [resetPositionAnalysis, closeStream, fetchGameData, refreshHistory, attachStream],
  );

  const closeGame = useCallback(() => {
    closeStream();
    setGame(null);
    setEvals({});
    setClasses({});
    setReview(null);
    setPlaying(false);
    setExploreMoves([]);
    setPendingPromo(null);
    setSelected(null);
    resetPositionAnalysis();
  }, [resetPositionAnalysis, closeStream]);

  const gotoPly = useCallback((p: number | ((prev: number) => number)) => {
    setExploreMoves([]);
    setPendingPromo(null);
    setSelected(null);
    setPly(p);
  }, []);

  const startReview = useCallback(
    async (force = false) => {
      if (!game?.id) return;
      try {
        const res = await fetch(`/api/games/${game.id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "done") {
        await fetchGameData(game.id);
        return;
      }
      attachStream(game.id);
    } catch {
      // Leave the button usable on network errors.
    }
  }, [game, attachStream, fetchGameData]);

  const cancelReview = useCallback(async () => {
    if (!game?.id) return;
    try {
      await fetch(`/api/games/${game.id}/review`, { method: "DELETE" });
    } catch {
      // The stream will report the final status.
    }
  }, [game]);

  const openHistoryGame = useCallback(
    async (id: number) => {
      closeStream();
      setHistoryOpen(false);
      resetPositionAnalysis();
      try {
        const res = await fetch(`/api/games/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setGame({
          id: data.id,
          startFen: data.startFen ?? START_FEN,
          moves: data.moves,
          white: data.white,
          black: data.black,
          result: data.result,
          event: data.event,
          playedAt: data.played_at,
          pgn: data.pgn,
          reviewStatus: data.review_status,
        });
        const map: Record<number, StoredEval> = {};
        for (const e of data.evals ?? []) {
          const line = e.lines?.[0];
          map[e.ply] = {
            cp: line?.cp ?? null,
            mate: line?.mate ?? null,
            bestUci: e.best_uci ?? null,
            pvUci: line?.pv ?? [],
            depth: e.depth ?? 0,
            terminal: e.terminal ?? null,
          };
        }
        setEvals(map);
        const classMap: Record<number, { label: MoveLabel; reason: string; san: string }> = {};
        for (const c of data.classes ?? []) {
          classMap[c.ply] = { label: c.label, reason: c.reason, san: c.san };
        }
        setClasses(classMap);
        setGame((g) =>
          g ? { ...g, summary: data.summary ?? null } : g,
        );
        setReview(null);
        setPly(0);
        setFlipped(false);
        setSidebarTab("moves");
        setPlaying(false);
        if (data.review_status === "running") attachStream(id);
      } catch {
        // Leave the current view on network errors.
      }
    },
    [closeStream, resetPositionAnalysis, attachStream],
  );

  const deleteHistoryGame = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`/api/games/${id}`, { method: "DELETE" });
        if (!res.ok) return;
        setHistory((prev) => prev.filter((g) => g.id !== id));
        if (game?.id === id) {
          closeStream();
          setEvals({});
          setClasses({});
          setReview(null);
          setGame((g) => (g ? { ...g, id: null, reviewStatus: "none" } : g));
        }
      } catch {
        // Keep the row on network errors.
      }
    },
    [game, closeStream],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshHistory();
    }, 0);
    return () => {
      clearTimeout(timer);
      closeStream();
    };
  }, [refreshHistory, closeStream]);

  const currentFen = game
    ? ply === 0
      ? game.startFen
      : game.moves[ply - 1].fenAfter
    : START_FEN;

  // Position actually shown: main line, or main line + explored variation.
  const displayFen = useMemo(() => {
    if (!game || exploreMoves.length === 0) return currentFen;
    try {
      return applyUciMoves(currentFen, exploreMoves);
    } catch {
      return currentFen;
    }
  }, [game, currentFen, exploreMoves]);

  const lastMove = useMemo(() => {
    if (exploreMoves.length > 0) {
      const u = exploreMoves[exploreMoves.length - 1];
      return { from: u.slice(0, 2), to: u.slice(2, 4) };
    }
    return game && ply > 0
      ? { from: game.moves[ply - 1].from, to: game.moves[ply - 1].to }
      : null;
  }, [game, ply, exploreMoves]);

  // Stored review evals win over live analysis when present.
  // Eval number/bar describe position N; best move + PV describe
  // position N-1, i.e. what the mover should have played instead.
  // While exploring, everything follows the live-analyzed line.
  const display = useMemo(() => {
    if (!game) return null;
    if (exploring) return posEval;
    const stored = evals[ply];
    if (stored) {
      const prev = ply > 0 ? (evals[ply - 1] ?? stored) : stored;
      const baseFen =
        ply > 0 ? (game.moves[ply - 1]?.fenBefore ?? game.startFen) : game.startFen;
      const sans = uciToSanLine(baseFen, (prev.pvUci ?? []).slice(0, 6));
      return {
        cp: stored.cp,
        mate: stored.mate,
        bestUci: prev.bestUci,
        bestSan: sans[0] ?? prev.bestUci ?? null,
        pvSan: sans.slice(1),
        depth: stored.depth,
      };
    }
    return posEval;
  }, [game, evals, ply, posEval, exploring]);

  const boardArrows = useMemo(
    () =>
      buildMoveArrows({
        lastMove,
        bestUci: display?.bestUci ?? null,
        check: game ? getCheckArrow(displayFen) : null,
      }),
    [game, displayFen, lastMove, display],
  );

  const graphPoints = useMemo(() => {
    if (!game) return [];
    return Object.entries(evals).map(([plyStr, e]) => ({
      ply: Number(plyStr),
      ep: epFromWhite(e.cp, e.mate),
    }));
  }, [game, evals]);

  const goStart = useCallback(() => {
    gotoPly(0);
    setPlaying(false);
  }, [gotoPly]);
  const goEnd = useCallback(() => {
    gotoPly(game ? game.moves.length : 0);
    setPlaying(false);
  }, [game, gotoPly]);
  const goPrev = useCallback(() => {
    setPlaying(false);
    gotoPly((p) => Math.max(0, p - 1));
  }, [gotoPly]);
  const goNext = useCallback(() => {
    gotoPly((p) => Math.min(game?.moves.length ?? 0, p + 1));
  }, [game, gotoPly]);

  const togglePlay = useCallback(() => {
    if (!game) return;
    if (ply >= game.moves.length) {
      gotoPly(0);
      setPlaying(true);
      return;
    }
    setPlaying((v) => !v);
  }, [game, ply, gotoPly]);

  useEffect(() => {
    if (!playing || !game) return;
    playRef.current = setInterval(() => {
      gotoPly((p) => {
        if (p >= (game?.moves.length ?? 0)) {
          setPlaying(false);
          return p;
        }
        return p + 1;
      });
    }, 750);
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [playing, game, gotoPly]);

  useEffect(() => {
    if (!game) return;
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      )
        return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          goNext();
          break;
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "f":
        case "F":
          setFlipped((f) => !f);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [game, goPrev, goNext, togglePlay]);

  // Move sounds: check > capture > castle > quiet move, plus end jingle.
  useEffect(() => {
    if (!game || ply === 0 || ply === prevPly.current) {
      prevPly.current = ply;
      return;
    }
    prevPly.current = ply;
    const m = game.moves[ply - 1];
    if (!m) return;
    if (ply >= game.moves.length && game.result !== "*") {
      playEnd(game.result);
      return;
    }
    if (getCheckArrow(currentFen) !== null) {
      playCheck();
      return;
    }
    if (m.san.includes("x")) {
      playCapture();
      return;
    }
    if (m.san.startsWith("O-O")) {
      playCastle();
      return;
    }
    playMove();
  }, [game, ply, currentFen]);

  // Live analysis of the SHOWN position (debounced, stale-guarded,
  // FEN-cached). Eval number + bar describe it; best move + PV describe
  // the position before the last shown move.
  useEffect(() => {
    if (!game) return;
    if (!exploring && evals[ply] !== undefined) return;
    const id = ++analyzeReq.current;
    let baseFen: string;
    let beforeFen: string | null;
    try {
      baseFen = exploring
        ? applyUciMoves(currentFen, exploreMoves.slice(0, -1))
        : currentFen;
      beforeFen = exploring || ply > 0 ? baseFen : null;
    } catch {
      return;
    }
    const targetFen = exploring ? displayFen : currentFen;
    const timer = setTimeout(async () => {
      if (id !== analyzeReq.current) return;
      setAnalyzing(true);
      try {
        const current = await fetchPositionEval(evalCache.current, targetFen);
        if (id !== analyzeReq.current) return;
        const best = beforeFen
          ? await fetchPositionEval(evalCache.current, beforeFen)
          : current;
        if (id !== analyzeReq.current) return;
        const sans = uciToSanLine(beforeFen ?? targetFen, (best.pvUci ?? []).slice(0, 6));
        setPosEval({
          cp: current.cp,
          mate: current.mate,
          bestUci: best.bestUci,
          bestSan: sans[0] ?? best.bestUci ?? null,
          pvSan: sans.slice(1),
          depth: current.depth,
        });
      } catch {
        // Keep the previous display on failure (e.g. engine busy).
      } finally {
        if (id === analyzeReq.current) setAnalyzing(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [game, currentFen, displayFen, ply, evals, exploring, exploreMoves]);

  const commitExplore = useCallback(
    (from: string, to: string, promotion?: string) => {
      if (!game) return false;
      const uci = buildUci(from, to, promotion);
      let nextFen: string;
      try {
        // displayFen already contains exploreMoves; apply only the new move.
        nextFen = applyUciMoves(displayFen, [uci]);
      } catch {
        return false;
      }
      setExploreMoves((prev) => [...prev, uci]);
      const san = uciToSanLine(displayFen, [uci])[0] ?? uci;
      if (getCheckArrow(nextFen) !== null) playCheck();
      else if (san.includes("x")) playCapture();
      else playMove();
      return true;
    },
    [game, displayFen],
  );

  const handleDropMove = useCallback(
    (from: string, to: string) => {
      if (!game || from === to) return false;
      if (isPawnPromotion(displayFen, from, to)) {
        setPendingPromo({ from, to });
        return false;
      }
      setSelected(null);
      return commitExplore(from, to);
    },
    [game, displayFen, commitExplore],
  );

  const selection = useMemo(() => {
    if (!game || !selected) return null;
    return { square: selected, targets: legalTargets(displayFen, selected) };
  }, [game, selected, displayFen]);

  const handleSquareClick = useCallback(
    (square: string) => {
      if (!game || pendingPromo) return;
      if (selected) {
        if (square === selected) {
          setSelected(null);
          return;
        }
        if (selection && selection.targets.includes(square)) {
          const from = selected;
          setSelected(null);
          if (isPawnPromotion(displayFen, from, square)) {
            setPendingPromo({ from, to: square });
            return;
          }
          commitExplore(from, square);
          return;
        }
      }
      const info = pieceAt(displayFen, square);
      setSelected(info && info.color === sideToMove(displayFen) ? square : null);
    },
    [game, pendingPromo, selected, selection, displayFen, commitExplore],
  );

  const sharePgn = useCallback(async () => {
    if (!game?.pgn) return;
    try {
      await navigator.clipboard.writeText(game.pgn);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [game]);

  const playerTop = flipped ? game?.black : game?.white;
  const playerBottom = flipped ? game?.white : game?.black;
  const topColor = (flipped ? "b" : "w") as "w" | "b";
  const bottomColor = (flipped ? "w" : "b") as "w" | "b";

  const navBtn =
    "flex h-11 w-11 items-center justify-center transition-colors disabled:opacity-25 disabled:hover:bg-transparent";

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: BG }}>
      <nav
        className="flex h-16 shrink-0 items-center justify-between border-b px-6"
        style={{ borderColor: BORDER, backgroundColor: PANEL }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center text-[18px] font-bold leading-none"
            style={{ backgroundColor: GREEN, color: "#FFFFFF" }}
          >
            ♞
          </div>
          <span className="text-[15px] font-semibold leading-6 tracking-wide" style={{ color: TEXT }}>
            Chess Review
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = !isMuted();
              setMuted(next);
              setMutedState(next);
            }}
            className="flex h-[34px] w-[34px] items-center justify-center border transition-colors"
            style={{ borderColor: BORDER, backgroundColor: PANEL_ALT, color: MUTED }}
            title={muted ? "Nyalakan suara" : "Bisukan suara"}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button
            onClick={() => {
              void refreshHistory();
              setHistoryOpen(true);
            }}
            className="flex items-center gap-1.5 border px-3.5 py-2 text-[13px] font-medium leading-5 transition-colors"
            style={{ borderColor: BORDER, backgroundColor: PANEL_ALT, color: MUTED }}
            title="Riwayat game"
          >
            <History size={14} />
            Riwayat
          </button>
          {game && (
            <button
              onClick={closeGame}
              className="border px-4 py-2 text-[13px] font-medium leading-5 transition-colors"
              style={{ borderColor: BORDER, backgroundColor: PANEL_ALT, color: TEXT }}
            >
              Import Baru
            </button>
          )}
        </div>
      </nav>
      <HistoryDrawer
        open={historyOpen}
        games={history}
        activeId={game?.id ?? null}
        onClose={() => setHistoryOpen(false)}
        onOpen={(id) => void openHistoryGame(id)}
        onDelete={(id) => void deleteHistoryGame(id)}
      />
      {pendingPromo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={() => setPendingPromo(null)}
        >
          <div
            className="border p-5"
            style={{ borderColor: BORDER, backgroundColor: PANEL }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-[13px] leading-5" style={{ color: MUTED }}>
              Promosi bidak menjadi:
            </p>
            <div className="flex gap-2">
              {(
                [
                  ["q", "Menteri"],
                  ["r", "Benteng"],
                  ["b", "Gajah"],
                  ["n", "Kuda"],
                ] as const
              ).map(([p, name]) => (
                <button
                  key={p}
                  onClick={() => {
                    commitExplore(pendingPromo.from, pendingPromo.to, p);
                    setPendingPromo(null);
                  }}
                  className="px-4 py-2.5 text-[13px] font-semibold leading-5 transition-colors"
                  style={{ backgroundColor: GREEN, color: "#FFFFFF" }}
                  title={name}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!game ? (
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-lg">
            <div className="mb-8 text-center">
              <h1 className="text-[28px] font-semibold leading-9" style={{ color: TEXT }}>
                Analisis Game Catur
              </h1>
              <p className="mt-3 text-[14px] leading-6" style={{ color: MUTED }}>
                Impor PGN atau masukkan FEN untuk mulai meninjau pertandingan
              </p>
            </div>
            <div
              className="border p-6 sm:p-7"
              style={{ borderColor: BORDER, backgroundColor: PANEL }}
            >
              <ImportPanel onGameLoaded={handleGameLoaded} />
            </div>
          </div>
        </div>
      ) : (
        <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col items-center gap-6 px-4 py-6 lg:flex-row lg:items-start lg:justify-center lg:gap-8 lg:px-6">
          {/* Board column */}
          <section className="flex w-full max-w-[720px] flex-col gap-2 lg:w-[min(calc(100vh-270px),700px)] lg:max-w-none lg:shrink-0">
            <PlayerBar name={playerTop} color={topColor} />

            <div className="flex w-full items-stretch gap-2">
              <EvalBar cp={display?.cp ?? null} mate={display?.mate ?? null} />
              <div className="aspect-square min-w-0 flex-1 overflow-hidden">
                <Board
                  fen={displayFen}
                  flipped={flipped}
                  lastMove={lastMove}
                  arrows={boardArrows}
                  squareLabel={
                    game && !exploring && ply > 0 && lastMove && classes[ply]
                      ? { square: lastMove.to, label: classes[ply].label }
                      : null
                  }
                  draggable={!!game}
                  onDropMove={handleDropMove}
                  selection={selection}
                  onSquareClick={handleSquareClick}
                />
              </div>
            </div>

            <PlayerBar name={playerBottom} color={bottomColor} />

            <p className="mt-2 hidden text-[12px] leading-5 lg:block" style={{ color: FAINT }}>
              Panah kiri/kanan untuk navigasi, spasi untuk putar otomatis, F untuk balik papan.
              Seret bidak untuk eksplorasi variasi.
            </p>

            {graphPoints.length > 0 && (
              <div
                className="mt-2 w-full border px-4 py-3"
                style={{ borderColor: BORDER, backgroundColor: PANEL }}
              >
                <div
                  className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: FAINT }}
                >
                  Grafik Evaluasi
                </div>
                <EvalGraph
                  points={graphPoints}
                  maxPly={game.moves.length}
                  activePly={ply}
                  onSelect={(p) => {
                    setPlaying(false);
                    gotoPly(p);
                  }}
                />
              </div>
            )}
          </section>

          {/* Sidebar */}
          <aside
            className="flex h-[600px] w-full max-w-[720px] flex-col overflow-hidden border lg:h-[min(calc(100vh-200px),800px)] lg:min-h-[640px] lg:w-[400px] lg:max-w-none lg:shrink-0"
            style={{ backgroundColor: PANEL, borderColor: BORDER }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between border-b px-5 py-3"
              style={{ borderColor: BORDER }}
            >
              <span className="text-[14px] font-semibold leading-6" style={{ color: TEXT }}>
                Analisis
              </span>
              <button
                onClick={closeGame}
                className="flex h-8 w-8 items-center justify-center transition-colors"
                style={{ color: MUTED }}
                title="Tutup dan kembali ke impor"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs: 2 bagian sama besar, teks center */}
            <div className="grid grid-cols-2 border-b" style={{ borderColor: BORDER }}>
              {(["moves", "info"] as SidebarTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setSidebarTab(t)}
                  className="relative flex items-center justify-center px-4 py-3 text-[14px] font-medium leading-6 transition-colors"
                  style={{ color: sidebarTab === t ? TEXT : FAINT }}
                >
                  {t === "moves" ? "Langkah" : "Info"}
                  {sidebarTab === t && (
                    <div
                      className="absolute bottom-0 h-[2px] w-12"
                      style={{ backgroundColor: GREEN }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Status strip: engine + counter + aksi review, satu baris */}
            <div className="border-b" style={{ borderColor: BORDER, backgroundColor: PANEL_ALT }}>
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-4 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: GREEN }}
                  />
                  <span className="truncate text-[12.5px] font-semibold leading-5" style={{ color: TEXT }}>
                    Stockfish 19
                  </span>
                </div>
                <span className="text-[12px] tabular-nums leading-5" style={{ color: MUTED }}>
                  {review ? `${review.done}/${review.total}` : `${ply}/${game.moves.length}`}
                </span>
                {review ? (
                  <button
                    onClick={() => void cancelReview()}
                    className="px-1 text-[12px] font-medium leading-5 transition-colors"
                    style={{ color: "#E58A8A" }}
                    title="Batalkan review (hasil parsial tersimpan)"
                  >
                    Batal
                  </button>
                ) : game.id == null ? null : game.reviewStatus === "done" ? (
                  <button
                    onClick={() => void startReview(true)}
                    className="px-1 text-[12px] font-medium leading-5 transition-colors"
                    style={{ color: GREEN }}
                    title="Jalankan ulang review"
                  >
                    Ulangi
                  </button>
                ) : (
                  <button
                    onClick={() => void startReview()}
                    className="px-1 text-[12px] font-semibold leading-5 transition-colors"
                    style={{ color: GREEN }}
                    title="Analisis seluruh game"
                  >
                    Review
                  </button>
                )}
              </div>
              {review && (
                <div className="h-0.5 w-full" style={{ backgroundColor: BORDER }}>
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${review.total > 0 ? Math.round((review.done / review.total) * 100) : 0}%`,
                      backgroundColor: GREEN,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-hidden">
              {sidebarTab === "moves" ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="border-b px-4 py-2" style={{ borderColor: BORDER }}>
                    <div className="flex items-baseline justify-between">
                      <span
                        className="font-mono text-[17px] font-semibold tabular-nums leading-6"
                        style={{ color: TEXT }}
                      >
                        {analyzing && !display
                          ? "…"
                          : formatEval(display?.cp ?? null, display?.mate ?? null)}
                      </span>
                      <span className="text-[11.5px] tabular-nums leading-5" style={{ color: FAINT }}>
                        {analyzing ? "menganalisis…" : display ? `depth ${display.depth}` : ""}
                      </span>
                    </div>
                    {display?.bestSan && (
                      <div className="mt-0.5 truncate font-mono text-[12.5px] leading-5" style={{ color: MUTED }}>
                        Best:{" "}
                        <span className="font-semibold" style={{ color: TEXT }}>
                          {display.bestSan}
                        </span>
                        {display.pvSan.length > 0 && <> · {display.pvSan.join(" ")}</>}
                      </div>
                    )}
                    {ply > 0 && !exploring && classes[ply] && (
                      <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: BORDER }}>
                        <MoveCard
                          san={classes[ply].san}
                          label={classes[ply].label}
                          reason={classes[ply].reason}
                        />
                      </div>
                    )}
                    {exploring && (
                      <button
                        onClick={() => gotoPly(ply)}
                        className="mt-1.5 w-full border px-3 py-2 text-left text-[12.5px] font-medium leading-5 transition-colors"
                        style={{ borderColor: GREEN, color: GREEN }}
                        title="Kembali ke game utama"
                      >
                        ← Variasi {exploreMoves.length} langkah — kembali ke langkah {ply}
                      </button>
                    )}
                  </div>
                  <div className="min-h-0 flex-1">
                    <MoveList
                      moves={game.moves}
                      activePly={ply}
                      onPlyChange={(p) => {
                        setPlaying(false);
                        gotoPly(p);
                      }}
                      dark
                      labels={labels}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col px-5 py-3">
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[13px] leading-5" style={{ color: MUTED }}>Putih</span>
                    <span className="text-[13px] font-medium leading-5" style={{ color: TEXT }}>{game.white}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[13px] leading-5" style={{ color: MUTED }}>Hitam</span>
                    <span className="text-[13px] font-medium leading-5" style={{ color: TEXT }}>{game.black}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[13px] leading-5" style={{ color: MUTED }}>Hasil</span>
                    <span className="text-[13px] font-medium tabular-nums leading-5" style={{ color: TEXT }}>{game.result}</span>
                  </div>
                  {game.event && (
                    <div className="flex items-center justify-between gap-4 py-2.5">
                      <span className="shrink-0 text-[13px] leading-5" style={{ color: MUTED }}>Event</span>
                      <span className="truncate text-right text-[13px] leading-5" style={{ color: TEXT }}>{game.event}</span>
                    </div>
                  )}
                  {game.playedAt && game.playedAt !== "????.??.??" && (
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-[13px] leading-5" style={{ color: MUTED }}>Tanggal</span>
                      <span className="text-[13px] leading-5" style={{ color: TEXT }}>{game.playedAt}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[13px] leading-5" style={{ color: MUTED }}>Total langkah</span>
                    <span className="text-[13px] tabular-nums leading-5" style={{ color: TEXT }}>{game.moves.length}</span>
                  </div>
                  {game.summary && (
                    <>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[13px] leading-5" style={{ color: MUTED }}>Akurasi Putih</span>
                        <span className="text-[13px] font-medium tabular-nums leading-5" style={{ color: TEXT }}>
                          {game.summary.whiteAccuracy}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[13px] leading-5" style={{ color: MUTED }}>Akurasi Hitam</span>
                        <span className="text-[13px] font-medium tabular-nums leading-5" style={{ color: TEXT }}>
                          {game.summary.blackAccuracy}
                        </span>
                      </div>
                      {(Object.entries(game.summary.counts) as Array<[MoveLabel, number]>)
                        .filter(([, n]) => n > 0)
                        .map(([label, n]) => (
                          <div key={label} className="flex items-center justify-between py-2.5">
                            <span className="text-[13px] capitalize leading-5" style={{ color: MUTED }}>
                              {LABEL_META[label].name}
                            </span>
                            <span className="text-[13px] tabular-nums leading-5" style={{ color: LABEL_META[label].color }}>
                              {n}
                            </span>
                          </div>
                        ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div
              className="flex items-center justify-center gap-2 border-t px-4 py-3"
              style={{ borderColor: BORDER, backgroundColor: PANEL_ALT }}
            >
              <button onClick={goStart} disabled={ply === 0} className={navBtn} style={{ color: MUTED }} title="Langkah awal">
                <ChevronsLeft size={20} />
              </button>
              <button onClick={goPrev} disabled={ply === 0} className={navBtn} style={{ color: MUTED }} title="Sebelumnya">
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={togglePlay}
                className="flex h-11 w-11 items-center justify-center transition-colors"
                style={{ backgroundColor: GREEN, color: "#FFFFFF" }}
                title="Putar / jeda (spasi)"
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button onClick={goNext} disabled={ply >= game.moves.length} className={navBtn} style={{ color: MUTED }} title="Berikutnya">
                <ChevronRight size={20} />
              </button>
              <button onClick={goEnd} disabled={ply >= game.moves.length} className={navBtn} style={{ color: MUTED }} title="Langkah akhir">
                <ChevronsRight size={20} />
              </button>
            </div>

            {/* Utility row */}
            <div className="flex items-center justify-center gap-2 px-4 pb-3.5 pt-1" style={{ backgroundColor: PANEL_ALT }}>
              <button
                onClick={sharePgn}
                disabled={!game.pgn}
                className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-[#3A3835] disabled:opacity-30"
                style={{ color: MUTED }}
                title={game.pgn ? "Salin PGN" : "Tidak ada PGN"}
              >
                {copied ? <Check size={16} /> : <Share2 size={16} />}
              </button>
              <button
                onClick={closeGame}
                className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-[#3A3835]"
                style={{ color: MUTED }}
                title="Permainan baru"
              >
                <Plus size={16} />
              </button>
              <button
                onClick={() => setFlipped((f) => !f)}
                className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-[#3A3835]"
                style={{ color: MUTED }}
                title="Balik papan (F)"
              >
                <FlipHorizontal2 size={16} />
              </button>
              <button
                onClick={goStart}
                className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-[#3A3835]"
                style={{ color: MUTED }}
                title="Kembali ke awal"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}
