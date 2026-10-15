import { NextRequest, NextResponse } from "next/server";
import { getGame } from "@/lib/db";
import { cancelReview, reviewStatus, runReview } from "@/lib/review/runner";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Start a full review. Fire-and-forget; progress arrives via SSE. */
export async function POST(
  request: NextRequest,
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

  const body = await request.json().catch(() => null);
  const movetimeMs =
    body && typeof body.movetimeMs === "number" && body.movetimeMs > 0
      ? Math.floor(body.movetimeMs)
      : undefined;
  const force = body?.force === true;

  if (reviewStatus()) {
    return errorResponse("ENGINE_BUSY", "Ada review lain yang berjalan.", 409);
  }
  if (game.review_status === "done" && !force) {
    return NextResponse.json({ status: "done" }, { status: 200 });
  }

  void runReview(id, movetimeMs);
  return NextResponse.json({ status: "running" }, { status: 202 });
}

/** Cancel the running review. Partial results stay saved. */
export async function DELETE(
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
  cancelReview(id);
  const current = getGame(id);
  return NextResponse.json(
    { status: current?.review_status ?? game.review_status },
    { status: 202 },
  );
}
