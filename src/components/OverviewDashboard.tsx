import React from "react";
import { useSimulation, useMissionSelect, useFlashOnChange, relativeTime } from "../context/SimulationContext";
import { Panel } from "./Panel";
import { MissionStatus, Alert, AlertSeverity } from "../types";

export const STATUS_COLORS: Record<MissionStatus, string> = {
  active: "#4ade80",
  completed: "#22d3ee",
  planned: "#a78bfa",
  warning: "#fbbf24",
};

export const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: "#22d3ee",
  warning: "#fbbf24",
  critical: "#f87171",
};

// Tiny inline SVG sparkline - reused across KPI cards and telemetry readouts.
// Deliberately dependency-free (just a polyline over a normalized viewBox).
function Sparkline({
  data,
  color,
  width = 72,
  height = 24,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2)
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        style={{ maxWidth: `${width}px`, height: `${height}px` }}
      />
    );
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full overflow-visible"
      style={{ maxWidth: `${width}px`, height: `${height}px` }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

function KpiCard({
  title,
  value,
  valueColor,
  statusLabel,
  statusColor,
  sparklineData,
  sparklineColor,
  flashKey,
}: {
  title: string;
  value: string | number;
  valueColor: string;
  statusLabel: string;
  statusColor: string;
  sparklineData?: number[];
  sparklineColor?: string;
  flashKey: number; // numeric value to watch for the flash-on-change effect
}) {
  const flash = useFlashOnChange(flashKey);
  return (
    <div
      className="rounded-sm border p-4 md:p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: flash ? "rgba(34,211,238,0.06)" : "#0d1220",
        borderColor: flash ? "rgba(34,211,238,0.5)" : "#1a2138",
        boxShadow: flash
          ? "0 0 0 1px rgba(34,211,238,0.15), 0 0 20px rgba(34,211,238,0.15)"
          : "none",
      }}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <h3
          className="text-xs font-semibold tracking-wide min-w-0 truncate"
          style={{
            color: "#8b93a7",
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
          }}
        >
          {title.toUpperCase()}
        </h3>
        {sparklineData && sparklineColor && (
          <div className="flex-1 min-w-[30px] max-w-[72px] flex justify-end">
            <Sparkline data={sparklineData} color={sparklineColor} />
          </div>
        )}
      </div>
      <div className="flex items-end justify-between">
        <span
          className="text-3xl font-mono font-bold tabular-nums transition-colors duration-300"
          style={{ color: valueColor }}
        >
          {value}
        </span>
        <span
          className="text-xs font-mono mb-0.5"
          style={{ color: statusColor }}
        >
          ● {statusLabel}
        </span>
      </div>
    </div>
  );
}

export function KpiRow() {
  const { missions, spacecraft, alerts } = useSimulation();

  const activeCount = missions.filter((m) => m.status === "active").length;
  const nominalCount = missions.filter(
    (m) => m.status === "active" || m.status === "completed",
  ).length;
  const warningCount = missions.filter((m) => m.status === "warning").length;

  const unresolvedAlerts = alerts.filter((a) => !a.resolved);
  const criticalCount = unresolvedAlerts.filter(
    (a) => a.severity === "critical",
  ).length;
  const warningAlertCount = unresolvedAlerts.filter(
    (a) => a.severity === "warning",
  ).length;

  const onlineCount = spacecraft.length;
  // Fleet-wide averaged power history, used as a proxy "trend" sparkline for
  // the Spacecraft Online card (shows fleet health direction at a glance).
  const fleetPowerTrend = Array.from({ length: 20 }).map((_, i) =>
    Math.round(
      spacecraft.reduce(
        (sum, s) => sum + (s.history.power[i] ?? s.powerLevel),
        0,
      ) / spacecraft.length,
    ),
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Active Missions"
        value={activeCount}
        valueColor="#22d3ee"
        statusLabel={`${missions.length} TOTAL`}
        statusColor="#7b8499"
        flashKey={activeCount}
      />
      <KpiCard
        title="Mission Status"
        value={`${nominalCount}/${warningCount}`}
        valueColor="#e5e7eb"
        statusLabel={
          warningCount > 0 ? `${warningCount} WARNING` : "ALL NOMINAL"
        }
        statusColor={warningCount > 0 ? "#fbbf24" : "#4ade80"}
        flashKey={nominalCount * 100 + warningCount}
      />
      <KpiCard
        title="Alerts"
        value={unresolvedAlerts.length}
        valueColor={
          criticalCount > 0
            ? "#f87171"
            : warningAlertCount > 0
              ? "#fbbf24"
              : "#4ade80"
        }
        statusLabel={
          criticalCount > 0
            ? `${criticalCount} CRITICAL`
            : warningAlertCount > 0
              ? `${warningAlertCount} WARNING`
              : "CLEAR"
        }
        statusColor={
          criticalCount > 0
            ? "#f87171"
            : warningAlertCount > 0
              ? "#fbbf24"
              : "#4ade80"
        }
        flashKey={unresolvedAlerts.length * 10 + criticalCount}
      />
      <KpiCard
        title="Spacecraft Online"
        value={onlineCount}
        valueColor="#e5e7eb"
        statusLabel="ONLINE"
        statusColor="#4ade80"
        sparklineData={fleetPowerTrend}
        sparklineColor="#4ade80"
        flashKey={onlineCount}
      />
    </div>
  );
}

