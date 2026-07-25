import React, { useState, useEffect } from "react";
import { useSimulation } from "../context/SimulationContext";
import { Panel } from "./Panel";
import { Mission, Spacecraft, Alert, PhaseStatus, TimelinePhase } from "../types";
import { RadialGauge } from "./CommsHealthScreen";
import { STATUS_COLORS } from "./OverviewDashboard";
import { SEED_TIMELINES, HISTORY_LENGTH } from "../constants/mockData";

// --- 8a. Mission phase timeline -----------------------------------------------

const CANONICAL_PHASES = [
  "Launch",
  "Orbit Insertion",
  "System Check",
  "Payload Ops",
  "Data Downlink",
  "Mission End",
];
const PHASE_OFFSETS = [
  "T-0",
  "T+00:15",
  "T+02:30",
  "T+05:40",
  "T+08:10",
  "T+12:00",
];

const PHASE_DETAILS: Record<string, { desc: string; owner: string }> = {
  Launch: {
    desc: "Liftoff and ascent through max-Q to stage separation.",
    owner: "Range Control",
  },
  "Orbit Insertion": {
    desc: "Circularization burn and initial orbit determination.",
    owner: "Flight Dynamics",
  },
  "System Check": {
    desc: "Full subsystem checkout — power, thermal, comms, attitude.",
    owner: "Systems Eng.",
  },
  "Payload Ops": {
    desc: "Payload activation and primary mission operations begin.",
    owner: "Payload Ops",
  },
  "Data Downlink": {
    desc: "Scheduled downlink window — telemetry and payload data transfer.",
    owner: "Ground Station",
  },
  "Mission End": {
    desc: "Deorbit / safing sequence and mission closeout.",
    owner: "Mission Director",
  },
};

function deriveTimelineForMission(mission: Mission): TimelinePhase[] {
  const seeded = SEED_TIMELINES[mission.id];
  if (seeded) return seeded;

  const idx = Math.max(0, CANONICAL_PHASES.indexOf(mission.phase));
  return CANONICAL_PHASES.map((label, i) => ({
    label,
    timeOffset: PHASE_OFFSETS[i],
    status: i < idx ? "completed" : i === idx ? "current" : "upcoming",
  })) as TimelinePhase[];
}

const PHASE_STATUS_COLOR: Record<PhaseStatus, string> = {
  completed: "#4ade80",
  current: "#22d3ee",
  upcoming: "#7b8499",
};

