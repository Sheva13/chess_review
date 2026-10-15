"use client";

import { useEffect, useRef } from "react";
import { Chessboard, type SquareRenderer } from "react-chessboard";
import type { BoardArrow } from "../lib/chess";
import type { MoveLabel } from "../types";
import { LABEL_META, tint } from "./MoveLabel";

interface BoardProps {
  fen: string;
  flipped?: boolean;
  lastMove?: { from: string; to: string } | null;
  arrows?: BoardArrow[];
  /** Label of the active move: tints its destination square + corner badge. */
  squareLabel?: { square: string; label: MoveLabel } | null;
  /** Allow dragging pieces (exploration). Return true to accept the drop. */
  draggable?: boolean;
  onDropMove?: (from: string, to: string) => boolean;
  /** Selected square + legal targets (click-to-move hints). */
  selection?: { square: string; targets: string[] } | null;
  onSquareClick?: (square: string) => void;
}

/** Background tint + solid chip color for a labeled destination square. */
export function labelSquareStyles(label: MoveLabel): { tintBg: string; chipBg: string } {
  const color = LABEL_META[label].color;
  return { tintBg: tint(color, "73"), chipBg: color };
}

export function Board({
  fen,
  flipped = false,
  lastMove = null,
  arrows = [],
  squareLabel = null,
  draggable = false,
  onDropMove,
  selection = null,
  onSquareClick,
}: BoardProps) {
  // react-chessboard memoizes its drag-end handler without onPieceDrop
  // in deps, so a fresh inline callback would go stale after the first
  // render. This ref always forwards to the latest handlers.
  const handlersRef = useRef({ onDropMove, onSquareClick });
  useEffect(() => {
    handlersRef.current = { onDropMove, onSquareClick };
  });

  const squareStyles: Record<string, React.CSSProperties> = {};

  if (lastMove) {
    const highlight = { backgroundColor: "rgba(205, 210, 60, 0.45)" };
    squareStyles[lastMove.from] = highlight;
    if (!squareLabel || squareLabel.square !== lastMove.to) {
      squareStyles[lastMove.to] = highlight;
    }
  }

  const renderSquare: SquareRenderer = ({ square, children }) => {
    const labeled = squareLabel && square === squareLabel.square;
    const meta = labeled ? LABEL_META[squareLabel.label] : null;
    const Icon = meta?.icon ?? null;
    const isSelected = !!selection && square === selection.square;
    const isHint = !!selection && !labeled && selection.targets.includes(square);
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          containerType: "size",
          ...(labeled && meta
            ? { backgroundColor: labelSquareStyles(squareLabel.label).tintBg }
            : isSelected
              ? { backgroundColor: "rgba(215, 215, 60, 0.6)" }
              : squareStyles[square]),
        }}
      >
        {children}
        {isHint && (
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "26%",
              aspectRatio: "1",
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              backgroundColor: "rgba(20, 40, 30, 0.35)",
              pointerEvents: "none",
            }}
          />
        )}
        {labeled && meta && (
          <span
            title={meta.name}
            style={{
              position: "absolute",
              top: "4%",
              right: "4%",
              width: "30%",
              aspectRatio: "1",
              backgroundColor: labelSquareStyles(squareLabel.label).chipBg,
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "20cqw",
              lineHeight: 1,
              fontFamily: "monospace",
            }}
          >
            {Icon ? <Icon size="1em" strokeWidth={2.75} /> : meta.symbol}
          </span>
        )}
      </div>
    );
  };

  return (
    <Chessboard
      options={{
        position: fen,
        boardOrientation: flipped ? "black" : "white",
        allowDragging: draggable,
        onPieceDrop: ({ sourceSquare, targetSquare }) => {
          if (!targetSquare || sourceSquare === targetSquare) return false;
          return handlersRef.current.onDropMove?.(sourceSquare, targetSquare) ?? false;
        },
        onSquareClick: ({ square }) => {
          handlersRef.current.onSquareClick?.(square);
        },
        showAnimations: true,
        animationDurationInMs: 150,
        darkSquareStyle: { backgroundColor: "#769656" },
        lightSquareStyle: { backgroundColor: "#EEEED2" },
        squareStyles,
        squareRenderer: renderSquare,
        arrows: arrows.map((a) => ({
          startSquare: a.from,
          endSquare: a.to,
          color: a.color,
        })),
        boardStyle: {
          width: "100%",
          height: "100%",
        },
        darkSquareNotationStyle: {
          color: "#EEEED2",
          fontSize: "10px",
          fontWeight: 600,
        },
        lightSquareNotationStyle: {
          color: "#769656",
          fontSize: "10px",
          fontWeight: 600,
        },
      }}
    />
  );
}
