import { NextRequest } from "next/server";
import {
  countPositionEvals,
  getGame,
} from "@/lib/db";
import { reviewStatus, subscribe } from "@/lib/review/runner";
import type { ReviewEvent } from "@/lib/review/runner";

const encoder = new TextEncoder();

function send(
  controller: ReadableStreamDefaultController,
  event: string,
  data: unknown,
): void {
  try {
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  } catch {
    // Client already gone.
  }
}

function snapshot(gameId: number): { event: string; data: unknown } | null {
  const game = getGame(gameId);
  if (!game) return { event: "error", data: { code: "NOT_FOUND", message: "Game tidak ditemukan." } };
  if (game.review_status === "running" || reviewStatus()?.gameId === gameId) {
    return {
      event: "progress",
      data: { done: countPositionEvals(gameId), total: game.ply_count + 1 },
    };
  }
  if (game.review_status === "done") {
    return { event: "done", data: { summary: null } };
  }
  if (game.review_status === "cancelled") {
    return { event: "cancelled", data: { done: countPositionEvals(gameId) } };
  }
  return {
    event: "progress",
    data: { done: countPositionEvals(gameId), total: game.ply_count + 1 },
  };
}

/** SSE progress stream. Late joiners receive the current status first. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gameId = Number((await params).id);
  if (!Number.isInteger(gameId)) {
    return new Response(`event: error\ndata: ${JSON.stringify({ code: "NOT_FOUND" })}\n\n`, {
      status: 404,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  let unsubscribe: (() => void) | null = null;
  const managed = new ReadableStream({
    start(controller) {
      unsubscribe = subscribe(gameId, (ev: ReviewEvent) => {
        if (ev.type === "progress") send(controller, "progress", { done: ev.done, total: ev.total });
        else if (ev.type === "position")
          send(controller, "position", { ply: ev.ply, lines: ev.lines, bestUci: ev.bestUci });
        else if (ev.type === "done") {
          send(controller, "done", { summary: ev.summary });
          setTimeout(() => {
            try {
              controller.close();
            } catch {
              // Already closed.
            }
          }, 50);
        } else if (ev.type === "cancelled") {
          send(controller, "cancelled", { done: ev.done });
          setTimeout(() => {
            try {
              controller.close();
            } catch {
              // Already closed.
            }
          }, 50);
        } else {
          send(controller, "error", { code: ev.code, message: ev.message });
        }
      });
      const first = snapshot(gameId);
      if (first) send(controller, first.event, first.data);
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(managed, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
