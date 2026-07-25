import React, { useState, ReactNode } from "react";
import {
  useSimulation,
  useLiveClock,
  formatUTC,
} from "../context/SimulationContext";
import {
  IconGrid,
  IconSignal,
  IconPulse,
  IconClock,
  IconGear,
  IconAegis,
  IconMenu,
  IconX,
} from "./Icons";
import { OverviewPlaceholder } from "./OverviewDashboard";
import { TelemetryScreen } from "./TelemetryScreen";
import { CommsHealthScreen } from "./CommsHealthScreen";
import { TimelineAnalyticsScreen } from "./TimelineAnalyticsScreen";
import { SettingsScreen } from "./SettingsScreen";

type NavKey = "overview" | "telemetry" | "comms" | "timeline" | "settings";

const NAV_ITEMS: { key: NavKey; label: string; icon: ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <IconGrid /> },
  { key: "telemetry", label: "Telemetry", icon: <IconSignal /> },
  { key: "comms", label: "Comms & Health", icon: <IconPulse /> },
  { key: "timeline", label: "Timeline", icon: <IconClock /> },
  { key: "settings", label: "Settings", icon: <IconGear /> },
];

// --- Sidebar ------------------------------------------------------------------

function Sidebar({
  active,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}: {
  active: NavKey;
  onNavigate: (k: NavKey) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  return (
    <>
      {/* Desktop / tablet sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:w-16 lg:w-56 shrink-0 border-r"
        style={{ background: "#0a0e18", borderColor: "#1a2138" }}
      >
        <div
          className="flex items-center gap-2 px-4 h-16 border-b"
          style={{ borderColor: "#1a2138" }}
        >
          <span style={{ color: "#22d3ee" }}>
            <IconAegis />
          </span>
          <span
            className="hidden lg:inline font-bold tracking-widest text-lg"
            style={{
              color: "#e5e7eb",
              fontFamily: "'Space Grotesk', 'Inter', sans-serif",
            }}
          >
            AEGIS
          </span>
        </div>
        <nav
          className="flex-1 py-4 px-2 space-y-1"
          aria-label="Primary navigation"
        >
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              aria-label={item.label}
              aria-current={active === item.key ? "page" : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 cursor-pointer"
              style={{
                background:
                  active === item.key ? "rgba(34,211,238,0.10)" : "transparent",
                color: active === item.key ? "#22d3ee" : "#cbd5e1",
                boxShadow:
                  active === item.key ? "inset 2px 0 0 0 #22d3ee" : "none",
                outlineColor: "#22d3ee",
              }}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="hidden lg:inline font-mono tracking-wide">
                {item.label.toUpperCase()}
              </span>
            </button>
          ))}
        </nav>
        <div
          className="px-4 py-3 border-t text-[10px] font-mono text-left"
          style={{ borderColor: "#1a2138", color: "#94a3b8" }}
        >
          AEGIS MISSION CONTROL
          <br />
          BUILD 2026.07.25
        </div>
      </aside>

      {/* Mobile bottom nav bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around border-t"
        style={{
          background: "#0a0e18",
          borderColor: "#1a2138",
          height: "58px",
        }}
        aria-label="Primary navigation"
      >
        {NAV_ITEMS.slice(0, 4).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
            aria-label={item.label}
            aria-current={active === item.key ? "page" : undefined}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset cursor-pointer"
            style={{
              color: active === item.key ? "#22d3ee" : "#cbd5e1",
              outlineColor: "#22d3ee",
            }}
          >
            {item.icon}
            <span className="text-[9px] font-mono">
              {item.label.split(" ")[0].toUpperCase()}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onNavigate("settings")}
          aria-label="Settings"
          aria-current={active === "settings" ? "page" : undefined}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset cursor-pointer"
          style={{
            color: active === "settings" ? "#22d3ee" : "#cbd5e1",
            outlineColor: "#22d3ee",
          }}
        >
          <IconGear />
          <span className="text-[9px] font-mono">SET</span>
        </button>
      </nav>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={onCloseMobile}
          />
          <div
            className="relative w-64 h-full flex flex-col border-r"
            style={{ background: "#0a0e18", borderColor: "#1a2138" }}
          >
            <div
              className="flex items-center justify-between px-4 h-16 border-b"
              style={{ borderColor: "#1a2138" }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: "#22d3ee" }}>
                  <IconAegis />
                </span>
                <span
                  className="font-bold tracking-widest text-lg"
                  style={{ color: "#e5e7eb" }}
                >
                  AEGIS
                </span>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation menu"
                className="focus-visible:outline-none focus-visible:ring-2 rounded-sm cursor-pointer"
                style={{ color: "#cbd5e1", outlineColor: "#22d3ee" }}
              >
                <IconX />
              </button>
            </div>
            <nav
              className="flex-1 py-4 px-2 space-y-1"
              aria-label="Primary navigation"
            >
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onNavigate(item.key);
                    onCloseMobile();
                  }}
                  aria-label={item.label}
                  aria-current={active === item.key ? "page" : undefined}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm focus-visible:outline-none focus-visible:ring-2 cursor-pointer"
                  style={{
                    background:
                      active === item.key
                        ? "rgba(34,211,238,0.10)"
                        : "transparent",
                    color: active === item.key ? "#22d3ee" : "#cbd5e1",
                    outlineColor: "#22d3ee",
                  }}
                >
                  {item.icon}
                  <span className="font-mono tracking-wide">
                    {item.label.toUpperCase()}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

// --- Top bar ------------------------------------------------------------------

function TopBar({
  onOpenMobileMenu,
  activeLabel,
}: {
  onOpenMobileMenu: () => void;
  activeLabel: string;
}) {
  const clock = useLiveClock();
  const { missions, alerts } = useSimulation();

  const activeCount = missions.filter((m) => m.status === "active").length;
  const unresolvedAlertCount = alerts.filter((a) => !a.resolved).length;

  return (
    <header
      className="h-16 shrink-0 flex items-center justify-between px-4 md:px-6 border-b"
      style={{ background: "#080b13", borderColor: "#1a2138" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="md:hidden focus-visible:outline-none focus-visible:ring-2 rounded-sm cursor-pointer"
          style={{ color: "#cbd5e1", outlineColor: "#22d3ee" }}
        >
          <IconMenu />
        </button>
        <div className="min-w-0 text-left">
          <div
            className="text-[10px] font-mono tracking-[0.2em]"
            style={{ color: "#94a3b8" }}
          >
            MISSION CONTROL /
          </div>
          <h1
            className="text-sm md:text-base font-semibold truncate"
            style={{
              color: "#e5e7eb",
              fontFamily: "'Space Grotesk', 'Inter', sans-serif",
            }}
          >
            {activeLabel}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-5">
        {/* Connection status */}
        <div
          className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-sm border"
          style={{ borderColor: "#1a2138", background: "#0d1220" }}
        >
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
              style={{ background: "#4ade80" }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: "#4ade80" }}
            />
          </span>
          <span
            className="text-xs font-mono tracking-wider"
            style={{ color: "#4ade80" }}
          >
            LINK OK
          </span>
        </div>

        {/* Active missions */}
        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span className="text-[10px] font-mono" style={{ color: "#94a3b8" }}>
            ACTIVE
          </span>
          <span
            className="text-sm font-mono font-semibold"
            style={{ color: "#22d3ee" }}
          >
            {activeCount}
          </span>
        </div>

        {/* Alert badge */}
        <div className="relative flex flex-col items-end leading-tight">
          <span className="text-[10px] font-mono" style={{ color: "#94a3b8" }}>
            ALERTS
          </span>
          <span
            className="text-sm font-mono font-semibold"
            style={{ color: unresolvedAlertCount > 0 ? "#fbbf24" : "#4ade80" }}
          >
            {unresolvedAlertCount}
          </span>
        </div>

        {/* UTC clock */}
        <div
          className="flex flex-col items-end leading-tight border-l pl-3 md:pl-5"
          style={{ borderColor: "#1a2138" }}
        >
          <span className="text-[10px] font-mono" style={{ color: "#94a3b8" }}>
            UTC
          </span>
          <span
            className="text-sm md:text-base font-mono font-semibold tabular-nums"
            style={{ color: "#e5e7eb" }}
          >
            {formatUTC(clock)}
          </span>
        </div>
      </div>
    </header>
  );
}

