"use client";

import {
  BookOpen,
  Check,
  Crosshair,
  Star,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import type { MoveLabel } from "../types";

export interface LabelMeta {
  /** Text glyph for classic annotations (!! ! ?! ? ??). Null when an icon is used. */
  symbol: string | null;
  /** Lucide icon for non-classic labels. Null when a text glyph is used. */
  icon: LucideIcon | null;
  color: string;
  name: string;
}

/**
 * Single source of truth for move-classification badges.
 * Classic chess annotation keeps its text glyph; the rest use icons.
 * Change one entry here and it updates everywhere.
 */
export const LABEL_META: Record<MoveLabel, LabelMeta> = {
  brilliant: { symbol: "!!", icon: null, color: "#2E9D8F", name: "Brilliant" },
  great: { symbol: "!", icon: null, color: "#5B8A5E", name: "Great" },
  best: { symbol: null, icon: Star, color: "#4A7A4E", name: "Best" },
  excellent: { symbol: null, icon: ThumbsUp, color: "#7AAB6E", name: "Excellent" },
  good: { symbol: null, icon: Check, color: "#8A9E80", name: "Good" },
  book: { symbol: null, icon: BookOpen, color: "#8B9AAA", name: "Book" },
  inaccuracy: { symbol: "?!", icon: null, color: "#C4A53D", name: "Inaccuracy" },
  mistake: { symbol: "?", icon: null, color: "#D4823E", name: "Mistake" },
  miss: { symbol: null, icon: Crosshair, color: "#8B6BA8", name: "Miss" },
  blunder: { symbol: "??", icon: null, color: "#B85450", name: "Blunder" },
};

/** Translucent tint of a 6-digit hex color. Default 14% alpha. */
export function tint(color: string, alphaHex = "24"): string {
  return `${color}${alphaHex}`;
}

export function MoveBadge({ label }: { label: MoveLabel }) {
  const meta = LABEL_META[label];
  const Icon = meta.icon;
  return (
    <span
      title={meta.name}
      aria-label={meta.name}
      className="flex shrink-0 items-center justify-center px-1 font-mono text-[11px] font-bold leading-5"
      style={{ color: meta.color }}
    >
      {Icon ? <Icon size={11} strokeWidth={2.5} /> : meta.symbol}
    </span>
  );
}
