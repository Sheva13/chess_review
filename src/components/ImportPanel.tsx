"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, ClipboardPaste, Hash } from "lucide-react";

type Tab = "paste" | "upload" | "fen";

interface GameData {
  pgn?: string;
  fen?: string;
  startFen: string;
  moves: Array<{
    ply: number;
    san: string;
    from: string;
    to: string;
    color: string;
    fenBefore: string;
    fenAfter: string;
  }>;
  white: string;
  black: string;
  result: string;
}

interface ImportPanelProps {
  onGameLoaded: (data: GameData, rawPgn?: string, id?: number | null) => void;
}

interface GameChoice {
  index: number;
  white: string;
  black: string;
  result: string;
}

export function ImportPanel({ onGameLoaded }: ImportPanelProps) {
  const [tab, setTab] = useState<Tab>("paste");
  const [pgnText, setPgnText] = useState("");
  const [fenText, setFenText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [choices, setChoices] = useState<GameChoice[] | null>(null);
  const [choiceIndex, setChoiceIndex] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleError = useCallback(async (res: Response) => {
    const body = await res.json().catch(() => null);
    setError(body?.error?.message ?? "Terjadi kesalahan.");
    setLoading(false);
  }, []);

  const submitPgn = useCallback(
    async (pgn: string, index?: number) => {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pgn, source: "paste", ...(index !== undefined ? { index } : {}) }),
        });
        if (!res.ok) return handleError(res);
        const data = await res.json();
        if (data.games) {
          setChoices(data.games);
          setChoiceIndex(0);
          return;
        }
        setChoices(null);
        onGameLoaded(data.game, data.pgn ?? pgn, data.id ?? null);
      } catch {
        setError("Gagal terhubung ke server.");
      } finally {
        setLoading(false);
      }
    },
    [handleError, onGameLoaded],
  );

  const submitFen = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: fenText.trim() }),
      });
      if (!res.ok) return handleError(res);
      const data = await res.json();
      onGameLoaded(data.game, undefined);
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }, [fenText, handleError, onGameLoaded]);

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > 200000) {
        setError("File terlalu besar (maksimal 200 KB).");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result);
        setPgnText(text);
        submitPgn(text);
      };
      reader.onerror = () => setError("Gagal membaca file.");
      reader.readAsText(file);
    },
    [submitPgn],
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "paste", label: "Paste PGN", icon: <ClipboardPaste size={14} /> },
    { id: "upload", label: "Upload", icon: <Upload size={14} /> },
    { id: "fen", label: "FEN", icon: <Hash size={14} /> },
  ];

  const inputClass =
    "w-full border px-3.5 py-3 font-mono text-[13px] leading-6 focus:outline-none transition-colors";

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex gap-1 border p-1"
        style={{ borderColor: "#3C3833", backgroundColor: "#1F1E1B" }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setError(null);
            }}
            className="flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-[13px] font-medium leading-5 transition-colors"
            style={{
              backgroundColor: tab === t.id ? "#3C3833" : "transparent",
              color: tab === t.id ? "#FFFFFF" : "#7A766F",
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "paste" && (
        <div className="flex flex-col gap-3">
          <textarea
            value={pgnText}
            onChange={(e) => setPgnText(e.target.value)}
            placeholder={"[Event ...]\n1. e4 e5 2. Nf3 Nc6 ..."}
            rows={8}
            className={inputClass}
            style={{
              borderColor: "#3C3833",
              backgroundColor: "#1F1E1B",
              color: "#E8E8E8",
            }}
          />
          <button
            onClick={() => submitPgn(pgnText)}
            disabled={loading || !pgnText.trim()}
            className="px-4 py-3 text-[14px] font-semibold leading-6 transition-colors disabled:opacity-40"
            style={{ backgroundColor: "#81B64C", color: "#FFFFFF" }}
          >
            {loading ? "Memuat..." : "Muat Game"}
          </button>
        </div>
      )}

      {tab === "upload" && (
        <div className="flex flex-col gap-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            onClick={() => fileInput.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-2.5 border-2 border-dashed px-4 py-10 text-center transition-colors"
            style={{
              borderColor: dragOver ? "#81B64C" : "#3C3833",
              backgroundColor: dragOver ? "#2E2C29" : "#1F1E1B",
            }}
          >
            <Upload size={22} style={{ color: "#7A766F" }} />
            <span className="text-[14px]" style={{ color: "#A09A94" }}>
              Tarik file .pgn ke sini
            </span>
            <span className="text-[12px]" style={{ color: "#7A766F" }}>
              atau klik untuk memilih
            </span>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".pgn"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      )}

      {tab === "fen" && (
        <div className="flex flex-col gap-3">
          <input
            value={fenText}
            onChange={(e) => setFenText(e.target.value)}
            placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            className={inputClass}
            style={{
              borderColor: "#3C3833",
              backgroundColor: "#1F1E1B",
              color: "#E8E8E8",
            }}
          />
          <button
            onClick={submitFen}
            disabled={loading || !fenText.trim()}
            className="px-4 py-3 text-[14px] font-semibold leading-6 transition-colors disabled:opacity-40"
            style={{ backgroundColor: "#81B64C", color: "#FFFFFF" }}
          >
            {loading ? "Memuat..." : "Muat Posisi"}
          </button>
        </div>
      )}

      {choices && choices.length > 1 && (
        <div className="flex flex-col gap-2">
          <label className="text-[13px] leading-5" style={{ color: "#A09A94" }}>
            File berisi {choices.length} game, pilih satu:
          </label>
          <select
            value={choiceIndex}
            onChange={(e) => setChoiceIndex(Number(e.target.value))}
            className="w-full border px-3 py-2.5 text-[13px] leading-5"
            style={{ borderColor: "#3C3833", backgroundColor: "#1F1E1B", color: "#E8E8E8" }}
          >
            {choices.map((c) => (
              <option key={c.index} value={c.index}>
                {c.white} vs {c.black} ({c.result})
              </option>
            ))}
          </select>
          <button
            onClick={() => submitPgn(pgnText, choiceIndex)}
            disabled={loading || !pgnText.trim()}
            className="px-4 py-3 text-[14px] font-semibold leading-6 transition-colors disabled:opacity-40"
            style={{ backgroundColor: "#81B64C", color: "#FFFFFF" }}
          >
            {loading ? "Memuat..." : "Muat Game Terpilih"}
          </button>
        </div>
      )}

      {error && (
        <div
          className="border-l-2 px-4 py-3 text-[13px] leading-5"
          style={{
            borderLeftColor: "#E58A8A",
            backgroundColor: "rgba(229,138,138,0.08)",
            color: "#E58A8A",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