// --- Route transition wrapper -------------------------------------------------

function RouteTransition({
  routeKey,
  children,
}: {
  routeKey: string;
  children: ReactNode;
}) {
  return (
    <div
      key={routeKey}
      style={{
        animation: "aegis-route-in 320ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <style>{`
        @keyframes aegis-route-in {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="aegis-route-in"] { animation: none !important; }
        }
      `}</style>
      {children}
    </div>
  );
}

// --- Footer status strip ------------------------------------------------------

function StatusStrip() {
  const { alerts } = useSimulation();
  const criticalCount = alerts.filter(
    (a) => !a.resolved && a.severity === "critical",
  ).length;
  const nominal = criticalCount === 0;
  const color = nominal ? "#4ade80" : "#f87171";

  return (
    <footer
      className="hidden md:flex items-center justify-between px-4 md:px-6 h-8 shrink-0 border-t text-[10px] font-mono tracking-wider"
      style={{
        background: "#080b13",
        borderColor: "#1a2138",
        color: "#94a3b8",
      }}
    >
      <span>AEGIS-CTRL · CALLSIGN "SENTINEL-1"</span>
      <span className="flex items-center gap-1.5" style={{ color }}>
        <span className="relative flex h-1.5 w-1.5">
          {!nominal && (
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70"
              style={{ background: color }}
            />
          )}
          <span
            className="relative inline-flex rounded-full h-1.5 w-1.5"
            style={{ background: color }}
          />
        </span>
        {nominal
          ? "SYSTEM NOMINAL"
          : `${criticalCount} CRITICAL ALERT${criticalCount > 1 ? "S" : ""}`}
      </span>
      <span>BUILD 2026.07.25 · v1.0.0</span>
    </footer>
  );
}

// --- Root shell ---------------------------------------------------------------

export function AppShell() {
  const [active, setActive] = useState<NavKey>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeLabel = NAV_ITEMS.find((n) => n.key === active)?.label ?? "";

  return (
    <div
      className="w-full h-screen flex overflow-hidden relative"
      style={{
        background: "#05070d",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* subtle grid/scanline texture */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, transparent 1px, transparent 2px)",
        }}
      />

      <Sidebar
        active={active}
        onNavigate={setActive}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <TopBar
          onOpenMobileMenu={() => setMobileOpen(true)}
          activeLabel={activeLabel}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <RouteTransition routeKey={active}>
            {active === "overview" && <OverviewPlaceholder />}
            {active === "telemetry" && <TelemetryScreen />}
            {active === "comms" && <CommsHealthScreen />}
            {active === "timeline" && <TimelineAnalyticsScreen />}
            {active === "settings" && <SettingsScreen />}
          </RouteTransition>
        </main>
        <StatusStrip />
      </div>
    </div>
  );
}
