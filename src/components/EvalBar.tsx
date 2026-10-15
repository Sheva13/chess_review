"use client";

import { epFromWhite } from "../lib/analysis/ep";

function formatEval(cp: number | null, mate: number | null): string {
  if (mate !== null && mate !== undefined) {
    return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  }
  if (cp === null || cp === undefined) return "";
  const v = cp / 100;
  return (v >= 0 ? "+" : "") + v.toFixed(1);
}

/** Vertical evaluation bar, White at the bottom. Scores in White perspective. */
export function EvalBar({
  cp,
  mate,
}: {
  cp: number | null;
  mate: number | null;
}) {
  const frac = epFromWhite(cp, mate);

  return (
    <div className="flex w-6 shrink-0 flex-col gap-1">
      <div
        className="relative flex-1 overflow-hidden border"
        style={{ borderColor: "#3C3833", backgroundColor: "#1A1A1A", minHeight: 0 }}
        title="Evaluasi (putih di bawah)"
      >
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: `${Math.round(frac * 100)}%`, backgroundColor: "#E8E8E8" }}
        />
      </div>
      <div
        className="text-center font-mono text-[10px] tabular-nums leading-4"
        style={{ color: "#A09A94" }}
      >
        {formatEval(cp, mate)}
      </div>
    </div>
  );
}
