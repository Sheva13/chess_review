import type { EvalLine, SideToMove } from "../../types";

export interface ParsedInfo {
  multipv: number;
  cp?: number;
  mate?: number;
  depth: number;
  pv: string[];
}

export interface ParsedBestmove {
  best: string | null;
  ponder?: string;
}

/** Split incoming stdout chunk into complete lines, keeping the tail. */
export function splitLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts.map((l) => l.replace(/\r$/, "")), rest };
}

export function isUciOk(line: string): boolean {
  return line.trim() === "uciok";
}

export function isReadyOk(line: string): boolean {
  return line.trim() === "readyok";
}

export function parseIdName(line: string): string | null {
  const m = /^id name (.+)$/.exec(line.trim());
  return m ? m[1] : null;
}

export function parseBestmove(line: string): ParsedBestmove | null {
  const m = /^bestmove (\S+)(?: ponder (\S+))?/.exec(line.trim());
  if (!m) return null;
  return { best: m[1] === "(none)" ? null : m[1], ponder: m[2] };
}

/**
 * Parse one `info ...` search line. Returns null when the line carries
 * no usable score (currmove lines, option echoes, ...). Lines with
 * `lowerbound`/`upperbound` are accepted as-is.
 */
export function parseInfoLine(line: string): ParsedInfo | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== "info" || tokens.length < 2) return null;

  let multipv = 1;
  let depth = 0;
  let cp: number | undefined;
  let mate: number | undefined;
  let pv: string[] = [];
  let hasScore = false;

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "multipv") {
      multipv = Number(tokens[++i] ?? 1) || 1;
    } else if (t === "depth" && depth === 0) {
      depth = Number(tokens[++i] ?? 0) || 0;
    } else if (t === "score") {
      const kind = tokens[++i];
      const value = Number(tokens[++i]);
      if (kind === "cp" && Number.isFinite(value)) {
        cp = value;
        mate = undefined;
        hasScore = true;
      } else if (kind === "mate" && Number.isFinite(value)) {
        mate = value;
        cp = undefined;
        hasScore = true;
      }
    } else if (t === "pv") {
      pv = tokens.slice(i + 1);
      break;
    }
  }

  if (!hasScore) return null;
  const info: ParsedInfo = { multipv, depth, pv };
  if (cp !== undefined) info.cp = cp;
  if (mate !== undefined) info.mate = mate;
  return info;
}

/**
 * Convert a side-to-move score into White's perspective.
 * This is the ONLY place where the conversion happens.
 */
export function toWhitePerspective(
  score: { cp?: number; mate?: number },
  sideToMove: SideToMove,
): { cp?: number; mate?: number } {
  if (sideToMove === "w") return { ...score };
  const out: { cp?: number; mate?: number } = {};
  if (score.cp !== undefined) out.cp = -score.cp;
  if (score.mate !== undefined) out.mate = -score.mate;
  return out;
}

/** Merge a parsed info line into an EvalLine (already White perspective). */
export function toEvalLine(info: ParsedInfo): EvalLine {
  const line: EvalLine = { multipv: info.multipv, depth: info.depth, pv: info.pv };
  if (info.cp !== undefined) line.cp = info.cp;
  if (info.mate !== undefined) line.mate = info.mate;
  return line;
}
