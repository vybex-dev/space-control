import React, { useRef, useState, useEffect } from "react";
import { useSimulation, useFlashOnChange } from "../context/SimulationContext";
import { Panel, NoSpacecraftDataPanel } from "./Panel";
import { Spacecraft, Subsystem } from "../types";

interface Star {
  x: number;
  y: number;
  r: number;
  delay: number;
  duration: number;
}

function useStarfield(count: number): Star[] {
  const [stars] = useState<Star[]>(() =>
    Array.from({ length: count }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      r: Math.random() * 1.1 + 0.3,
      delay: Math.random() * 4,
      duration: 2.5 + Math.random() * 3.5,
    })),
  );
  return stars;
}

function Starfield({ count = 90 }: { count?: number }) {
  const stars = useStarfield(count);
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <style>{`
        @keyframes aegis-twinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.9; }
        }
      `}</style>
      {stars.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="#e5e7eb"
          style={{
            animation: `aegis-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </svg>
  );
}

interface OrbitDef {
  craftId: string;
  rx: number;
  ry: number;
  tilt: number;
  phase: number;
  speed: number;
  color: string;
}

function buildOrbitDefs(spacecraft: Spacecraft[]): OrbitDef[] {
  const palette = [
    "#22d3ee",
    "#a78bfa",
    "#4ade80",
    "#fbbf24",
    "#f87171",
    "#38bdf8",
    "#f472b6",
  ];
  return spacecraft.map((sc, i) => ({
    craftId: sc.id,
    rx: 90 + i * 34,
    ry: 46 + i * 17,
    tilt: (i % 2 === 0 ? 1 : -1) * (6 + i * 4),
    phase: (i * 137) % 360,
    speed: 9 - i * 0.7,
    color: palette[i % palette.length],
  }));
}

function pointOnOrbit(orbit: OrbitDef, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const localX = orbit.rx * Math.cos(rad);
  const localY = orbit.ry * Math.sin(rad);
  const tiltRad = (orbit.tilt * Math.PI) / 180;
  const x = localX * Math.cos(tiltRad) - localY * Math.sin(tiltRad);
  const y = localX * Math.sin(tiltRad) + localY * Math.cos(tiltRad);
  return { x, y };
}

function orbitPathD(orbit: OrbitDef) {
  const steps = 64;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const angle = (360 / steps) * i;
    const { x, y } = pointOnOrbit(orbit, angle);
    d += `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d + "Z";
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function OrbitalVisualization({
  spacecraft,
  selectedId,
  onSelect,
}: {
  spacecraft: Spacecraft[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const orbits = useRef(buildOrbitDefs(spacecraft)).current;
  const [zoom, setZoom] = useState(1);
  const [angles, setAngles] = useState<number[]>(() =>
    orbits.map((o) => o.phase),
  );
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    function frame(ts: number) {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dtSec = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setAngles((prev) =>
        prev.map((a, i) => (a + orbits[i].speed * dtSec) % 360),
      );
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [orbits]);

  const viewSize = 440;
  const center = viewSize / 2;

  return (
    <div
      className="relative rounded-sm border overflow-hidden w-full"
      style={{
        background: "#070a12",
        borderColor: "#1a2138",
        aspectRatio: "1 / 1",
        minHeight: 280,
        maxHeight: 560,
      }}
    >
      <Starfield count={100} />

      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
        <button
          onClick={() =>
            setZoom((z) => Math.min(2.2, Number((z + 0.2).toFixed(2))))
          }
          className="w-7 h-7 flex items-center justify-center rounded-sm border text-sm font-mono transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 cursor-pointer"
          style={{
            borderColor: "#1a2138",
            background: "#0d1220",
            color: "#8b93a7",
            outlineColor: "#22d3ee",
          }}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() =>
            setZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))))
          }
          className="w-7 h-7 flex items-center justify-center rounded-sm border text-sm font-mono transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 cursor-pointer"
          style={{
            borderColor: "#1a2138",
            background: "#0d1220",
            color: "#8b93a7",
            outlineColor: "#22d3ee",
          }}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      <div
        className="absolute top-3 left-3 z-20 text-[10px] font-mono tracking-wider"
        style={{ color: "#7b8499" }}
      >
        ORBITAL VIEW
      </div>

      <svg
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        className="w-full h-full"
        style={{ minHeight: 320, maxHeight: 560 }}
      >
        <defs>
          <radialGradient id="aegis-earth-glow" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="90%" stopColor="#22d3ee" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="aegis-earth-body" cx="38%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="45%" stopColor="#1e3a8a" />
            <stop offset="80%" stopColor="#0c1a3d" />
            <stop offset="100%" stopColor="#05070d" />
          </radialGradient>
          <clipPath id="aegis-earth-clip">
            <circle cx={center} cy={center} r={38} />
          </clipPath>
        </defs>

        <g
          transform={`translate(${center} ${center}) scale(${zoom}) translate(${-center} ${-center})`}
        >
          {orbits.map((orbit) => {
            const isSelected = orbit.craftId === selectedId;
            return (
              <path
                key={orbit.craftId}
                d={orbitPathD(orbit)}
                transform={`translate(${center} ${center})`}
                fill="none"
                stroke={orbit.color}
                strokeWidth={isSelected ? 1.6 : 0.9}
                opacity={isSelected ? 0.85 : 0.28}
                style={{
                  filter: isSelected
                    ? `drop-shadow(0 0 4px ${orbit.color})`
                    : "none",
                  transition: "opacity 300ms ease, stroke-width 300ms ease",
                }}
              />
            );
          })}

          <circle
            cx={center}
            cy={center}
            r={54}
            fill="url(#aegis-earth-glow)"
          />

          <circle
            cx={center}
            cy={center}
            r={38}
            fill="url(#aegis-earth-body)"
            stroke="#38bdf8"
            strokeOpacity="0.35"
            strokeWidth="1"
          />

          <g clipPath="url(#aegis-earth-clip)">
            <g
              style={{
                transformOrigin: `${center}px ${center}px`,
                animation: "aegis-globe-spin 60s linear infinite",
              }}
            >
              <ellipse
                cx={center - 12}
                cy={center - 8}
                rx={16}
                ry={7}
                fill="#7dd3fc"
                opacity="0.14"
              />
              <ellipse
                cx={center + 14}
                cy={center + 4}
                rx={20}
                ry={6}
                fill="#7dd3fc"
                opacity="0.1"
              />
              <ellipse
                cx={center - 6}
                cy={center + 16}
                rx={12}
                ry={5}
                fill="#7dd3fc"
                opacity="0.12"
              />
              <ellipse
                cx={center + 22}
                cy={center - 14}
                rx={10}
                ry={4}
                fill="#a5f3fc"
                opacity="0.1"
              />
            </g>
          </g>
          <style>{`
            @keyframes aegis-globe-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>

          {orbits.map((orbit, i) => {
            const sc = spacecraft[i];
            const { x, y } = pointOnOrbit(orbit, angles[i]);
            const isSelected = orbit.craftId === selectedId;
            return (
              <g
                key={orbit.craftId}
                transform={`translate(${center + x} ${center + y})`}
                onClick={() => onSelect(orbit.craftId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(orbit.craftId);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Select ${sc.name}${isSelected ? ", currently selected" : ""}`}
                className="cursor-pointer focus-visible:outline-none"
              >
                {isSelected && (
                  <circle
                    r={9}
                    fill="none"
                    stroke={orbit.color}
                    strokeWidth="1"
                    opacity="0.6"
                  >
                    <animate
                      attributeName="r"
                      values="6;11;6"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.6;0;0.6"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                <circle
                  r={isSelected ? 4.5 : 3}
                  fill={orbit.color}
                  stroke="#05070d"
                  strokeWidth="1"
                  style={{ filter: `drop-shadow(0 0 3px ${orbit.color})` }}
                />
                {isSelected && (
                  <g transform="translate(8 -8)">
                    <rect
                      x={0}
                      y={-11}
                      width={sc.name.length * 6.4 + 14}
                      height={16}
                      rx={2}
                      fill="#0d1220"
                      stroke={orbit.color}
                      strokeOpacity="0.5"
                      strokeWidth="0.75"
                    />
                    <text
                      x={7}
                      y={0}
                      fontSize="9"
                      fontFamily="'JetBrains Mono', monospace"
                      fill={orbit.color}
                    >
                      {sc.name}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div
        className="absolute bottom-3 left-3 z-20 text-[10px] font-mono"
        style={{ color: "#7b8499" }}
      >
        {spacecraft.length} TRACKED · ZOOM {zoom.toFixed(1)}×
      </div>
    </div>
  );
}

function AnimatedSparkline({ data, color }: { data: number[]; color: string }) {
  const width = 140;
  const height = 40;
  if (data.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        aria-label="No trend data yet"
        style={{ maxWidth: `${width}px`, height: `${height}px` }}
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#1a2138"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
      </svg>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const coords = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return { x, y };
  });
  const line = coords
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full overflow-visible"
      style={{ maxWidth: `${width}px`, height: `${height}px` }}
    >
      <path d={area} fill={color} opacity="0.12" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <animate attributeName="opacity" values="0.5;1;1" dur="600ms" />
      </path>
      <circle
        cx={coords[coords.length - 1].x}
        cy={coords[coords.length - 1].y}
        r="2.2"
        fill={color}
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
    </svg>
  );
}

function TelemetryMetricCard({
  label,
  value,
  unit,
  color,
  history,
}: {
  label: string;
  value: string;
  unit?: string;
  color: string;
  history?: number[];
}) {
  const flash = useFlashOnChange(Number(value.replace(/[^0-9.-]/g, "")) || 0);
  return (
    <div
      className="rounded-sm border p-3.5 flex flex-col gap-2 transition-colors duration-300 min-w-0 text-left"
      style={{
        background: flash ? "rgba(34,211,238,0.05)" : "#0d1220",
        borderColor: flash ? "rgba(34,211,238,0.4)" : "#1a2138",
      }}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] font-mono tracking-wide mb-1 truncate"
            style={{ color: "#7b8499" }}
          >
            {label.toUpperCase()}
          </div>
          <div
            className="text-lg font-mono font-semibold tabular-nums truncate"
            style={{ color }}
          >
            {value}
            {unit && (
              <span className="text-xs ml-1" style={{ color: "#7b8499" }}>
                {unit}
              </span>
            )}
          </div>
        </div>
        {history && (
          <div className="flex-1 min-w-[50px] max-w-[140px] flex justify-end">
            <AnimatedSparkline data={history} color={color} />
          </div>
        )}
      </div>
    </div>
  );
}

function SubsystemBar({ subsystem }: { subsystem: Subsystem }) {
  const color =
    subsystem.status === "nominal"
      ? "#4ade80"
      : subsystem.status === "warning"
        ? "#fbbf24"
        : "#f87171";
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-[11px] font-mono w-20 shrink-0 text-left"
        style={{ color: "#8b93a7" }}
      >
        {subsystem.label.toUpperCase()}
      </span>
      <div
        className="flex-1 h-2 rounded-sm overflow-hidden"
        style={{ background: "#1a2138" }}
      >
        <div
          className="h-full rounded-sm transition-all duration-700 ease-out"
          style={{
            width: `${subsystem.health}%`,
            background: color,
            boxShadow: `0 0 6px ${color}88`,
          }}
        />
      </div>
      <span
        className="text-[11px] font-mono w-9 text-right tabular-nums shrink-0"
        style={{ color }}
      >
        {subsystem.health}%
      </span>
    </div>
  );
}

function TelemetryDataPanel({ craft }: { craft: Spacecraft }) {
  const healthColor =
    craft.systemHealth >= 90
      ? "#4ade80"
      : craft.systemHealth >= 70
        ? "#fbbf24"
        : "#f87171";

  return (
    <div className="flex flex-col gap-4">
      <Panel title={craft.name} eyebrow="SELECTED CRAFT" glow>
        <div className="grid grid-cols-2 gap-3">
          <TelemetryMetricCard
            label="Altitude"
            value={craft.altitude.toFixed(1)}
            unit="km"
            color="#22d3ee"
            history={craft.history.altitude}
          />
          <TelemetryMetricCard
            label="Velocity"
            value={craft.velocity.toFixed(2)}
            unit="km/s"
            color="#22d3ee"
            history={craft.history.velocity}
          />
          <TelemetryMetricCard
            label="Power"
            value={craft.powerLevel.toFixed(1)}
            unit="%"
            color="#4ade80"
            history={craft.history.power}
          />
          <TelemetryMetricCard
            label="Fuel"
            value={craft.fuelLevel.toFixed(1)}
            unit="%"
            color="#a78bfa"
          />
          <TelemetryMetricCard
            label="Signal"
            value={String(craft.signalStrength)}
            unit="dBm"
            color="#38bdf8"
          />
          <TelemetryMetricCard
            label="Temp"
            value={craft.onboardTemp.toFixed(1)}
            unit="°C"
            color="#fbbf24"
          />
        </div>
        <div className="mt-3 pt-3 border-t" style={{ borderColor: "#1a2138" }}>
          <div
            className="flex items-center justify-between text-[11px] font-mono"
            style={{ color: "#7b8499" }}
          >
            <span>POSITION</span>
            <span style={{ color: "#e5e7eb" }}>
              {craft.latitude.toFixed(1)}° N, {craft.longitude.toFixed(1)}° E
            </span>
          </div>
        </div>
      </Panel>

      <Panel title="System Health" eyebrow={`${craft.systemHealth}% AGGREGATE`}>
        <div className="flex items-center gap-3 mb-4">
          <span
            className="text-2xl font-mono font-bold tabular-nums"
            style={{ color: healthColor }}
          >
            {craft.systemHealth}%
          </span>
          <div
            className="flex-1 h-1.5 rounded-full"
            style={{ background: "#1a2138" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${craft.systemHealth}%`,
                background: healthColor,
                boxShadow: `0 0 8px ${healthColor}88`,
              }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {craft.subsystems.map((s) => (
            <SubsystemBar key={s.key} subsystem={s} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function TelemetryScreen() {
  const { spacecraft, missions } = useSimulation();

  // Local selection — starts with the first spacecraft
  const [selectedCraftId, setSelectedCraftId] = useState<string>(
    spacecraft[0]?.id ?? ""
  );

  // Keep selectedCraftId valid if spacecraft list changes
  useEffect(() => {
    if (!spacecraft.find((s) => s.id === selectedCraftId) && spacecraft.length > 0) {
      setSelectedCraftId(spacecraft[0].id);
    }
  }, [spacecraft, selectedCraftId]);

  const focused = spacecraft.find((s) => s.id === selectedCraftId) ?? spacecraft[0];
  const selectedMission = missions.find((m) => m.id === focused?.missionId) ?? missions[0];

  function handleSelectCraft(craftId: string) {
    setSelectedCraftId(craftId);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
      <div className="lg:col-span-3">
        <OrbitalVisualization
          spacecraft={spacecraft}
          selectedId={focused?.id ?? ""}
          onSelect={handleSelectCraft}
        />
      </div>
      <div className="lg:col-span-2">
        {/* Satellite Selector Dropdown */}
        <div
          className="rounded-sm border mb-3 px-3 py-2 flex items-center gap-3"
          style={{ background: "#0d1220", borderColor: "#1a2138" }}
        >
          <span
            className="text-[10px] font-mono tracking-widest shrink-0"
            style={{ color: "#7b8499" }}
          >
            TRACK
          </span>
          <div className="relative flex-1">
            <select
              id="satellite-select"
              value={selectedCraftId}
              onChange={(e) => handleSelectCraft(e.target.value)}
              className="w-full font-mono text-xs appearance-none cursor-pointer focus:outline-none pr-6"
              style={{
                background: "transparent",
                color: "#22d3ee",
                border: "none",
              }}
              aria-label="Select satellite to track"
            >
              {spacecraft.map((sc) => (
                <option
                  key={sc.id}
                  value={sc.id}
                  style={{ background: "#0d1220", color: "#e5e7eb" }}
                >
                  {sc.name}
                </option>
              ))}
            </select>
            {/* Custom chevron */}
            <svg
              className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M2 4l4 4 4-4"
                stroke="#22d3ee"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          {/* Live indicator dot */}
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: "#4ade80",
              boxShadow: "0 0 6px #4ade80",
              animation: "aegis-pulse 2s ease-in-out infinite",
            }}
          />
        </div>

        {focused ? (
          <TelemetryDataPanel craft={focused} />
        ) : (
          <NoSpacecraftDataPanel mission={selectedMission} />
        )}
      </div>
    </div>
  );
}
