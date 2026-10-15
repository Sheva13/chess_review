import { NextRequest, NextResponse } from "next/server";
import { countPositionEvals, deleteMoveClasses, getGame } from "@/lib/db";
import { classifyAndSave } from "@/lib/review/runner";
import { CLASSIFIER_VERSION } from "@/lib/analysis/classifier";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Recompute labels from stored evals (no engine). Bumps classifier version. */
export async function POST(
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
  if (game.review_status !== "done" || countPositionEvals(id) === 0) {
    return errorResponse(
      "REVIEW_INCOMPLETE",
      "Review belum selesai, tidak bisa hitung ulang.",
      409,
    );
  }

  try {
    deleteMoveClasses(id);
    classifyAndSave(id);
  } catch {
    return errorResponse("CLASSIFY_FAILED", "Gagal menghitung ulang label.", 500);
  }

  const updated = getGame(id);
  return NextResponse.json(
    {
      summary: updated?.summary ? JSON.parse(updated.summary) : null,
      classifierVersion: CLASSIFIER_VERSION,
    },
    { status: 200 },
  );
}
