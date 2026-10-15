"use client";

import type { MoveLabel } from "../types";
import { LABEL_META, MoveBadge } from "./MoveLabel";

interface MoveCardProps {
  san: string;
  label: MoveLabel;
  reason: string;
}

/** "Langkah ini" card: played move, label badge and factual reason. */
export function MoveCard({ san, label, reason }: MoveCardProps) {
  const meta = LABEL_META[label];
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[14px] font-semibold leading-5" style={{ color: "#EDEDED" }}>
          {san}
        </span>
        <MoveBadge label={label} />
        <span className="text-[11.5px] leading-5" style={{ color: meta.color }}>
          {meta.name}
        </span>
      </div>
      <p className="mt-0.5 text-[12px] leading-5" style={{ color: "#A09A94" }}>
        {reason}
      </p>
    </div>
  );
}