interface DonutSlice {
  label: string;
  value: number; // percentage points, should sum to ~100 across slices
  color: string;
}

function MissionProgressDonut({
  slices,
  centerLabel,
}: {
  slices: DonutSlice[];
  centerLabel: number;
}) {
  const size = 180;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* base track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1a2138"
            strokeWidth={strokeWidth}
          />
          {slices.map((slice) => {
            const dash = (slice.value / 100) * circumference;
            const gap = circumference - dash;
            const offset = -((cumulative / 100) * circumference);
            cumulative += slice.value;
            return (
              <circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                className="transition-all duration-700 ease-out"
                style={{ filter: `drop-shadow(0 0 4px ${slice.color}66)` }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-3xl font-mono font-bold tabular-nums"
            style={{ color: "#e5e7eb" }}
          >
            {centerLabel}%
          </span>
          <span
            className="text-[10px] font-mono tracking-wider"
            style={{ color: "#7b8499" }}
          >
            OVERALL
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 w-full sm:w-auto text-left">
        {slices.map((slice) => (
          <div
            key={slice.label}
            className="flex items-center justify-between gap-4 sm:gap-8 min-w-[160px]"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{
                  background: slice.color,
                  boxShadow: `0 0 6px ${slice.color}`,
                }}
              />
              <span className="text-xs font-mono" style={{ color: "#8b93a7" }}>
                {slice.label}
              </span>
            </div>
            <span
              className="text-sm font-mono font-semibold tabular-nums"
              style={{ color: "#e5e7eb" }}
            >
              {slice.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissionProgressPanel() {
  const { missions } = useSimulation();

  // Derive completed/in-progress/planned buckets from mission status + progress,
  // matching the reference proportions (72 / 18 / 10) while staying driven by
  // the actual mock data rather than hardcoded numbers.
  const completedPct = Math.round(
    missions.reduce((sum, m) => sum + m.progress, 0) / missions.length,
  );
  const activeCount = missions.filter((m) => m.status === "active").length;
  const plannedCount = missions.filter((m) => m.status === "planned").length;
  const totalNonCompleted = Math.max(1, missions.length);
  const inProgressPct = Math.round(
    (activeCount / totalNonCompleted) * 100 * 0.25,
  );
  const plannedPct =
    Math.max(0, 100 - completedPct - inProgressPct) ||
    (plannedCount > 0 ? 10 : 100 - completedPct);

  const slices: DonutSlice[] = [
    { label: "Completed", value: completedPct, color: "#22d3ee" },
    {
      label: "In Progress",
      value: Math.min(inProgressPct, 100 - completedPct),
      color: "#3b82f6",
    },
    {
      label: "Planned",
      value: Math.max(
        0,
        100 - completedPct - Math.min(inProgressPct, 100 - completedPct),
      ),
      color: "#fbbf24",
    },
  ];

  return (
    <Panel title="Mission Progress" eyebrow="FLEET AGGREGATE">
      <MissionProgressDonut slices={slices} centerLabel={completedPct} />
    </Panel>
  );
}

function StatusBadge({ status }: { status: MissionStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono tracking-wide shrink-0"
      style={{
        color,
        background: `${color}1a`,
        border: `1px solid ${color}40`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      {status.toUpperCase()}
    </span>
  );
}

function MissionListPanel() {
  const { missions, selectedMissionId } = useSimulation();
  const selectMission = useMissionSelect();

  return (
    <Panel
      title="Mission List"
      eyebrow={`${missions.length} MISSIONS`}
      className="h-full"
    >
      <div
        className="flex flex-col divide-y max-h-[420px] overflow-y-auto -mr-1 pr-1"
        style={{ borderColor: "#1a2138" }}
      >
        {missions.map((m) => {
          const isSelected = m.id === selectedMissionId;
          const color = STATUS_COLORS[m.status];
          return (
            <button
              key={m.id}
              onClick={() => selectMission(m.id)}
              aria-pressed={isSelected}
              aria-label={`Select mission ${m.name}`}
              className="text-left py-3 first:pt-0 last:pb-0 group transition-colors focus-visible:outline-none focus-visible:ring-2 rounded-sm cursor-pointer"
              style={{ borderColor: "#1a2138", outlineColor: "#22d3ee" }}
            >
              <div
                className="rounded-sm px-3 py-2.5 -mx-3 transition-all duration-200"
                style={{
                  background: isSelected
                    ? "rgba(34,211,238,0.08)"
                    : "transparent",
                  boxShadow: isSelected
                    ? "inset 2px 0 0 0 #22d3ee"
                    : "none",
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className="text-sm font-semibold truncate transition-colors animate-[pulse_2s_infinite]"
                    style={{
                      color: isSelected ? "#22d3ee" : "#e5e7eb",
                      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                    }}
                  >
                    {m.name}
                  </span>
                  <StatusBadge status={m.status} />
                </div>
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex-1 h-1.5 rounded-full"
                    style={{ background: "#1a2138" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${m.progress}%`,
                        background: color,
                        boxShadow: `0 0 6px ${color}88`,
                      }}
                    />
                  </div>
                  <span
                    className="text-[11px] font-mono tabular-nums shrink-0"
                    style={{ color: "#8b93a7" }}
                  >
                    {m.progress}%
                  </span>
                </div>
                <div
                  className="text-[10px] font-mono mt-1.5"
                  style={{ color: "#7b8499" }}
                >
                  {m.phase}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function AlertRow({ alert, isNew }: { alert: Alert; isNew: boolean }) {
  const { missions, utcNow } = useSimulation();
  const mission = missions.find((m) => m.id === alert.missionId);
  const color = SEVERITY_COLORS[alert.severity];

  return (
    <div
      className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 border-b last:border-b-0 text-left"
      style={{
        borderColor: "#1a2138",
        opacity: alert.resolved ? 0.45 : 1,
        animation: isNew ? "aegis-alert-in 500ms ease-out" : undefined,
      }}
    >
      <span className="relative flex h-2.5 w-2.5 mt-1 shrink-0">
        {alert.severity === "critical" && !alert.resolved && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70"
            style={{ background: color }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2.5 w-2.5"
          style={{ background: color }}
        />
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
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-[10px] font-mono tracking-wide"
            style={{ color }}
          >
            {alert.severity.toUpperCase()}
          </span>
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
        </div>
      </div>
    </div>
  );
}

function LiveAlertsFeedPanel() {
  const { alerts, newlyAddedAlertIds } = useSimulation();

  // Sort unresolved-first, then most recent - keeps the feed actionable.
  const sorted = [...alerts].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return (
    <Panel
      title="Live Alerts"
      eyebrow={`${alerts.filter((a) => !a.resolved).length} ACTIVE`}
      className="h-full"
    >
      <style>{`
        @keyframes aegis-alert-in {
          0% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="flex flex-col max-h-[420px] overflow-y-auto -mr-1 pr-1">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="text-xs font-mono" style={{ color: "#7b8499" }}>
              NO ALERTS RECORDED
            </span>
          </div>
        ) : (
          sorted.map((a) => (
            <AlertRow
              key={a.id}
              alert={a}
              isNew={newlyAddedAlertIds.includes(a.id)}
            />
          ))
        )}
      </div>
    </Panel>
  );
}

export function OverviewPlaceholder() {
  return (
    <div className="flex flex-col gap-4">
      <KpiRow />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <MissionProgressPanel />
        </div>
        <div className="lg:col-span-1">
          <MissionListPanel />
        </div>
        <div className="lg:col-span-1">
          <LiveAlertsFeedPanel />
        </div>
      </div>
    </div>
  );
}
