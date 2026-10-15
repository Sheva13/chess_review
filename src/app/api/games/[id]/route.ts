import { NextRequest, NextResponse } from "next/server";
import { parsePgn } from "@/lib/chess";
import {
  deleteGame,
  getGame,
  getMoveClasses,
  getPositionEvals,
} from "@/lib/db";
import { PgnError } from "@/types";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return errorResponse("NOT_FOUND", "Game tidak ditemukan.", 404);
  }
  const game = getGame(id);
  if (!game) {
    return errorResponse("NOT_FOUND", "Game tidak ditemukan.", 404);
  }

  let moves: unknown[] = [];
  try {
    const parsed = parsePgn(game.pgn);
    moves = parsed.moves.map((m) => ({
      ply: m.ply,
      san: m.san,
      from: m.from,
      to: m.to,
      color: m.color,
      fenBefore: m.fenBefore,
      fenAfter: m.fenAfter,
    }));
  } catch (err) {
    if (!(err instanceof PgnError)) throw err;
    // Stored PGN that no longer parses: still return metadata + evals.
  }

  return NextResponse.json(
    {
      id: game.id,
      white: game.white,
      black: game.black,
      result: game.result,
      event: game.event,
      played_at: game.played_at,
      source: game.source,
      startFen: game.start_fen,
      ply_count: game.ply_count,
      review_status: game.review_status,
      engine_version: game.engine_version,
      engine_config: game.engine_config,
      classifier_version: game.classifier_version,
      summary: game.summary ? JSON.parse(game.summary) : null,
      pgn: game.pgn,
      moves,
      evals: getPositionEvals(id),
      classes: getMoveClasses(id).map((c) => ({
        ...c,
        meta: c.meta ? JSON.parse(c.meta) : null,
      })),
    },
    { status: 200 },
  );
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return errorResponse("NOT_FOUND", "Game tidak ditemukan.", 404);
  }
  if (!deleteGame(id)) {
    return errorResponse("NOT_FOUND", "Game tidak ditemukan.", 404);
  }
  return new NextResponse(null, { status: 204 });
}
