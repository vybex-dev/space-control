import React, { useState } from "react";
import { useSimulation, useAlertAcknowledge, relativeTime } from "../context/SimulationContext";
import { Panel, NoSpacecraftDataPanel } from "./Panel";
import { Spacecraft, Subsystem, Alert, AlertSeverity, SubsystemKey } from "../types";
import { useFlashOnChange } from "../context/SimulationContext";

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: "#22d3ee",
  warning: "#fbbf24",
  critical: "#f87171",
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// --- 7a. Link status panel ---------------------------------------------------

type LinkState = "locked" | "searching" | "lost";

function linkStateFromSignal(signalStrength: number): LinkState {
  if (signalStrength >= -125) return "locked";
  if (signalStrength >= -145) return "searching";
  return "lost";
}

const LINK_STATE_COLORS: Record<LinkState, string> = {
  locked: "#4ade80",
  searching: "#fbbf24",
  lost: "#f87171",
};

function SignalWaveform({
  signalStrength,
  color,
}: {
  signalStrength: number;
  color: string;
}) {
  const strength = clamp((signalStrength + 160) / (160 - 85), 0.08, 1);
  const bars = 24;
  return (
    <div className="flex items-end gap-[3px] h-10">
      <style>{`
        @keyframes aegis-wave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      {Array.from({ length: bars }).map((_, i) => {
        const baseHeight = 20 + Math.sin(i * 0.9) * 14 * strength;
        return (
          <div
            key={i}
            className="w-[3px] rounded-full origin-bottom"
            style={{
              height: `${Math.max(4, baseHeight * strength * 2.2)}px`,
              maxHeight: 40,
              background: color,
              opacity: 0.35 + strength * 0.5,
              animation: `aegis-wave ${0.6 + (i % 5) * 0.12}s ease-in-out ${i * 0.03}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

function SignalBars({
  signalStrength,
  color,
}: {
  signalStrength: number;
  color: string;
}) {
  const strength = clamp((signalStrength + 160) / (160 - 85), 0, 1);
  const activeBars = Math.round(strength * 5);
  return (
    <div className="flex items-end gap-1 h-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="w-1.5 rounded-sm transition-all duration-500"
          style={{
            height: `${6 + i * 3.5}px`,
            background: i < activeBars ? color : "#1a2138",
            boxShadow: i < activeBars ? `0 0 4px ${color}` : "none",
          }}
        />
      ))}
    </div>
  );
}

