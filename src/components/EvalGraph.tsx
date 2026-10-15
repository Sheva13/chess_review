"use client";

import { useRef } from "react";

export interface GraphPoint {
  ply: number;
  ep: number;
}

interface EvalGraphProps {
  points: GraphPoint[];
  maxPly: number;
  activePly: number;
  onSelect: (ply: number) => void;
}

/** Clickable evaluation graph (EP 0..1, White up). No fabricated data. */
export function EvalGraph({ points, maxPly, activePly, onSelect }: EvalGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  if (points.length === 0 || maxPly <= 0) {
    return (
      <div className="px-4 py-8 text-center text-[13px] leading-6" style={{ color: "#7A766F" }}>
        Jalankan review untuk melihat grafik evaluasi.
      </div>
    );
  }

  const W = 100;
  const H = 40;
  const PAD = 2;
  const x = (ply: number) => PAD + (ply / maxPly) * (W - PAD * 2);
  const y = (ep: number) => PAD + (1 - Math.min(1, Math.max(0, ep))) * (H - PAD * 2);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.ply).toFixed(2)},${y(p.ep).toFixed(2)}`).join(" ");
  const active = points.reduce((a, b) => (Math.abs(b.ply - activePly) < Math.abs(a.ply - activePly) ? b : a));

  const handleClick = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSelect(Math.round(Math.min(1, Math.max(0, ratio)) * maxPly));
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="block h-[120px] w-full cursor-pointer"
      onClick={handleClick}
      role="img"
      aria-label="Grafik evaluasi"
    >
      <line
        x1={PAD}
        y1={y(0.5)}
        x2={W - PAD}
        y2={y(0.5)}
        stroke="#4A4641"
        strokeWidth={0.4}
        vectorEffect="non-scaling-stroke"
        strokeDasharray="2 1.5"
      />
      <path d={d} fill="none" stroke="#81B64C" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
      <line
        x1={x(active.ply)}
        y1={0}
        x2={x(active.ply)}
        y2={H}
        stroke="#ADA23E"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        opacity={0.8}
      />
      <circle cx={x(active.ply)} cy={y(active.ep)} r={2.2} fill="#ADA23E">
        <title>{`Langkah ${active.ply}`}</title>
      </circle>
    </svg>
  );
}
