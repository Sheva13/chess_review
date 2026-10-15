import { NextRequest, NextResponse } from "next/server";
import {
  detectMultipleGames,
  hashPgn,
  parsePgn,
  parsePgnGame,
  validateFenString,
} from "@/lib/chess";
import type { ParsedGame } from "@/types";
import {
  createGame,
  findGameByHash,
  listGames,
} from "@/lib/db";
import { PgnError } from "@/types";
import type { GameSource } from "@/types";

function gamePayload(id: number, game: ParsedGame) {
  return {
    id,
    white: game.headers.white,
    black: game.headers.black,
    result: game.headers.result,
    event: game.headers.event,
    playedAt: game.headers.playedAt,
    plyCount: game.plyCount,
    startFen: game.startFen,
    moves: game.moves.map((m) => ({
      ply: m.ply,
      san: m.san,
      from: m.from,
      to: m.to,
      color: m.color,
      fenBefore: m.fenBefore,
      fenAfter: m.fenAfter,
    })),
  };
}

export async function GET() {
  return NextResponse.json(listGames(), { status: 200 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return errorResponse("INVALID_PGN", "Body bukan JSON yang valid.", 400);
  }

  const { pgn, fen, source, index } = body as {
    pgn?: string;
    fen?: string;
    source?: GameSource;
    index?: number;
  };

  if (fen && typeof fen === "string") {
    return handleFen(fen);
  }

  if (!pgn || typeof pgn !== "string") {
    return errorResponse("INVALID_PGN", "Field 'pgn' wajib diisi.", 400);
  }

  return handlePgn(pgn, source ?? "paste", index);
}

function handlePgn(pgn: string, source: GameSource, index?: number) {
  try {
    if (typeof index !== "number") {
      const multi = detectMultipleGames(pgn);
      if (multi.length > 1) {
        return NextResponse.json({ games: multi }, { status: 200 });
      }
    }

    const game = typeof index === "number" ? parsePgnGame(pgn, index) : parsePgn(pgn);
    const pgnHash = hashPgn(game.pgn);

    const existing = findGameByHash(pgnHash);
    if (existing) {
      return NextResponse.json(
        { id: existing.id, duplicate: true, game: gamePayload(existing.id, game) },
        { status: 200 },
      );
    }

    const row = createGame({
      pgn: game.pgn,
      pgnHash,
      white: game.headers.white,
      black: game.headers.black,
      result: game.headers.result,
      event: game.headers.event,
      playedAt: game.headers.playedAt,
      source,
      startFen: game.headers.fen,
      plyCount: game.plyCount,
    });

    return NextResponse.json(
      { id: row.id, duplicate: false, game: gamePayload(row.id, game), pgn: game.pgn, source },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof PgnError) {
      const status = err.code === "PAYLOAD_TOO_LARGE" ? 413 : 400;
      return errorResponse(err.code, err.message, status);
    }
    return errorResponse("INVALID_PGN", "PGN tidak valid.", 400);
  }
}

function handleFen(fen: string) {
  const result = validateFenString(fen);
  if (!result.ok) {
    return errorResponse("INVALID_FEN", result.error ?? "FEN tidak valid.", 400);
  }

  return NextResponse.json(
    {
      fen,
      game: {
        startFen: fen,
        plyCount: 0,
        moves: [],
        white: "?",
        black: "?",
        result: "*",
      },
      source: "fen",
    },
    { status: 201 },
  );
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
