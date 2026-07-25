import React, { ReactNode } from "react";

export function Panel({
  title,
  eyebrow,
  children,
  className = "",
  glow = false,
}: {
  title: string;
  eyebrow?: string;
  children?: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`rounded-sm border p-4 md:p-5 flex flex-col ${className}`}
      style={{
        background: "#0d1220",
        borderColor: glow ? "rgba(34,211,238,0.4)" : "#1a2138",
        boxShadow: glow
          ? "0 0 0 1px rgba(34,211,238,0.08), 0 0 24px rgba(34,211,238,0.08)"
          : "none",
      }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h3
          className="text-sm font-semibold tracking-wide"
          style={{
            color: "#e5e7eb",
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
          }}
        >
          {title}
        </h3>
        {eyebrow && (
          <span className="text-[10px] font-mono" style={{ color: "#7b8499" }}>
            {eyebrow}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function NoSpacecraftDataPanel({ mission }: { mission: { name: string; status: string } }) {
  const STATUS_COLORS: Record<string, string> = {
    active: "#4ade80",
    completed: "#22d3ee",
    planned: "#a78bfa",
    warning: "#fbbf24",
  };

  return (
    <Panel title="No Live Telemetry" eyebrow={mission.name}>
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <div
          className="w-12 h-12 rounded-full border flex items-center justify-center"
          style={{ borderColor: "rgba(139,147,167,0.35)", color: "#7b8499" }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            width="20"
            height="20"
          >
            <path d="M4 18h2v-4H4v4Zm7 0h2V9h-2v9Zm7 0h2V4h-2v14Z" />
          </svg>
        </div>
        <div>
          <p
            className="text-sm font-semibold"
            style={{
              color: "#e5e7eb",
              fontFamily: "'Space Grotesk', 'Inter', sans-serif",
            }}
          >
            No spacecraft telemetry available
          </p>
          <p
            className="text-xs font-mono mt-1.5 max-w-xs"
            style={{ color: "#7b8499" }}
          >
            {mission.name} has no active craft reporting live data
            {mission.status === "completed" ? " — mission has concluded." : "."}
          </p>
        </div>
        <span
          className="text-[10px] font-mono tracking-wide px-2.5 py-1 rounded-sm border"
          style={{
            color: STATUS_COLORS[mission.status] || "#8b93a7",
            borderColor: `${STATUS_COLORS[mission.status] || "#8b93a7"}40`,
            background: `${STATUS_COLORS[mission.status] || "#8b93a7"}1a`,
          }}
        >
          STATUS: {mission.status.toUpperCase()}
        </span>
      </div>
    </Panel>
  );
}
