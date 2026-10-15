import { NextRequest, NextResponse } from "next/server";
import { validateFenString } from "@/lib/chess";
import {
  EngineBusyError,
  EngineFailedError,
  getEngine,
} from "@/lib/engine/manager";

const MAX_MOVETIME_MS = 10000;
const MAX_MULTIPV = 5;

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? Math.floor(value) : fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const fen = body?.fen;

  if (typeof fen !== "string" || fen.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "INVALID_FEN", message: "Field 'fen' wajib diisi." } },
      { status: 400 },
    );
  }

  const check = validateFenString(fen.trim());
  if (!check.ok) {
    return NextResponse.json(
      { error: { code: "INVALID_FEN", message: check.error ?? "FEN tidak valid." } },
      { status: 400 },
    );
  }

  const movetimeMs = clampInt(body?.movetimeMs ?? 2000, 2000, 1, MAX_MOVETIME_MS);
  const multipv = clampInt(body?.multipv ?? 2, 2, 1, MAX_MULTIPV);

  try {
    const result = await getEngine().analyze(fen.trim(), { movetimeMs, multipv });
    return NextResponse.json(
      { fen: fen.trim(), lines: result.lines, bestUci: result.bestUci, depth: result.depth },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof EngineBusyError) {
      return NextResponse.json(
        { error: { code: "ENGINE_BUSY", message: "Engine sedang sibuk, coba lagi sebentar." } },
        { status: 409 },
      );
    }
    const message = err instanceof EngineFailedError ? err.message : "Engine gagal.";
    return NextResponse.json(
      { error: { code: "ENGINE_FAILED", message } },
      { status: 500 },
    );
  }
}
