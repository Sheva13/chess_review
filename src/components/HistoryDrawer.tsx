"use client";

import { Trash2, X } from "lucide-react";

export interface HistoryGame {
  id: number;
  white: string;
  black: string;
  result: string;
  played_at: string | null;
  review_status: string;
}

interface HistoryDrawerProps {
  open: boolean;
  games: HistoryGame[];
  activeId: number | null;
  onClose: () => void;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
}

const STATUS_TEXT: Record<string, string> = {
  none: "Belum",
  running: "Jalan",
  done: "Selesai",
  cancelled: "Batal",
  failed: "Gagal",
};

export function HistoryDrawer({ open, games, activeId, onClose, onOpen, onDelete }: HistoryDrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.55)" }} onClick={onClose} />
      <aside
        className="absolute inset-y-0 right-0 flex w-[340px] max-w-[90vw] flex-col border-l"
        style={{ backgroundColor: "#262421", borderColor: "#3C3833" }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "#3C3833" }}
        >
          <span className="text-[14px] font-semibold leading-6" style={{ color: "#EDEDED" }}>
            Riwayat
          </span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center transition-colors"
            style={{ color: "#A09A94" }}
            title="Tutup"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {games.length === 0 && (
            <div className="px-5 py-10 text-center text-[13px] leading-6" style={{ color: "#7A766F" }}>
              Belum ada game tersimpan.
            </div>
          )}
          {games.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-3 border-b px-5 py-3"
              style={{
                borderColor: "#3C3833",
                backgroundColor: g.id === activeId ? "#2E2C29" : "transparent",
              }}
            >
              <button onClick={() => onOpen(g.id)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-[13.5px] font-medium leading-6" style={{ color: "#EDEDED" }}>
                  {g.white} vs {g.black}
                </div>
                <div className="text-[12px] leading-5" style={{ color: "#7A766F" }}>
                  {g.result} · {STATUS_TEXT[g.review_status] ?? g.review_status}
                  {g.played_at ? ` · ${g.played_at}` : ""}
                </div>
              </button>
              <button
                onClick={() => onDelete(g.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center transition-colors"
                style={{ color: "#7A766F" }}
                title="Hapus game"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
