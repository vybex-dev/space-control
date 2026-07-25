import React, { useState, useEffect } from "react";

const BOOT_LINES = [
  "INITIALIZING AEGIS MISSION CONTROL...",
  "ESTABLISHING UPLINK...",
  "CALIBRATING TELEMETRY FEEDS...",
  "LOADING MISSION DATABASE...",
  "SYSTEMS NOMINAL.",
];

export function BootSequence({ onDone }: { onDone: () => void }) {
  const [lineIdx, setLineIdx] = useState(0);
  const [skipHint, setSkipHint] = useState(false);

  useEffect(() => {
    if (lineIdx >= BOOT_LINES.length) {
      const t = setTimeout(onDone, 260);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLineIdx((i) => i + 1), 260);
    return () => clearTimeout(t);
  }, [lineIdx, onDone]);

  useEffect(() => {
    const t = setTimeout(() => setSkipHint(true), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") onDone();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onDone]);

  const progressPct = Math.min(
    100,
    Math.round((lineIdx / BOOT_LINES.length) * 100),
  );

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDone}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer"
      style={{
        background: "#05070d",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes aegis-boot-line-in {
          0% { opacity: 0; transform: translateX(-6px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes aegis-boot-fade-out {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      <div className="flex flex-col items-center gap-1 mb-8">
        <span style={{ color: "#22d3ee" }}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            width="40"
            height="40"
            aria-hidden="true"
          >
            <path
              d="M12 2 3 6v6c0 5 3.8 8.7 9 10 5.2-1.3 9-5 9-10V6l-9-4Z"
              strokeLinejoin="round"
            />
            <path
              d="M9 12l2 2 4-4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span
          className="font-bold tracking-[0.3em] text-2xl mt-2"
          style={{
            color: "#e5e7eb",
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
          }}
        >
          AEGIS
        </span>
        <span
          className="text-[10px] font-mono tracking-[0.25em]"
          style={{ color: "#94a3b8" }}
        >
          MISSION CONTROL SYSTEM
        </span>
      </div>

      <div className="w-64 sm:w-80 flex flex-col gap-2">
        {BOOT_LINES.slice(0, lineIdx).map((line, i) => (
          <div
            key={line}
            className="text-[11px] font-mono flex items-center gap-2"
            style={{
              color:
                i === lineIdx - 1 && i === BOOT_LINES.length - 1
                  ? "#4ade80"
                  : "#cbd5e1",
              animation: "aegis-boot-line-in 220ms ease-out",
            }}
          >
            <span
              style={{
                color: i === BOOT_LINES.length - 1 ? "#4ade80" : "#22d3ee",
              }}
            >
              {i === BOOT_LINES.length - 1 ? "✓" : "›"}
            </span>
            {line}
          </div>
        ))}

        <div
          className="mt-3 h-1 rounded-full overflow-hidden"
          style={{ background: "#1a2138" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progressPct}%`,
              background: "linear-gradient(90deg, #22d3ee, #4ade80)",
              boxShadow: "0 0 8px rgba(34,211,238,0.6)",
            }}
          />
        </div>
      </div>

      {skipHint && (
        <span
          className="mt-8 text-[10px] font-mono tracking-wide"
          style={{
            color: "#94a3b8",
            animation: "aegis-boot-line-in 300ms ease-out",
          }}
        >
          PRESS ANY KEY OR CLICK TO SKIP
        </span>
      )}
    </div>
  );
}