function LinkCard({
  label,
  linkState,
  dataRate,
  latency,
  signalStrength,
}: {
  label: string;
  linkState: LinkState;
  dataRate: number;
  latency: number;
  signalStrength: number;
}) {
  const color = LINK_STATE_COLORS[linkState];
  const isLost = linkState === "lost";

  return (
    <div
      className="rounded-sm border p-4 flex flex-col gap-3 transition-all duration-300"
      style={{
        background: isLost ? "rgba(248,113,113,0.06)" : "#0d1220",
        borderColor: isLost ? "rgba(248,113,113,0.5)" : "#1a2138",
        boxShadow: isLost ? "0 0 20px rgba(248,113,113,0.12)" : "none",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold tracking-wide"
          style={{
            color: "#8b93a7",
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
          }}
        >
          {label.toUpperCase()}
        </span>
        <span className="relative flex items-center gap-1.5">
          {isLost && (
            <span
              className="animate-ping absolute -left-3.5 top-1/2 -translate-y-1/2 inline-flex h-2 w-2 rounded-full opacity-70"
              style={{ background: color }}
            />
          )}
          <span
            className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-sm"
            style={{
              color,
              background: `${color}1a`,
              border: `1px solid ${color}40`,
            }}
          >
            {linkState.toUpperCase()}
          </span>
        </span>
      </div>

      <SignalWaveform signalStrength={signalStrength} color={color} />

      <div
        className="grid grid-cols-3 gap-2 pt-2 border-t"
        style={{ borderColor: "#1a2138" }}
      >
        <div>
          <div
            className="text-[9px] font-mono mb-0.5"
            style={{ color: "#7b8499" }}
          >
            RATE
          </div>
          <div
            className="text-sm font-mono font-semibold tabular-nums"
            style={{ color: "#e5e7eb" }}
          >
            {dataRate.toFixed(1)}{" "}
            <span className="text-[10px]" style={{ color: "#7b8499" }}>
              Mbps
            </span>
          </div>
        </div>
        <div>
          <div
            className="text-[9px] font-mono mb-0.5"
            style={{ color: "#7b8499" }}
          >
            LATENCY
          </div>
          <div
            className="text-sm font-mono font-semibold tabular-nums"
            style={{ color: "#e5e7eb" }}
          >
            {latency}{" "}
            <span className="text-[10px]" style={{ color: "#7b8499" }}>
              ms
            </span>
          </div>
        </div>
        <div>
          <div
            className="text-[9px] font-mono mb-0.5"
            style={{ color: "#7b8499" }}
          >
            SIGNAL
          </div>
          <SignalBars signalStrength={signalStrength} color={color} />
        </div>
      </div>
    </div>
  );
}

function LinkStatusPanel({ craft }: { craft: Spacecraft }) {
  const linkState = linkStateFromSignal(craft.signalStrength);
  const downlinkSignal =
    craft.signalStrength + (craft.signalStrength % 7 === 0 ? -6 : 3);
  const downlinkState = linkStateFromSignal(downlinkSignal);

  const dataRateUp = clamp(2.4 + (craft.signalStrength + 160) / 20, 0.2, 12);
  const dataRateDown = clamp(8.1 + (downlinkSignal + 160) / 14, 0.4, 22);
  const latencyUp = Math.round(
    clamp(240 - (craft.signalStrength + 160) * 1.1, 40, 900),
  );
  const latencyDown = Math.round(
    clamp(210 - (downlinkSignal + 160) * 1.1, 40, 900),
  );

  return (
    <Panel title="Link Status" eyebrow={craft.name}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LinkCard
          label="Uplink"
          linkState={linkState}
          dataRate={dataRateUp}
          latency={latencyUp}
          signalStrength={craft.signalStrength}
        />
        <LinkCard
          label="Downlink"
          linkState={downlinkState}
          dataRate={dataRateDown}
          latency={latencyDown}
          signalStrength={downlinkSignal}
        />
      </div>
    </Panel>
  );
}

// --- 7b. System health grid with radial gauges -------------------------------

function healthColor(health: number): string {
  if (health > 85) return "#4ade80";
  if (health >= 60) return "#fbbf24";
  return "#f87171";
}

function healthLabel(health: number): string {
  if (health > 85) return "NOMINAL";
  if (health >= 60) return "DEGRADED";
  return "CRITICAL";
}

function RadialGauge({
  value,
  color,
  size = 84,
}: {
  value: number;
  color: string;
  size?: number;
}) {
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamp(value, 0, 100) / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1a2138"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-lg font-mono font-bold tabular-nums"
          style={{ color }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

export { RadialGauge };

function SubsystemGaugeCard({ subsystem }: { subsystem: Subsystem }) {
  const color = healthColor(subsystem.health);
  const label = healthLabel(subsystem.health);
  const isCritical = subsystem.health < 60;
  const flash = useFlashOnChange(subsystem.health);

  return (
    <div
      className="rounded-sm border p-4 flex flex-col items-center gap-2 text-center transition-all duration-300"
      style={{
        background: isCritical
          ? "rgba(248,113,113,0.06)"
          : flash
            ? "rgba(34,211,238,0.05)"
            : "#0d1220",
        borderColor: isCritical ? "rgba(248,113,113,0.55)" : "#1a2138",
        boxShadow: isCritical ? "0 0 20px rgba(248,113,113,0.15)" : "none",
      }}
    >
      <div className="relative">
        {isCritical && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-40"
            style={{ background: color }}
          />
        )}
        <RadialGauge value={subsystem.health} color={color} />
      </div>
      <span
        className="text-xs font-semibold tracking-wide mt-1"
        style={{
          color: "#e5e7eb",
          fontFamily: "'Space Grotesk', 'Inter', sans-serif",
        }}
      >
        {subsystem.label.toUpperCase()}
      </span>
      <span className="text-[10px] font-mono tracking-wider" style={{ color }}>
        ● {label}
      </span>
    </div>
  );
}

function SystemHealthGrid({ craft }: { craft: Spacecraft }) {
  return (
    <Panel
      title="System Health Overview"
      eyebrow={`${craft.systemHealth}% AGGREGATE`}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {craft.subsystems.map((s) => (
          <SubsystemGaugeCard key={s.key} subsystem={s} />
        ))}
      </div>
    </Panel>
  );
}

// --- 7c. Live alert log (filterable + acknowledgeable) -----------------------

type AlertFilter = "all" | AlertSeverity;

const SUBSYSTEM_LABELS: Record<SubsystemKey, string> = {
  power: "POWER",
  thermal: "THERMAL",
  comms: "COMMS",
  propulsion: "PROPULSION",
  navigation: "NAVIGATION",
};

function SeverityIcon({
  severity,
  color,
}: {
  severity: AlertSeverity;
  color: string;
}) {
  if (severity === "critical") {
    return (
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke={color}
        strokeWidth="2"
      >
        <path d="M12 3l10 18H2L12 3Z" strokeLinejoin="round" />
        <path d="M12 10v4M12 17.5v.01" strokeLinecap="round" />
      </svg>
    );
  }
  if (severity === "warning") {
    return (
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke={color}
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 15.5v.01" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke={color}
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.01" strokeLinecap="round" />
    </svg>
  );
}

function AlertLogRow({ alert }: { alert: Alert }) {
  const { missions, utcNow } = useSimulation();
  const acknowledgeAlert = useAlertAcknowledge();
  const mission = missions.find((m) => m.id === alert.missionId);
  const color = SEVERITY_COLORS[alert.severity];
  const isCriticalActive =
    alert.severity === "critical" && !alert.resolved && !alert.acknowledged;

  return (
    <div
      className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 border-b last:border-b-0 transition-opacity duration-300 text-left"
      style={{ borderColor: "#1a2138", opacity: alert.acknowledged ? 0.5 : 1 }}
    >
      <span
        className="relative flex items-center justify-center w-6 h-6 mt-0.5 shrink-0 rounded-sm"
        style={{ background: `${color}1a` }}
      >
        {isCriticalActive && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-sm opacity-40"
            style={{ background: color }}
          />
        )}
        <SeverityIcon severity={alert.severity} color={color} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs leading-snug" style={{ color: "#e5e7eb" }}>
            {alert.message}
          </p>
          <span
            className="text-[10px] font-mono shrink-0 mt-0.5"
            style={{ color: "#7b8499" }}
          >
            {relativeTime(alert.timestamp, utcNow)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <span
            className="text-[10px] font-mono tracking-wide"
            style={{ color }}
          >
            {alert.severity.toUpperCase()}
          </span>
          {alert.subsystem && (
            <>
              <span style={{ color: "#7b8499" }}>·</span>
              <span
                className="text-[9px] font-mono tracking-wide px-1.5 py-0.5 rounded-sm"
                style={{ color: "#8b93a7", background: "#1a2138" }}
              >
                {SUBSYSTEM_LABELS[alert.subsystem]}
              </span>
            </>
          )}
          {mission && (
            <>
              <span style={{ color: "#7b8499" }}>·</span>
              <span
                className="text-[10px] font-mono"
                style={{ color: "#7b8499" }}
              >
                {mission.name}
              </span>
            </>
          )}
          {alert.resolved && (
            <>
              <span style={{ color: "#7b8499" }}>·</span>
              <span
                className="text-[10px] font-mono"
                style={{ color: "#4ade80" }}
              >
                RESOLVED
              </span>
            </>
          )}
          <div className="flex-1" />
          {alert.acknowledged ? (
            <span
              className="text-[10px] font-mono tracking-wide"
              style={{ color: "#7b8499" }}
            >
              ACKNOWLEDGED
            </span>
          ) : (
            <button
              onClick={() => acknowledgeAlert(alert.id)}
              aria-label={`Acknowledge alert: ${alert.message}`}
              className="text-[10px] font-mono tracking-wide px-2 py-0.5 rounded-sm border transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 cursor-pointer"
              style={{
                color: "#8b93a7",
                borderColor: "#1a2138",
                outlineColor: "#22d3ee",
              }}
            >
              ACKNOWLEDGE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const ALERT_FILTERS: { key: AlertFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "info", label: "Info" },
  { key: "warning", label: "Warning" },
  { key: "critical", label: "Critical" },
];

function LiveAlertLogPanel({ missionId }: { missionId: string | null }) {
  const { alerts } = useSimulation();
  const [filter, setFilter] = useState<AlertFilter>("all");

  const missionAlerts = alerts.filter((a) => a.missionId === missionId);
  const filtered =
    filter === "all"
      ? missionAlerts
      : missionAlerts.filter((a) => a.severity === filter);
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <Panel
      title="Live Alert Log"
      eyebrow={`${missionAlerts.filter((a) => !a.acknowledged).length} UNACK'D`}
    >
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {ALERT_FILTERS.map((f) => {
          const isActive = filter === f.key;
          const count =
            f.key === "all"
              ? missionAlerts.length
              : missionAlerts.filter((a) => a.severity === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={isActive}
              className="text-[10px] font-mono tracking-wide px-2.5 py-1 rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 cursor-pointer"
              style={{
                color: isActive ? "#22d3ee" : "#8b93a7",
                borderColor: isActive ? "rgba(34,211,238,0.5)" : "#1a2138",
                background: isActive ? "rgba(34,211,238,0.08)" : "transparent",
                outlineColor: "#22d3ee",
              }}
            >
              {f.label.toUpperCase()}{" "}
              <span style={{ color: "#7b8499" }}>({count})</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col max-h-[360px] overflow-y-auto -mr-1 pr-1">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="text-xs font-mono" style={{ color: "#7b8499" }}>
              NO ALERTS IN THIS FILTER
            </span>
          </div>
        ) : (
          sorted.map((a) => <AlertLogRow key={a.id} alert={a} />)
        )}
      </div>
    </Panel>
  );
}

// --- 7d. Communication timeline mini-chart -----------------------------------

function CommsTimelinePanel({ craft }: { craft: Spacecraft }) {
  const trend = craft.history.power.map((p) => {
    const powerDelta = p - craft.powerLevel;
    return Math.round(
      clamp(craft.signalStrength + powerDelta * 0.4, -160, -85),
    );
  });
  const latest = trend[trend.length - 1] ?? craft.signalStrength;
  const state = linkStateFromSignal(latest);
  const color = LINK_STATE_COLORS[state];

  const width = 600;
  const height = 64;
  const min = -160;
  const max = -85;
  const points = trend.map((v, i) => {
    const x = (i / Math.max(1, trend.length - 1)) * width;
    const y = height - ((v - min) / (max - min)) * height;
    return { x, y };
  });
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  const recentAvg =
    trend.slice(-5).reduce((s, v) => s + v, 0) / Math.min(5, trend.length);
  const earlierAvg =
    trend.slice(0, 5).reduce((s, v) => s + v, 0) / Math.min(5, trend.length);
  const degrading = recentAvg < earlierAvg - 3;

  return (
    <Panel
      title="Communication Timeline"
      eyebrow={`${craft.name} · SIGNAL TREND`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono" style={{ color: "#7b8499" }}>
          LAST {trend.length} TICKS
        </span>
        {degrading ? (
          <span
            className="text-[10px] font-mono tracking-wide px-2 py-0.5 rounded-sm"
            style={{
              color: "#fbbf24",
              background: "rgba(251,191,36,0.1)",
              border: "1px solid rgba(251,191,36,0.3)",
            }}
          >
            ▼ DEGRADING
          </span>
        ) : (
          <span
            className="text-[10px] font-mono tracking-wide px-2 py-0.5 rounded-sm"
            style={{
              color: "#4ade80",
              background: "rgba(74,222,128,0.1)",
              border: "1px solid rgba(74,222,128,0.3)",
            }}
          >
            ● STABLE
          </span>
        )}
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        preserveAspectRatio="none"
      >
        <path d={area} fill={color} opacity="0.1" />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 3px ${color}88)` }}
        />
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="3"
            fill={color}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        )}
      </svg>
      <div
        className="flex items-center justify-between mt-2 text-[10px] font-mono"
        style={{ color: "#7b8499" }}
      >
        <span>{min} dBm</span>
        <span style={{ color }}>{latest} dBm CURRENT</span>
        <span>{max} dBm</span>
      </div>
    </Panel>
  );
}

// --- Comms & Health screen root -----------------------------------------------

export function CommsHealthScreen() {
  const { spacecraft, missions, selectedMissionId } = useSimulation();
  const selectedMission =
    missions.find((m) => m.id === selectedMissionId) ?? missions[0];
  const focused = spacecraft.find((s) => s.missionId === selectedMissionId);

  if (!focused) {
    return (
      <div className="flex flex-col gap-4">
        <NoSpacecraftDataPanel mission={selectedMission} />
        <LiveAlertLogPanel missionId={selectedMission.id} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <LinkStatusPanel craft={focused} />
      <SystemHealthGrid craft={focused} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <LiveAlertLogPanel missionId={focused.missionId} />
        <CommsTimelinePanel craft={focused} />
      </div>
    </div>
  );
}