function TimelineNode({
  phase,
  isFirst,
  isLast,
  isActive,
  onToggle,
}: {
  phase: TimelinePhase;
  isFirst: boolean;
  isLast: boolean;
  isActive: boolean;
  onToggle: () => void;
}) {
  const color = PHASE_STATUS_COLOR[phase.status];
  const detail = PHASE_DETAILS[phase.label];

  return (
    <div className="relative flex-1 flex flex-col items-center min-w-[92px]">
      {/* Tooltip / detail card */}
      {isActive && detail && (
        <div
          className="absolute bottom-full mb-3 z-20 w-52 rounded-sm border p-3 text-left"
          style={{
            background: "#0d1220",
            borderColor: `${color}55`,
            boxShadow: `0 0 0 1px ${color}22, 0 8px 24px rgba(0,0,0,0.5)`,
            left: isFirst ? 0 : isLast ? "auto" : "50%",
            right: isLast ? 0 : "auto",
            transform: isFirst || isLast ? "none" : "translateX(-50%)",
            animation: "aegis-tooltip-in 180ms ease-out",
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-xs font-semibold"
              style={{
                color: "#e5e7eb",
                fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              }}
            >
              {phase.label}
            </span>
            <span
              className="text-[10px] font-mono tracking-wide"
              style={{ color }}
            >
              {phase.status.toUpperCase()}
            </span>
          </div>
          <p
            className="text-[11px] leading-snug mb-1.5"
            style={{ color: "#8b93a7" }}
          >
            {detail.desc}
          </p>
          <div
            className="flex items-center justify-between text-[10px] font-mono"
            style={{ color: "#7b8499" }}
          >
            <span>{phase.timeOffset}</span>
            <span>{detail.owner}</span>
          </div>
        </div>
      )}

      <button
        onClick={onToggle}
        className="relative flex items-center justify-center rounded-full transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 cursor-pointer"
        style={{ width: 22, height: 22, outlineColor: color }}
        aria-label={`${phase.label} — ${phase.status}${detail ? `. ${detail.desc}` : ""}`}
        aria-expanded={isActive}
      >
        {phase.status === "current" && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-50"
            style={{ background: color }}
          />
        )}
        <span
          className="relative rounded-full transition-all duration-300"
          style={{
            width: phase.status === "upcoming" ? 14 : 22,
            height: phase.status === "upcoming" ? 14 : 22,
            background: phase.status === "upcoming" ? "transparent" : color,
            border: `2px solid ${color}`,
            boxShadow:
              phase.status !== "upcoming" ? `0 0 10px ${color}aa` : "none",
          }}
        />
      </button>

      <span
        className="mt-2.5 text-[11px] font-semibold text-center leading-tight px-1"
        style={{
          color: phase.status === "upcoming" ? "#8b93a7" : "#e5e7eb",
          fontFamily: "'Space Grotesk', 'Inter', sans-serif",
        }}
      >
        {phase.label}
      </span>
      <span
        className="mt-0.5 text-[10px] font-mono"
        style={{ color: "#7b8499" }}
      >
        {phase.timeOffset}
      </span>
    </div>
  );
}

function MissionPhaseTimelinePanel({ mission }: { mission: Mission }) {
  const phases = deriveTimelineForMission(mission);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const lastCompletedIdx = (() => {
    let idx = -1;
    phases.forEach((p, i) => {
      if (p.status === "completed") idx = i;
      if (p.status === "current") idx = i;
    });
    return idx;
  })();
  const currentIsPartial = phases[lastCompletedIdx]?.status === "current";
  const fillFraction =
    phases.length <= 1
      ? 0
      : (lastCompletedIdx + (currentIsPartial ? 0.5 : 0)) / (phases.length - 1);

  return (
    <Panel title="Mission Phase Timeline" eyebrow={mission.name}>
      <style>{`
        @keyframes aegis-tooltip-in {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="overflow-x-auto -mx-1 px-1"
        onMouseLeave={() => setActiveIdx(null)}
      >
        <div
          className="relative flex items-start pt-1 pb-1"
          style={{ minWidth: `${phases.length * 92}px` }}
        >
          <div
            className="absolute left-0 right-0 flex items-center pointer-events-none"
            style={{ top: 11 }}
          >
            <div
              className="relative w-full h-[2px] mx-[46px]"
              style={{ background: "#1a2138" }}
            >
              <div
                className="absolute inset-y-0 left-0 h-[2px] transition-all duration-700 ease-out"
                style={{
                  width: `${fillFraction * 100}%`,
                  background: "linear-gradient(90deg, #4ade80, #22d3ee)",
                  boxShadow: "0 0 6px rgba(34,211,238,0.6)",
                }}
              />
            </div>
          </div>

          {phases.map((phase, i) => (
            <TimelineNode
              key={phase.label}
              phase={phase}
              isFirst={i === 0}
              isLast={i === phases.length - 1}
              isActive={activeIdx === i}
              onToggle={() => setActiveIdx((cur) => (cur === i ? null : i))}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
}

// --- 8b. Operational stat row --------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function trendArrow(delta: number): { symbol: string; color: string } {
  if (Math.abs(delta) < 0.05) return { symbol: "→", color: "#8b93a7" };
  return delta > 0
    ? { symbol: "▲", color: "#4ade80" }
    : { symbol: "▼", color: "#f87171" };
}

function historyLenFallback(spacecraft: Spacecraft[]): number {
  return spacecraft[0]?.history.power.length ?? HISTORY_LENGTH;
}

function OperationalStatsRow({ spacecraft }: { spacecraft: Spacecraft[] }) {
  if (spacecraft.length === 0) {
    return (
      <div
        className="rounded-sm border p-6 text-center"
        style={{ background: "#0d1220", borderColor: "#1a2138" }}
      >
        <span className="text-xs font-mono" style={{ color: "#7b8499" }}>
          NO FLEET TELEMETRY AVAILABLE
        </span>
      </div>
    );
  }

  const avgFuel = Math.round(
    spacecraft.reduce((s, c) => s + c.fuelLevel, 0) / spacecraft.length,
  );
  const totalPowerKw =
    (spacecraft.reduce((s, c) => s + c.powerLevel, 0) /
      spacecraft.length /
      100) *
    2.4 *
    spacecraft.length;
  const powerHistoryKw = Array.from({
    length: historyLenFallback(spacecraft),
  }).map(
    (_, i) =>
      (spacecraft.reduce(
        (s, c) => s + (c.history.power[i] ?? c.powerLevel),
        0,
      ) /
        100) *
      2.4,
  );
  const powerDelta =
    powerHistoryKw.length > 1
      ? powerHistoryKw[powerHistoryKw.length - 1] -
        powerHistoryKw[powerHistoryKw.length - 2]
      : 0;

  const dataUsageTb = spacecraft.reduce(
    (s, c) => s + (160 + c.signalStrength) / 40,
    0,
  );
  const dataDelta = 0.02 * spacecraft.length;

  const events24h = spacecraft.length * 3 + 10;

  const fuelColor =
    avgFuel > 50 ? "#4ade80" : avgFuel > 20 ? "#fbbf24" : "#f87171";
  const powerTrend = trendArrow(powerDelta);
  const dataTrend = trendArrow(dataDelta);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        className="rounded-sm border p-4 md:p-5 flex items-center gap-4"
        style={{ background: "#0d1220", borderColor: "#1a2138" }}
      >
        <RadialGauge value={avgFuel} color={fuelColor} size={64} />
        <div className="min-w-0 text-left">
          <div
            className="text-[10px] font-mono tracking-wide"
            style={{ color: "#7b8499" }}
          >
            FUEL LEVEL
          </div>
          <div
            className="text-xs font-mono mt-0.5"
            style={{ color: fuelColor }}
          >
            FLEET AVG
          </div>
        </div>
      </div>

      <div
        className="rounded-sm border p-4 md:p-5 flex flex-col justify-between text-left"
        style={{ background: "#0d1220", borderColor: "#1a2138" }}
      >
        <div
          className="text-[10px] font-mono tracking-wide"
          style={{ color: "#7b8499" }}
        >
          POWER GENERATION
        </div>
        <div className="flex items-end justify-between mt-2">
          <span
            className="text-2xl font-mono font-bold tabular-nums"
            style={{ color: "#e5e7eb" }}
          >
            {totalPowerKw.toFixed(2)}
          </span>
          <span
            className="text-xs font-mono mb-0.5"
            style={{ color: "#7b8499" }}
          >
            kW
          </span>
        </div>
        <span
          className="text-[11px] font-mono mt-1"
          style={{ color: powerTrend.color }}
        >
          {powerTrend.symbol} {Math.abs(powerDelta).toFixed(2)} kW
        </span>
      </div>

      <div
        className="rounded-sm border p-4 md:p-5 flex flex-col justify-between text-left"
        style={{ background: "#0d1220", borderColor: "#1a2138" }}
      >
        <div
          className="text-[10px] font-mono tracking-wide"
          style={{ color: "#7b8499" }}
        >
          DATA USAGE
        </div>
        <div className="flex items-end justify-between mt-2">
          <span
            className="text-2xl font-mono font-bold tabular-nums"
            style={{ color: "#e5e7eb" }}
          >
            {dataUsageTb.toFixed(2)}
          </span>
          <span
            className="text-xs font-mono mb-0.5"
            style={{ color: "#7b8499" }}
          >
            TB
          </span>
        </div>
        <span
          className="text-[11px] font-mono mt-1"
          style={{ color: dataTrend.color }}
        >
          {dataTrend.symbol} {dataDelta.toFixed(2)} TB/hr
        </span>
      </div>

      <div
        className="rounded-sm border p-4 md:p-5 flex flex-col justify-between text-left"
        style={{ background: "#0d1220", borderColor: "#1a2138" }}
      >
        <div
          className="text-[10px] font-mono tracking-wide"
          style={{ color: "#7b8499" }}
        >
          EVENTS (24H)
        </div>
        <div className="flex items-end justify-between mt-2">
          <span
            className="text-2xl font-mono font-bold tabular-nums"
            style={{ color: "#22d3ee" }}
          >
            {events24h}
          </span>
          <span
            className="text-xs font-mono mb-0.5"
            style={{ color: "#7b8499" }}
          >
            LOGGED
          </span>
        </div>
        <span
          className="text-[11px] font-mono mt-1"
          style={{ color: "#8b93a7" }}
        >
          ACROSS FLEET
        </span>
      </div>
    </div>
  );
}

// --- 8c. Multi-mission progress comparison ------------------------------------

function MissionProgressComparisonPanel({
  missions,
  selectedMissionId,
}: {
  missions: Mission[];
  selectedMissionId: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const sorted = [...missions].sort((a, b) => b.progress - a.progress);

  return (
    <Panel
      title="Mission Progress Comparison"
      eyebrow={`${missions.length} MISSIONS`}
    >
      <div className="flex flex-col gap-3">
        {sorted.map((m) => {
          const color = STATUS_COLORS[m.status];
          const isSelected = m.id === selectedMissionId;
          return (
            <div key={m.id} className="flex items-center gap-2 sm:gap-3">
              <span
                className="text-[10px] sm:text-[11px] font-mono w-16 sm:w-[104px] shrink-0 truncate text-left"
                style={{ color: isSelected ? "#22d3ee" : "#8b93a7" }}
                title={m.name}
              >
                {m.name}
              </span>
              <div
                className="flex-1 h-3 rounded-full relative overflow-hidden min-w-0"
                style={{ background: "#1a2138" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-[900ms] ease-out"
                  style={{
                    width: mounted ? `${m.progress}%` : "0%",
                    background: `linear-gradient(90deg, ${color}99, ${color})`,
                    boxShadow: isSelected ? `0 0 8px ${color}aa` : "none",
                  }}
                />
              </div>
              <span
                className="text-[10px] sm:text-[11px] font-mono w-8 sm:w-10 text-right tabular-nums shrink-0"
                style={{ color: "#e5e7eb" }}
              >
                {m.progress}%
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// --- 8d. Resource / efficiency chart (power vs data usage over history) ------

function buildExtendedHistory(
  spacecraft: Spacecraft[],
  targetLength: number,
): { power: number[]; data: number[] } {
  const livePower = spacecraft.length
    ? Array.from({ length: historyLenFallback(spacecraft) }).map(
        (_, i) =>
          spacecraft.reduce(
            (s, c) => s + (c.history.power[i] ?? c.powerLevel),
            0,
          ) / spacecraft.length,
      )
    : [];
  const liveLen = livePower.length;
  const padCount = Math.max(0, targetLength - liveLen);

  const prefix: number[] = [];
  let v = livePower[0] ?? 70;
  for (let i = 0; i < padCount; i++) {
    v = clamp(v + (Math.random() - 0.52) * 2.2, 40, 100);
    prefix.unshift(Number(v.toFixed(1)));
  }
  const power = [...prefix, ...livePower];
  const data = power.map((p, i) =>
    Number((2.0 + (p / 100) * 3.5 + Math.sin(i / 3) * 0.4).toFixed(2)),
  );

  return { power, data };
}

function ResourceEfficiencyChartPanel({
  spacecraft,
}: {
  spacecraft: Spacecraft[];
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 60);
    return () => clearTimeout(t);
  }, []);

  const { power, data } = buildExtendedHistory(spacecraft, 40);

  const width = 640;
  const height = 200;
  const padY = 10;

  const powerMax = 100;
  const dataMax = Math.max(...data, 1) * 1.15;

  const powerPoints = power.map((v, i) => ({
    x: (i / Math.max(1, power.length - 1)) * width,
    y: height - padY - (v / powerMax) * (height - padY * 2),
  }));
  const dataPoints = data.map((v, i) => ({
    x: (i / Math.max(1, data.length - 1)) * width,
    y: height - padY - (v / dataMax) * (height - padY * 2),
  }));

  const powerLine = powerPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const dataLine = dataPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const dataArea = `${dataLine} L ${width} ${height} L 0 ${height} Z`;

  const pathLenEstimate = width * 1.4;

  return (
    <Panel title="Resource & Efficiency" eyebrow="POWER VS DATA USAGE">
      <div className="flex items-center gap-4 mb-3 text-[10px] font-mono">
        <span
          className="flex items-center gap-1.5"
          style={{ color: "#4ade80" }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "#4ade80" }}
          />{" "}
          POWER GEN (%)
        </span>
        <span
          className="flex items-center gap-1.5"
          style={{ color: "#a78bfa" }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "#a78bfa" }}
          />{" "}
          DATA USAGE (TB)
        </span>
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="aegis-data-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={width}
            y1={height * f}
            y2={height * f}
            stroke="#1a2138"
            strokeWidth="1"
          />
        ))}

        <path
          d={dataArea}
          fill="url(#aegis-data-area)"
          style={{
            opacity: drawn ? 1 : 0,
            transition: "opacity 900ms ease-out 300ms",
          }}
        />
        <path
          d={dataLine}
          fill="none"
          stroke="#a78bfa"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: "drop-shadow(0 0 3px rgba(167,139,250,0.6))",
            strokeDasharray: pathLenEstimate,
            strokeDashoffset: drawn ? 0 : pathLenEstimate,
            transition: "stroke-dashoffset 1100ms ease-out",
          }}
        />
        <path
          d={powerLine}
          fill="none"
          stroke="#4ade80"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: "drop-shadow(0 0 3px rgba(74,222,128,0.6))",
            strokeDasharray: pathLenEstimate,
            strokeDashoffset: drawn ? 0 : pathLenEstimate,
            transition: "stroke-dashoffset 1100ms ease-out 150ms",
          }}
        />
        {powerPoints.length > 0 && (
          <circle
            cx={powerPoints[powerPoints.length - 1].x}
            cy={powerPoints[powerPoints.length - 1].y}
            r="3.5"
            fill="#4ade80"
            style={{ filter: "drop-shadow(0 0 4px #4ade80)" }}
          />
        )}
        {dataPoints.length > 0 && (
          <circle
            cx={dataPoints[dataPoints.length - 1].x}
            cy={dataPoints[dataPoints.length - 1].y}
            r="3.5"
            fill="#a78bfa"
            style={{ filter: "drop-shadow(0 0 4px #a78bfa)" }}
          />
        )}
      </svg>
      <div
        className="flex items-center justify-between mt-2 text-[10px] font-mono"
        style={{ color: "#7b8499" }}
      >
        <span>MISSION HISTORY — {power.length} TICKS</span>
        <span>LIVE</span>
      </div>
    </Panel>
  );
}

// --- 8e. Events (24h) breakdown chart -----------------------------------------

function EventsBreakdownChartPanel({ alerts }: { alerts: Alert[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const critical = alerts.filter((a) => a.severity === "critical").length + 4;
  const warning = alerts.filter((a) => a.severity === "warning").length + 9;
  const info = alerts.filter((a) => a.severity === "info").length + 11;
  const total = critical + warning + info;

  const bars: { label: string; count: number; color: string }[] = [
    { label: "INFO", count: info, color: "#22d3ee" },
    { label: "WARNING", count: warning, color: "#fbbf24" },
    { label: "CRITICAL", count: critical, color: "#f87171" },
  ];
  const maxCount = Math.max(...bars.map((b) => b.count), 1);

  return (
    <Panel title="Events (24h)" eyebrow={`${total} TOTAL`}>
      <div
        className="flex items-end justify-around gap-4 md:gap-6"
        style={{ height: 140 }}
      >
        {bars.map((b) => (
          <div
            key={b.label}
            className="flex flex-col items-center gap-2 flex-1"
          >
            <span
              className="text-xs font-mono font-semibold tabular-nums"
              style={{ color: b.color }}
            >
              {b.count}
            </span>
            <div
              className="w-full flex items-end justify-center"
              style={{ height: 88 }}
            >
              <div
                className="w-8 md:w-10 rounded-t-sm transition-all duration-700 ease-out"
                style={{
                  height: mounted ? `${(b.count / maxCount) * 100}%` : "0%",
                  background: `linear-gradient(180deg, ${b.color}, ${b.color}66)`,
                  boxShadow: `0 0 10px ${b.color}66`,
                }}
              />
            </div>
            <span
              className="text-[10px] font-mono tracking-wide"
              style={{ color: "#7b8499" }}
            >
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// --- Timeline & Analytics screen root -----------------------------------------

export function TimelineAnalyticsScreen() {
  const { missions, spacecraft, alerts, selectedMissionId } = useSimulation();
  const focusedMission =
    missions.find((m) => m.id === selectedMissionId) ?? missions[0];

  return (
    <div className="flex flex-col gap-4">
      <MissionPhaseTimelinePanel mission={focusedMission} />
      <OperationalStatsRow spacecraft={spacecraft} />
      <MissionProgressComparisonPanel
        missions={missions}
        selectedMissionId={selectedMissionId}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <ResourceEfficiencyChartPanel spacecraft={spacecraft} />
        </div>
        <div className="lg:col-span-1">
          <EventsBreakdownChartPanel alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
