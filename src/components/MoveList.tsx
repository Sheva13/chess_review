"use client";

import { useEffect, useRef } from "react";
import type { MoveLabel } from "../types";
import { LABEL_META, MoveBadge } from "./MoveLabel";

interface MoveRecord {
  ply: number;
  san: string;
  color: string;
}

interface MoveListProps {
  moves: MoveRecord[];
  activePly: number;
  onPlyChange: (ply: number) => void;
  dark?: boolean;
  /** Optional classification per ply. Absent = plain list, no fake badges. */
  labels?: Partial<Record<number, MoveLabel>>;
}

export function MoveList({
  moves,
  activePly,
  onPlyChange,
  labels,
}: MoveListProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activePly]);

  if (moves.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-[14px] leading-7" style={{ color: "#7A766F" }}>
        Belum ada langkah. Muat game untuk mulai.
      </div>
    );
  }

  const pairs: Array<{
    num: number;
    white?: MoveRecord;
    black?: MoveRecord;
  }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  const renderMove = (m: MoveRecord) => {
    const active = activePly === m.ply;
    const label: MoveLabel | undefined = labels?.[m.ply];
    const meta = label !== undefined ? LABEL_META[label] : null;
    return (
      <div key={m.ply} className="flex items-center justify-center px-2">
        <button
          ref={active ? activeRef : undefined}
          onClick={() => onPlyChange(m.ply)}
          className="flex w-full items-center px-3 py-0.5 font-mono text-[13.5px] leading-5 transition-colors"
          style={{
            backgroundColor: active ? "#ADA23E" : "transparent",
            color: active ? "#1A1A1A" : meta ? meta.color : "#E8E8E8",
            fontWeight: active || meta ? 700 : 400,
          }}
          onMouseEnter={(e) => {
            if (!active) e.currentTarget.style.backgroundColor = "#3A3835";
          }}
          onMouseLeave={(e) => {
            if (!active) e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <span className="flex-1 text-center">{m.san}</span>
          {label !== undefined && meta && <MoveBadge label={label} />}
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-0 overflow-y-auto px-3 py-1">
      {pairs.map((pair, idx) => (
        <div
          key={pair.num}
          className="grid shrink-0 grid-cols-[3rem_1fr_1fr] items-center px-1.5 py-0"
          style={{ backgroundColor: idx % 2 === 0 ? "#262421" : "#2E2C29" }}
        >
          <div
            className="flex items-center justify-center py-0.5 font-mono text-[12px] tabular-nums leading-5"
            style={{ color: "#7A766F" }}
          >
            {pair.num}
          </div>
          {pair.white ? renderMove(pair.white) : <div />}
          {pair.black ? renderMove(pair.black) : <div />}
        </div>
      ))}
    </div>
  );
}
