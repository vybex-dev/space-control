import React, { createContext, useContext, useReducer, useEffect, useRef, useState, ReactNode } from 'react';

// ============================================================================
// SECTION 1: TYPES
// ----------------------------------------------------------------------------
// All domain models for AEGIS live here. Keeping these centralized means
// every other file (mock data, simulation reducer, UI components) shares
// one source of truth for shape.
// ============================================================================

export type MissionStatus = 'active' | 'completed' | 'planned' | 'warning';

export interface Mission {
  id: string;
  name: string;
  status: MissionStatus;
  progress: number;        // 0-100
  phase: string;           // human-readable current phase label
  crew: number;            // crew count (0 for uncrewed/payload-only)
  payload: string;         // short payload description
  launchDate: string;      // ISO date string
}

export type SubsystemKey = 'power' | 'thermal' | 'comms' | 'propulsion' | 'navigation';

export interface Subsystem {
  key: SubsystemKey;
  label: string;
  health: number;           // 0-100
  status: 'nominal' | 'warning' | 'critical';
}

export interface Spacecraft {
  id: string;
  missionId: string;
  name: string;
  altitude: number;         // km
  velocity: number;         // km/s
  latitude: number;         // degrees
  longitude: number;        // degrees
  signalStrength: number;   // dBm (negative, closer to 0 = stronger)
  powerLevel: number;       // %
  fuelLevel: number;        // %
  onboardTemp: number;      // °C
  systemHealth: number;     // % aggregate
  subsystems: Subsystem[];
  // Rolling history for sparklines - last N ticks
  history: {
    altitude: number[];
    velocity: number[];
    power: number[];
  };
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  missionId: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string; // ISO datetime
  resolved: boolean;
  subsystem?: SubsystemKey; // optional tag - which subsystem raised this, if any
  acknowledged?: boolean;   // client-side operator ack, set via ACKNOWLEDGE_ALERT
}

export type PhaseStatus = 'completed' | 'current' | 'upcoming';

export interface TimelinePhase {
  label: string;
  timeOffset: string; // e.g. "T-0", "T+05:40"
  status: PhaseStatus;
}

// The full simulation state that the reducer manages
export interface SimulationState {
  missions: Mission[];
  spacecraft: Spacecraft[];
  alerts: Alert[];
  timelines: Record<string, TimelinePhase[]>; // keyed by missionId
  utcNow: Date;
  tick: number;
  selectedMissionId: string | null; // drives Telemetry / Comms focus in later phases
  // ids of alerts that just appeared this tick, so the feed can animate them in
  // and then age them out of "new" status after the entrance animation plays
  newlyAddedAlertIds: string[];
}

// ============================================================================
// SECTION 2: MOCK DATA / SEED STATE
// ----------------------------------------------------------------------------
// Realistic seed data for 7 missions, mirroring the target overview numbers:
// 7 active, 5 nominal, 1 critical alert, 1 completed-phase-shown-as-planned-mix,
// ~98% avg system health, ~72% overall progress.
// ============================================================================

const HISTORY_LENGTH = 20;

function seedHistory(base: number, spread: number): number[] {
  // Generate a plausible short history trending into `base`
  const arr: number[] = [];
  let v = base - spread / 2;
  for (let i = 0; i < HISTORY_LENGTH; i++) {
    v += (Math.random() - 0.45) * (spread / HISTORY_LENGTH) * 2;
    arr.push(Number(v.toFixed(2)));
  }
  arr[arr.length - 1] = base;
  return arr;
}

function makeSubsystems(overrides?: Partial<Record<SubsystemKey, number>>): Subsystem[] {
  const defs: { key: SubsystemKey; label: string }[] = [
    { key: 'power', label: 'Power' },
    { key: 'thermal', label: 'Thermal' },
    { key: 'comms', label: 'Comms' },
    { key: 'propulsion', label: 'Propulsion' },
    { key: 'navigation', label: 'Navigation' },
  ];
  return defs.map((d) => {
    const health = overrides?.[d.key] ?? 95 + Math.round(Math.random() * 5);
    const status: Subsystem['status'] =
      health >= 90 ? 'nominal' : health >= 70 ? 'warning' : 'critical';
    return { ...d, health, status };
  });
}

export const SEED_MISSIONS: Mission[] = [
  {
    id: 'm-01',
    name: 'ARTEMIS RELAY',
    status: 'active',
    progress: 78,
    phase: 'Orbit Insertion',
    crew: 0,
    payload: 'Lunar comms relay satellite',
    launchDate: '2026-02-11',
  },
  {
    id: 'm-02',
    name: 'HELIOS WATCH',
    status: 'active',
    progress: 64,
    phase: 'Payload Ops',
    crew: 0,
    payload: 'Solar weather monitoring array',
    launchDate: '2026-03-02',
  },
  {
    id: 'm-03',
    name: 'ORION CREWED-7',
    status: 'warning',
    progress: 55,
    phase: 'System Check',
    crew: 4,
    payload: 'Crew transport + ISS resupply',
    launchDate: '2026-04-18',
  },
  {
    id: 'm-04',
    name: 'TITAN SURVEYOR',
    status: 'active',
    progress: 91,
    phase: 'Data Downlink',
    crew: 0,
    payload: 'Deep-space imaging probe',
    launchDate: '2025-11-30',
  },
  {
    id: 'm-05',
    name: 'POLARIS-2',
    status: 'active',
    progress: 47,
    phase: 'Orbit Insertion',
    crew: 0,
    payload: 'Polar ice observation satellite',
    launchDate: '2026-05-09',
  },
  {
    id: 'm-06',
    name: 'VANGUARD CARGO',
    status: 'active',
    progress: 88,
    phase: 'Payload Ops',
    crew: 0,
    payload: 'Automated cargo resupply',
    launchDate: '2026-01-22',
  },
  {
    id: 'm-07',
    name: 'AEGIS-X TEST',
    status: 'active',
    progress: 33,
    phase: 'Launch',
    crew: 0,
    payload: 'Next-gen propulsion testbed',
    launchDate: '2026-06-30',
  },
  {
    id: 'm-08',
    name: 'MERIDIAN-1',
    status: 'completed',
    progress: 100,
    phase: 'Mission End',
    crew: 0,
    payload: 'Earth observation constellation node',
    launchDate: '2025-08-14',
  },
];

export const SEED_SPACECRAFT: Spacecraft[] = [
  {
    id: 'sc-01',
    missionId: 'm-01',
    name: 'SAT-01',
    altitude: 408.7,
    velocity: 7.67,
    latitude: 28.5,
    longitude: 80.6,
    signalStrength: -120,
    powerLevel: 98,
    fuelLevel: 64,
    onboardTemp: 22.6,
    systemHealth: 98,
    subsystems: makeSubsystems(),
    history: {
      altitude: seedHistory(408.7, 3),
      velocity: seedHistory(7.67, 0.1),
      power: seedHistory(98, 2),
    },
  },
  {
    id: 'sc-02',
    missionId: 'm-02',
    name: 'SAT-02',
    altitude: 550.2,
    velocity: 7.58,
    latitude: 14.1,
    longitude: -33.9,
    signalStrength: -108,
    powerLevel: 95,
    fuelLevel: 81,
    onboardTemp: 19.4,
    systemHealth: 97,
    subsystems: makeSubsystems(),
    history: {
      altitude: seedHistory(550.2, 3),
      velocity: seedHistory(7.58, 0.1),
      power: seedHistory(95, 2),
    },
  },
  {
    id: 'sc-03',
    missionId: 'm-03',
    name: 'ORION-7',
    altitude: 402.1,
    velocity: 7.66,
    latitude: 51.6,
    longitude: -0.1,
    signalStrength: -135,
    powerLevel: 71,
    fuelLevel: 58,
    onboardTemp: 26.9,
    systemHealth: 74,
    subsystems: makeSubsystems({ propulsion: 62, thermal: 78 }),
    history: {
      altitude: seedHistory(402.1, 4),
      velocity: seedHistory(7.66, 0.15),
      power: seedHistory(71, 5),
    },
  },
  {
    id: 'sc-04',
    missionId: 'm-04',
    name: 'SAT-03',
    altitude: 1284.4,
    velocity: 7.12,
    latitude: -9.3,
    longitude: 112.4,
    signalStrength: -142,
    powerLevel: 89,
    fuelLevel: 40,
    onboardTemp: -4.2,
    systemHealth: 96,
    subsystems: makeSubsystems(),
    history: {
      altitude: seedHistory(1284.4, 3),
      velocity: seedHistory(7.12, 0.1),
      power: seedHistory(89, 2),
    },
  },
  {
    id: 'sc-05',
    missionId: 'm-05',
    name: 'POLARIS-2A',
    altitude: 705.9,
    velocity: 7.49,
    latitude: 78.2,
    longitude: 15.6,
    signalStrength: -117,
    powerLevel: 99,
    fuelLevel: 92,
    onboardTemp: 15.1,
    systemHealth: 99,
    subsystems: makeSubsystems(),
    history: {
      altitude: seedHistory(705.9, 3),
      velocity: seedHistory(7.49, 0.1),
      power: seedHistory(99, 1),
    },
  },
  {
    id: 'sc-06',
    missionId: 'm-06',
    name: 'CARGO-V6',
    altitude: 415.3,
    velocity: 7.66,
    latitude: 45.0,
    longitude: 63.3,
    signalStrength: -111,
    powerLevel: 93,
    fuelLevel: 37,
    onboardTemp: 21.0,
    systemHealth: 95,
    subsystems: makeSubsystems(),
    history: {
      altitude: seedHistory(415.3, 3),
      velocity: seedHistory(7.66, 0.1),
      power: seedHistory(93, 2),
    },
  },
  {
    id: 'sc-07',
    missionId: 'm-07',
    name: 'AEGIS-X1',
    altitude: 220.6,
    velocity: 7.79,
    latitude: 5.2,
    longitude: -52.8,
    signalStrength: -98,
    powerLevel: 100,
    fuelLevel: 96,
    onboardTemp: 31.4,
    systemHealth: 99,
    subsystems: makeSubsystems(),
    history: {
      altitude: seedHistory(220.6, 5),
      velocity: seedHistory(7.79, 0.1),
      power: seedHistory(100, 1),
    },
  },
];

export const SEED_ALERTS: Alert[] = [
  {
    id: 'al-01',
    missionId: 'm-03',
    severity: 'critical',
    message: 'Propulsion subsystem health below threshold (62%)',
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    resolved: false,
    subsystem: 'propulsion',
    acknowledged: false,
  },
  {
    id: 'al-02',
    missionId: 'm-03',
    severity: 'warning',
    message: 'Thermal regulation drift detected on ORION-7',
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    resolved: false,
    subsystem: 'thermal',
    acknowledged: false,
  },
  {
    id: 'al-03',
    missionId: 'm-04',
    severity: 'info',
    message: 'Data downlink window opened for TITAN SURVEYOR',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    resolved: true,
    subsystem: 'comms',
    acknowledged: true,
  },
  {
    id: 'al-04',
    missionId: 'm-01',
    severity: 'info',
    message: 'Uplink handshake completed on ARTEMIS RELAY',
    timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    resolved: true,
    subsystem: 'comms',
    acknowledged: false,
  },
  {
    id: 'al-05',
    missionId: 'm-06',
    severity: 'warning',
    message: 'Fuel reserve trending below planned burn margin',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    resolved: false,
    subsystem: 'propulsion',
    acknowledged: false,
  },
];

export const SEED_TIMELINES: Record<string, TimelinePhase[]> = {
  'm-01': [
    { label: 'Launch', timeOffset: 'T-0', status: 'completed' },
    { label: 'Orbit Insertion', timeOffset: 'T+00:15', status: 'current' },
    { label: 'System Check', timeOffset: 'T+02:30', status: 'upcoming' },
    { label: 'Payload Ops', timeOffset: 'T+05:40', status: 'upcoming' },
    { label: 'Data Downlink', timeOffset: 'T+08:10', status: 'upcoming' },
    { label: 'Mission End', timeOffset: 'T+12:00', status: 'upcoming' },
  ],
};

// ============================================================================
// SECTION 3: SIMULATION ENGINE
// ----------------------------------------------------------------------------
// A React Context + useReducer store that owns all "live" state. A ticking
// interval dispatches a TICK action; the reducer applies small, bounded
// perturbations to each spacecraft's telemetry, pushes into rolling history,
// advances the clock, and occasionally raises/resolves an alert.
//
// This is intentionally NOT Redux/Zustand - just Context+useReducer, which
// is enough for a single global "mission state" store and keeps the whole
// thing dependency-free (important: client-side only, no backend/services).
// ============================================================================

type SimAction =
  | { type: 'TICK' }
  | { type: 'SELECT_MISSION'; missionId: string }
  | { type: 'ACKNOWLEDGE_ALERT'; alertId: string };

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function pushHistory(arr: number[], value: number): number[] {
  const next = [...arr, value];
  if (next.length > HISTORY_LENGTH) next.shift();
  return next;
}

function jitterSpacecraft(sc: Spacecraft): Spacecraft {
  // Small, bounded, realistic drift per tick - not random chaos.
  const altitude = Number(clamp(sc.altitude + (Math.random() - 0.5) * 1.0, 150, 2000).toFixed(2));
  const velocity = Number(clamp(sc.velocity + (Math.random() - 0.5) * 0.02, 6.5, 8.0).toFixed(3));
  const signalStrength = Math.round(clamp(sc.signalStrength + (Math.random() - 0.5) * 3, -160, -85));
  // Power drains very slowly unless it's a solar-charged nominal craft, in which case it
  // hovers with tiny noise (simulating charge/discharge cycles).
  const powerDrift = (Math.random() - 0.52) * 0.6;
  const powerLevel = Number(clamp(sc.powerLevel + powerDrift, 0, 100).toFixed(1));
  const fuelLevel = Number(clamp(sc.fuelLevel - Math.random() * 0.02, 0, 100).toFixed(2));
  const onboardTemp = Number(clamp(sc.onboardTemp + (Math.random() - 0.5) * 0.4, -60, 60).toFixed(1));

  // Subsystem health wobbles slightly; status recalculated from health.
  const subsystems = sc.subsystems.map((s) => {
    const health = Math.round(clamp(s.health + (Math.random() - 0.5) * 1.5, 0, 100));
    const status: Subsystem['status'] =
      health >= 90 ? 'nominal' : health >= 70 ? 'warning' : 'critical';
    return { ...s, health, status };
  });
  const systemHealth = Math.round(
    subsystems.reduce((sum, s) => sum + s.health, 0) / subsystems.length
  );

  return {
    ...sc,
    altitude,
    velocity,
    signalStrength,
    powerLevel,
    fuelLevel,
    onboardTemp,
    systemHealth,
    subsystems,
    history: {
      altitude: pushHistory(sc.history.altitude, altitude),
      velocity: pushHistory(sc.history.velocity, velocity),
      power: pushHistory(sc.history.power, powerLevel),
    },
  };
}

const ALERT_MESSAGES_WARNING: { text: string; subsystem: SubsystemKey }[] = [
  { text: 'Signal strength degraded below nominal range', subsystem: 'comms' },
  { text: 'Minor thermal fluctuation detected', subsystem: 'thermal' },
  { text: 'Telemetry packet loss above baseline', subsystem: 'comms' },
  { text: 'Attitude control micro-adjustment triggered', subsystem: 'navigation' },
  { text: 'Power bus voltage ripple detected', subsystem: 'power' },
];

function simulationReducer(state: SimulationState, action: SimAction): SimulationState {
  switch (action.type) {
    case 'TICK': {
      const spacecraft = state.spacecraft.map(jitterSpacecraft);

      let alerts = state.alerts;
      let newlyAddedAlertIds: string[] = [];

      // Low-probability: raise a new warning alert on a random active mission.
      if (Math.random() < 0.04) {
        const activeMissions = state.missions.filter((m) => m.status === 'active');
        if (activeMissions.length > 0) {
          const target = activeMissions[Math.floor(Math.random() * activeMissions.length)];
          const msg =
            ALERT_MESSAGES_WARNING[Math.floor(Math.random() * ALERT_MESSAGES_WARNING.length)];
          const newId = `al-${Date.now()}`;
          const newAlert: Alert = {
            id: newId,
            missionId: target.id,
            severity: 'warning',
            message: `${msg.text} on ${target.name}`,
            timestamp: new Date().toISOString(),
            resolved: false,
            subsystem: msg.subsystem,
            acknowledged: false,
          };
          alerts = [newAlert, ...alerts].slice(0, 20); // cap alert history
          newlyAddedAlertIds = [newId];
        }
      }

      // Low-probability: resolve an existing unresolved warning alert.
      if (Math.random() < 0.06) {
        const unresolvedIdx = alerts.findIndex(
          (a) => !a.resolved && a.severity !== 'critical'
        );
        if (unresolvedIdx !== -1) {
          alerts = alerts.map((a, i) => (i === unresolvedIdx ? { ...a, resolved: true } : a));
        }
      }

      return {
        ...state,
        spacecraft,
        alerts,
        newlyAddedAlertIds,
        utcNow: new Date(),
        tick: state.tick + 1,
      };
    }
    case 'SELECT_MISSION': {
      return {
        ...state,
        selectedMissionId: action.missionId,
      };
    }
    case 'ACKNOWLEDGE_ALERT': {
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          a.id === action.alertId ? { ...a, acknowledged: true } : a
        ),
      };
    }
    default:
      return state;
  }
}

interface SimulationContextValue {
  state: SimulationState;
  selectMission: (missionId: string) => void;
  acknowledgeAlert: (alertId: string) => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

const initialState: SimulationState = {
  missions: SEED_MISSIONS,
  spacecraft: SEED_SPACECRAFT,
  alerts: SEED_ALERTS,
  timelines: SEED_TIMELINES,
  utcNow: new Date(),
  tick: 0,
  selectedMissionId: SEED_MISSIONS[0]?.id ?? null,
  newlyAddedAlertIds: [],
};

function SimulationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(simulationReducer, initialState);

  useEffect(() => {
    // Telemetry perturbation tick - every 2.5s, per the brief's 2-3s cadence.
    const interval = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const selectMission = (missionId: string) => dispatch({ type: 'SELECT_MISSION', missionId });
  const acknowledgeAlert = (alertId: string) => dispatch({ type: 'ACKNOWLEDGE_ALERT', alertId });

  return (
    <SimulationContext.Provider value={{ state, selectMission, acknowledgeAlert }}>
      {children}
    </SimulationContext.Provider>
  );
}

// Hook for consuming simulation state anywhere in the tree.
function useSimulation(): SimulationState {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used within SimulationProvider');
  return ctx.state;
}

// Hook for consuming the mission-selection dispatcher.
function useMissionSelect(): (missionId: string) => void {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useMissionSelect must be used within SimulationProvider');
  return ctx.selectMission;
}

// Hook for consuming the alert-acknowledge dispatcher.
function useAlertAcknowledge(): (alertId: string) => void {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useAlertAcknowledge must be used within SimulationProvider');
  return ctx.acknowledgeAlert;
}

// A separate 1s ticking clock, decoupled from the telemetry simulation
// interval so the top bar clock feels perfectly live regardless of the
// 2.5s telemetry cadence.
function useLiveClock(): Date {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatUTC(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// Relative time formatter for the alerts feed ("2m ago", "just now"). Re-derived
// from the live clock rather than a static Date.now() so it keeps advancing.
function relativeTime(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

// Generic "flash on change" hook: tracks a numeric value and returns true for
// a brief window whenever it changes, so consumers can apply a highlight
// flash class/style. Used across KPI cards and telemetry readouts.
function useFlashOnChange(value: number, durationMs = 600): boolean {
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);
  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), durationMs);
      return () => clearTimeout(t);
    }
  }, [value, durationMs]);
  return flash;
}

// ============================================================================
// SECTION 4: APP SHELL / LAYOUT
// ----------------------------------------------------------------------------
// Sidebar (collapsible on mobile to a bottom bar), top bar with live clock +
// connection + counts, and a main content area with placeholder panels that
// prove the shell + simulation tick are wired together.
// ============================================================================

type NavKey = 'overview' | 'telemetry' | 'comms' | 'timeline' | 'settings';

const NAV_ITEMS: { key: NavKey; label: string; icon: ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <IconGrid /> },
  { key: 'telemetry', label: 'Telemetry', icon: <IconSignal /> },
  { key: 'comms', label: 'Comms & Health', icon: <IconPulse /> },
  { key: 'timeline', label: 'Timeline', icon: <IconClock /> },
  { key: 'settings', label: 'Settings', icon: <IconGear /> },
];

// --- Minimal inline icon set (no external icon library - keep fully self-contained) ---
function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="20" height="20">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconSignal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="20" height="20">
      <path d="M4 18h2v-4H4v4Zm7 0h2V9h-2v9Zm7 0h2V4h-2v14Z" />
    </svg>
  );
}
function IconPulse() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="20" height="20">
      <path d="M3 12h4l2 7 4-14 2 7h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="20" height="20">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="20" height="20">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconAegis() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="22" height="22">
      <path d="M12 2 3 6v6c0 5 3.8 8.7 9 10 5.2-1.3 9-5 9-10V6l-9-4Z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="22" height="22">
      <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
    </svg>
  );
}
function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" width="20" height="20">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

// --- Sidebar --------------------------------------------------------------

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
        style={{ background: '#0a0e18', borderColor: '#1a2138' }}
      >
        <div className="flex items-center gap-2 px-4 h-16 border-b" style={{ borderColor: '#1a2138' }}>
          <span style={{ color: '#22d3ee' }}><IconAegis /></span>
          <span
            className="hidden lg:inline font-bold tracking-widest text-lg"
            style={{ color: '#e5e7eb', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
          >
            AEGIS
          </span>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              aria-label={item.label}
              aria-current={active === item.key ? 'page' : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm transition-colors text-sm focus-visible:outline-none focus-visible:ring-2"
              style={{
                background: active === item.key ? 'rgba(34,211,238,0.10)' : 'transparent',
                color: active === item.key ? '#22d3ee' : '#8b93a7',
                boxShadow: active === item.key ? 'inset 2px 0 0 0 #22d3ee' : 'none',
                outlineColor: '#22d3ee',
              }}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="hidden lg:inline font-mono tracking-wide">{item.label.toUpperCase()}</span>
            </button>
          ))}
        </nav>
        <div className="px-4 py-3 border-t text-[10px] font-mono" style={{ borderColor: '#1a2138', color: '#7b8499' }}>
          AEGIS MISSION CONTROL
          <br />
          BUILD 2026.07.25
        </div>
      </aside>

      {/* Mobile bottom nav bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around border-t"
        style={{ background: '#0a0e18', borderColor: '#1a2138', height: '58px' }}
        aria-label="Primary navigation"
      >
        {NAV_ITEMS.slice(0, 4).map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            aria-label={item.label}
            aria-current={active === item.key ? 'page' : undefined}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
            style={{ color: active === item.key ? '#22d3ee' : '#8b93a7', outlineColor: '#22d3ee' }}
          >
            {item.icon}
            <span className="text-[9px] font-mono">{item.label.split(' ')[0].toUpperCase()}</span>
          </button>
        ))}
        <button
          onClick={() => onNavigate('settings')}
          aria-label="Settings"
          aria-current={active === 'settings' ? 'page' : undefined}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
          style={{ color: active === 'settings' ? '#22d3ee' : '#8b93a7', outlineColor: '#22d3ee' }}
        >
          <IconGear />
          <span className="text-[9px] font-mono">SET</span>
        </button>
      </nav>

      {/* Mobile drawer (optional deep nav / hamburger overlay) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={onCloseMobile}
          />
          <div
            className="relative w-64 h-full flex flex-col border-r"
            style={{ background: '#0a0e18', borderColor: '#1a2138' }}
          >
            <div className="flex items-center justify-between px-4 h-16 border-b" style={{ borderColor: '#1a2138' }}>
              <div className="flex items-center gap-2">
                <span style={{ color: '#22d3ee' }}><IconAegis /></span>
                <span className="font-bold tracking-widest text-lg" style={{ color: '#e5e7eb' }}>AEGIS</span>
              </div>
              <button
                onClick={onCloseMobile}
                aria-label="Close navigation menu"
                className="focus-visible:outline-none focus-visible:ring-2 rounded-sm"
                style={{ color: '#8b93a7', outlineColor: '#22d3ee' }}
              >
                <IconX />
              </button>
            </div>
            <nav className="flex-1 py-4 px-2 space-y-1" aria-label="Primary navigation">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    onNavigate(item.key);
                    onCloseMobile();
                  }}
                  aria-label={item.label}
                  aria-current={active === item.key ? 'page' : undefined}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    background: active === item.key ? 'rgba(34,211,238,0.10)' : 'transparent',
                    color: active === item.key ? '#22d3ee' : '#8b93a7',
                    outlineColor: '#22d3ee',
                  }}
                >
                  {item.icon}
                  <span className="font-mono tracking-wide">{item.label.toUpperCase()}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

// --- Top bar ----------------------------------------------------------------

function TopBar({
  onOpenMobileMenu,
  activeLabel,
}: {
  onOpenMobileMenu: () => void;
  activeLabel: string;
}) {
  const clock = useLiveClock();
  const { missions, alerts } = useSimulation();

  const activeCount = missions.filter((m) => m.status === 'active').length;
  const unresolvedAlertCount = alerts.filter((a) => !a.resolved).length;

  return (
    <header
      className="h-16 shrink-0 flex items-center justify-between px-4 md:px-6 border-b"
      style={{ background: '#080b13', borderColor: '#1a2138' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="md:hidden focus-visible:outline-none focus-visible:ring-2 rounded-sm"
          style={{ color: '#8b93a7', outlineColor: '#22d3ee' }}
        >
          <IconMenu />
        </button>
        <div className="min-w-0">
          <div
            className="text-[10px] font-mono tracking-[0.2em]"
            style={{ color: '#7b8499' }}
          >
            MISSION CONTROL /
          </div>
          <div
            className="text-sm md:text-base font-semibold truncate"
            style={{ color: '#e5e7eb', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
          >
            {activeLabel}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-5">
        {/* Connection status */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-sm border" style={{ borderColor: '#1a2138', background: '#0d1220' }}>
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
              style={{ background: '#4ade80' }}
            />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#4ade80' }} />
          </span>
          <span className="text-xs font-mono tracking-wider" style={{ color: '#4ade80' }}>LINK OK</span>
        </div>

        {/* Active missions */}
        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span className="text-[10px] font-mono" style={{ color: '#7b8499' }}>ACTIVE</span>
          <span className="text-sm font-mono font-semibold" style={{ color: '#22d3ee' }}>{activeCount}</span>
        </div>

        {/* Alert badge */}
        <div className="relative flex flex-col items-end leading-tight">
          <span className="text-[10px] font-mono" style={{ color: '#7b8499' }}>ALERTS</span>
          <span
            className="text-sm font-mono font-semibold"
            style={{ color: unresolvedAlertCount > 0 ? '#fbbf24' : '#4ade80' }}
          >
            {unresolvedAlertCount}
          </span>
        </div>

        {/* UTC clock */}
        <div className="flex flex-col items-end leading-tight border-l pl-3 md:pl-5" style={{ borderColor: '#1a2138' }}>
          <span className="text-[10px] font-mono" style={{ color: '#7b8499' }}>UTC</span>
          <span
            className="text-sm md:text-base font-mono font-semibold tabular-nums"
            style={{ color: '#e5e7eb' }}
          >
            {formatUTC(clock)}
          </span>
        </div>
      </div>
    </header>
  );
}

// --- Placeholder panel primitive --------------------------------------------

function Panel({
  title,
  eyebrow,
  children,
  className = '',
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
        background: '#0d1220',
        borderColor: glow ? 'rgba(34,211,238,0.4)' : '#1a2138',
        boxShadow: glow ? '0 0 0 1px rgba(34,211,238,0.08), 0 0 24px rgba(34,211,238,0.08)' : 'none',
      }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h3
          className="text-sm font-semibold tracking-wide"
          style={{ color: '#e5e7eb', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
        >
          {title}
        </h3>
        {eyebrow && (
          <span className="text-[10px] font-mono" style={{ color: '#7b8499' }}>{eyebrow}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// SECTION 5: OVERVIEW DASHBOARD
// ----------------------------------------------------------------------------
// The default/home screen. Composed of four sub-sections:
//   5a. KPI row            - 4 live stat cards with sparkline/trend + flash
//   5b. Mission progress   - hand-built SVG donut chart (no chart library)
//   5c. Mission list       - scrollable, selectable table driving global state
//   5d. Live alerts feed   - stacked list with entrance animation + pulse
// ============================================================================

// --- 5a. KPI row -------------------------------------------------------------

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
  if (data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
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
        background: flash ? 'rgba(34,211,238,0.06)' : '#0d1220',
        borderColor: flash ? 'rgba(34,211,238,0.5)' : '#1a2138',
        boxShadow: flash
          ? '0 0 0 1px rgba(34,211,238,0.15), 0 0 20px rgba(34,211,238,0.15)'
          : '0 0 0 0 transparent',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-xs font-semibold tracking-wide" style={{ color: '#8b93a7', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
          {title.toUpperCase()}
        </h3>
        {sparklineData && sparklineColor && (
          <Sparkline data={sparklineData} color={sparklineColor} />
        )}
      </div>
      <div className="flex items-end justify-between">
        <span
          className="text-3xl font-mono font-bold tabular-nums transition-colors duration-300"
          style={{ color: valueColor }}
        >
          {value}
        </span>
        <span className="text-xs font-mono mb-0.5" style={{ color: statusColor }}>
          ● {statusLabel}
        </span>
      </div>
    </div>
  );
}

function KpiRow() {
  const { missions, spacecraft, alerts } = useSimulation();

  const activeCount = missions.filter((m) => m.status === 'active').length;
  const nominalCount = missions.filter((m) => m.status === 'active' || m.status === 'completed').length;
  const warningCount = missions.filter((m) => m.status === 'warning').length;

  const unresolvedAlerts = alerts.filter((a) => !a.resolved);
  const criticalCount = unresolvedAlerts.filter((a) => a.severity === 'critical').length;
  const warningAlertCount = unresolvedAlerts.filter((a) => a.severity === 'warning').length;
  const infoAlertCount = unresolvedAlerts.filter((a) => a.severity === 'info').length;

  const onlineCount = spacecraft.length;
  // Fleet-wide averaged power history, used as a proxy "trend" sparkline for
  // the Spacecraft Online card (shows fleet health direction at a glance).
  const fleetPowerTrend = Array.from({ length: 20 }).map((_, i) =>
    Math.round(
      spacecraft.reduce((sum, s) => sum + (s.history.power[i] ?? s.powerLevel), 0) / spacecraft.length
    )
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
        statusLabel={warningCount > 0 ? `${warningCount} WARNING` : 'ALL NOMINAL'}
        statusColor={warningCount > 0 ? '#fbbf24' : '#4ade80'}
        flashKey={nominalCount * 100 + warningCount}
      />
      <KpiCard
        title="Alerts"
        value={unresolvedAlerts.length}
        valueColor={criticalCount > 0 ? '#f87171' : warningAlertCount > 0 ? '#fbbf24' : '#4ade80'}
        statusLabel={
          criticalCount > 0
            ? `${criticalCount} CRITICAL`
            : warningAlertCount > 0
            ? `${warningAlertCount} WARNING`
            : 'CLEAR'
        }
        statusColor={criticalCount > 0 ? '#f87171' : warningAlertCount > 0 ? '#fbbf24' : '#4ade80'}
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

// --- 5b. Mission progress donut ---------------------------------------------

interface DonutSlice {
  label: string;
  value: number; // percentage points, should sum to ~100 across slices
  color: string;
}

function MissionProgressDonut({ slices, centerLabel }: { slices: DonutSlice[]; centerLabel: number }) {
  const size = 180;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
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
          <span className="text-3xl font-mono font-bold tabular-nums" style={{ color: '#e5e7eb' }}>
            {centerLabel}%
          </span>
          <span className="text-[10px] font-mono tracking-wider" style={{ color: '#7b8499' }}>
            OVERALL
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 w-full sm:w-auto">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center justify-between gap-4 sm:gap-8 min-w-[160px]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: slice.color, boxShadow: `0 0 6px ${slice.color}` }} />
              <span className="text-xs font-mono" style={{ color: '#8b93a7' }}>{slice.label}</span>
            </div>
            <span className="text-sm font-mono font-semibold tabular-nums" style={{ color: '#e5e7eb' }}>
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
    missions.reduce((sum, m) => sum + m.progress, 0) / missions.length
  );
  const activeCount = missions.filter((m) => m.status === 'active').length;
  const plannedCount = missions.filter((m) => m.status === 'planned').length;
  const totalNonCompleted = Math.max(1, missions.length);
  const inProgressPct = Math.round((activeCount / totalNonCompleted) * 100 * 0.25);
  const plannedPct = Math.max(0, 100 - completedPct - inProgressPct) || (plannedCount > 0 ? 10 : 100 - completedPct);

  const slices: DonutSlice[] = [
    { label: 'Completed', value: completedPct, color: '#22d3ee' },
    { label: 'In Progress', value: Math.min(inProgressPct, 100 - completedPct), color: '#3b82f6' },
    {
      label: 'Planned',
      value: Math.max(0, 100 - completedPct - Math.min(inProgressPct, 100 - completedPct)),
      color: '#fbbf24',
    },
  ];

  return (
    <Panel title="Mission Progress" eyebrow="FLEET AGGREGATE">
      <MissionProgressDonut slices={slices} centerLabel={completedPct} />
    </Panel>
  );
}

// --- 5c. Mission list / status table -----------------------------------------

const STATUS_COLORS: Record<MissionStatus, string> = {
  active: '#4ade80',
  completed: '#22d3ee',
  planned: '#a78bfa',
  warning: '#fbbf24',
};

function StatusBadge({ status }: { status: MissionStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono tracking-wide shrink-0"
      style={{ color, background: `${color}1a`, border: `1px solid ${color}40` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {status.toUpperCase()}
    </span>
  );
}

function MissionListPanel() {
  const { missions, selectedMissionId } = useSimulation();
  const selectMission = useMissionSelect();

  return (
    <Panel title="Mission List" eyebrow={`${missions.length} MISSIONS`} className="h-full">
      <div className="flex flex-col divide-y max-h-[420px] overflow-y-auto -mr-1 pr-1" style={{ borderColor: '#1a2138' }}>
        {missions.map((m) => {
          const isSelected = m.id === selectedMissionId;
          const color = STATUS_COLORS[m.status];
          return (
            <button
              key={m.id}
              onClick={() => selectMission(m.id)}
              aria-pressed={isSelected}
              aria-label={`Select mission ${m.name}`}
              className="text-left py-3 first:pt-0 last:pb-0 group transition-colors focus-visible:outline-none focus-visible:ring-2 rounded-sm"
              style={{ borderColor: '#1a2138', outlineColor: '#22d3ee' }}
            >
              <div
                className="rounded-sm px-3 py-2.5 -mx-3 transition-all duration-200"
                style={{
                  background: isSelected ? 'rgba(34,211,238,0.08)' : 'transparent',
                  boxShadow: isSelected ? 'inset 2px 0 0 0 #22d3ee' : 'inset 2px 0 0 0 transparent',
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className="text-sm font-semibold truncate transition-colors"
                    style={{ color: isSelected ? '#22d3ee' : '#e5e7eb', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
                  >
                    {m.name}
                  </span>
                  <StatusBadge status={m.status} />
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: '#1a2138' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${m.progress}%`, background: color, boxShadow: `0 0 6px ${color}88` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono tabular-nums shrink-0" style={{ color: '#8b93a7' }}>
                    {m.progress}%
                  </span>
                </div>
                <div className="text-[10px] font-mono mt-1.5" style={{ color: '#7b8499' }}>
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

// --- 5d. Live alerts feed -----------------------------------------------------

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: '#22d3ee',
  warning: '#fbbf24',
  critical: '#f87171',
};

function AlertRow({ alert, isNew }: { alert: Alert; isNew: boolean }) {
  const { missions, utcNow } = useSimulation();
  const mission = missions.find((m) => m.id === alert.missionId);
  const color = SEVERITY_COLORS[alert.severity];

  return (
    <div
      className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 border-b last:border-b-0"
      style={{
        borderColor: '#1a2138',
        opacity: alert.resolved ? 0.45 : 1,
        animation: isNew ? 'aegis-alert-in 500ms ease-out' : undefined,
      }}
    >
      <span className="relative flex h-2.5 w-2.5 mt-1 shrink-0">
        {alert.severity === 'critical' && !alert.resolved && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70"
            style={{ background: color }}
          />
        )}
        <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: color }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs leading-snug" style={{ color: '#e5e7eb' }}>
            {alert.message}
          </p>
          <span className="text-[10px] font-mono shrink-0 mt-0.5" style={{ color: '#7b8499' }}>
            {relativeTime(alert.timestamp, utcNow)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-mono tracking-wide" style={{ color }}>
            {alert.severity.toUpperCase()}
          </span>
          {mission && (
            <>
              <span style={{ color: '#7b8499' }}>·</span>
              <span className="text-[10px] font-mono" style={{ color: '#7b8499' }}>{mission.name}</span>
            </>
          )}
          {alert.resolved && (
            <>
              <span style={{ color: '#7b8499' }}>·</span>
              <span className="text-[10px] font-mono" style={{ color: '#4ade80' }}>RESOLVED</span>
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
    <Panel title="Live Alerts" eyebrow={`${alerts.filter((a) => !a.resolved).length} ACTIVE`} className="h-full">
      <style>{`
        @keyframes aegis-alert-in {
          0% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="flex flex-col max-h-[420px] overflow-y-auto -mr-1 pr-1">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="text-xs font-mono" style={{ color: '#7b8499' }}>NO ALERTS RECORDED</span>
          </div>
        ) : (
          sorted.map((a) => (
            <AlertRow key={a.id} alert={a} isNew={newlyAddedAlertIds.includes(a.id)} />
          ))
        )}
      </div>
    </Panel>
  );
}

// --- Overview root -------------------------------------------------------------

function OverviewPlaceholder() {
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

function GenericPlaceholder({ label }: { label: string }) {
  return (
    <Panel title={label} eyebrow="COMING NEXT PHASE">
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div
          className="w-12 h-12 rounded-sm border flex items-center justify-center mb-3"
          style={{ borderColor: '#1a2138', color: '#7b8499' }}
        >
          <IconGrid />
        </div>
        <p className="text-sm font-mono" style={{ color: '#7b8499' }}>
          {label} module will be built in the next phase.
        </p>
      </div>
    </Panel>
  );
}

// --- Shared "no telemetry for this mission" empty state ----------------------
// A small number of missions (e.g. a completed mission past deorbit) have no
// active spacecraft feeding live telemetry. Rather than silently falling back
// to an unrelated craft - which would desync the screen from what's actually
// selected - every mission-focused screen renders this explicit, on-theme
// empty state instead.
function NoSpacecraftDataPanel({ mission }: { mission: Mission }) {
  return (
    <Panel title="No Live Telemetry" eyebrow={mission.name}>
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <div
          className="w-12 h-12 rounded-full border flex items-center justify-center"
          style={{ borderColor: 'rgba(139,147,167,0.35)', color: '#7b8499' }}
        >
          <IconSignal />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#e5e7eb', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
            No spacecraft telemetry available
          </p>
          <p className="text-xs font-mono mt-1.5 max-w-xs" style={{ color: '#7b8499' }}>
            {mission.name} has no active craft reporting live data
            {mission.status === 'completed' ? ' — mission has concluded.' : '.'}
          </p>
        </div>
        <span
          className="text-[10px] font-mono tracking-wide px-2.5 py-1 rounded-sm border"
          style={{ color: STATUS_COLORS[mission.status], borderColor: `${STATUS_COLORS[mission.status]}40`, background: `${STATUS_COLORS[mission.status]}1a` }}
        >
          STATUS: {mission.status.toUpperCase()}
        </span>
      </div>
    </Panel>
  );
}

// ============================================================================
// SECTION 6: TELEMETRY SCREEN
// ----------------------------------------------------------------------------
// The visual centerpiece of AEGIS. Two halves:
//   6a. Orbital visualization - hand-built SVG globe + orbit rings + animated
//       satellite markers, driven by requestAnimationFrame (not React state
//       per-frame) so motion stays smooth regardless of render cost elsewhere.
//   6b. Telemetry data panel - live readouts + sparklines + subsystem bars
//       for the selected spacecraft, sourced from useSimulation()/history.
// ============================================================================

// --- 6a. Starfield background -------------------------------------------------

interface Star {
  x: number;
  y: number;
  r: number;
  delay: number;
  duration: number;
}

// Stars are generated once per mount (useState initializer, not useEffect) so
// they don't reshuffle on every re-render - only the twinkle opacity animates,
// via pure CSS, so it costs nothing in JS.
function useStarfield(count: number): Star[] {
  const [stars] = useState<Star[]>(() =>
    Array.from({ length: count }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      r: Math.random() * 1.1 + 0.3,
      delay: Math.random() * 4,
      duration: 2.5 + Math.random() * 3.5,
    }))
  );
  return stars;
}

function Starfield({ count = 90 }: { count?: number }) {
  const stars = useStarfield(count);
  return (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
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

// --- 6b. Orbital visualization -----------------------------------------------

interface OrbitDef {
  craftId: string; // spacecraft.id - the orbit belongs to a craft, not a mission
  // ellipse radii (in local SVG units, before global zoom scale)
  rx: number;
  ry: number;
  // rotation of the ellipse in degrees, gives orbits varied tilt
  tilt: number;
  // starting phase angle in degrees
  phase: number;
  // degrees per second of travel - varied per orbit for visual richness
  speed: number;
  color: string;
}

// One orbit ring per spacecraft, sized/tilted deterministically from index
// so the layout is stable across re-renders but still visually varied.
function buildOrbitDefs(spacecraft: Spacecraft[]): OrbitDef[] {
  const palette = ['#22d3ee', '#a78bfa', '#4ade80', '#fbbf24', '#f87171', '#38bdf8', '#f472b6'];
  return spacecraft.map((sc, i) => ({
    craftId: sc.id,
    rx: 90 + i * 34,
    ry: 46 + i * 17,
    tilt: (i % 2 === 0 ? 1 : -1) * (6 + i * 4),
    phase: (i * 137) % 360, // spread starting angles
    speed: 9 - i * 0.7, // outer orbits move slightly slower
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
  // Sample the tilted ellipse into a polyline path (smooth enough at 64 points,
  // and avoids SVG's lack of a native "rotated ellipse" primitive).
  const steps = 64;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const angle = (360 / steps) * i;
    const { x, y } = pointOnOrbit(orbit, angle);
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d + 'Z';
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
  const [angles, setAngles] = useState<number[]>(() => orbits.map((o) => o.phase));
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // requestAnimationFrame loop drives orbital motion directly - a single
  // setState per frame batches all satellite positions together, which is
  // far cheaper than re-rendering the whole dashboard on the 2.5s sim tick.
  useEffect(() => {
    function frame(ts: number) {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dtSec = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setAngles((prev) => prev.map((a, i) => (a + orbits[i].speed * dtSec) % 360));
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
        background: '#070a12',
        borderColor: '#1a2138',
        // aspect-ratio (not just minHeight) gives the SVG a real height to
        // resolve `h-full` against at every breakpoint - minHeight alone left
        // this collapsing to 0 in a plain block container per CSS spec, only
        // "working" before because of the SVG's own inline min/maxHeight.
        aspectRatio: '1 / 1',
        minHeight: 280,
        maxHeight: 560,
      }}
    >
      <Starfield count={100} />

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
        <button
          onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.2).toFixed(2))))}
          className="w-7 h-7 flex items-center justify-center rounded-sm border text-sm font-mono transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2"
          style={{ borderColor: '#1a2138', background: '#0d1220', color: '#8b93a7', outlineColor: '#22d3ee' }}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))))}
          className="w-7 h-7 flex items-center justify-center rounded-sm border text-sm font-mono transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2"
          style={{ borderColor: '#1a2138', background: '#0d1220', color: '#8b93a7', outlineColor: '#22d3ee' }}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      <div className="absolute top-3 left-3 z-20 text-[10px] font-mono tracking-wider" style={{ color: '#7b8499' }}>
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

        <g transform={`translate(${center} ${center}) scale(${zoom}) translate(${-center} ${-center})`}>
          {/* Orbit rings, rendered first so they sit beneath the globe's atmosphere glow edge */}
          {orbits.map((orbit, i) => {
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
                  filter: isSelected ? `drop-shadow(0 0 4px ${orbit.color})` : 'none',
                  transition: 'opacity 300ms ease, stroke-width 300ms ease',
                }}
              />
            );
          })}

          {/* Atmosphere glow */}
          <circle cx={center} cy={center} r={54} fill="url(#aegis-earth-glow)" />

          {/* Earth body */}
          <circle cx={center} cy={center} r={38} fill="url(#aegis-earth-body)" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="1" />

          {/* Rotating cloud/texture layer, clipped to the globe */}
          <g clipPath="url(#aegis-earth-clip)">
            <g style={{ transformOrigin: `${center}px ${center}px`, animation: 'aegis-globe-spin 60s linear infinite' }}>
              <ellipse cx={center - 12} cy={center - 8} rx={16} ry={7} fill="#7dd3fc" opacity="0.14" />
              <ellipse cx={center + 14} cy={center + 4} rx={20} ry={6} fill="#7dd3fc" opacity="0.1" />
              <ellipse cx={center - 6} cy={center + 16} rx={12} ry={5} fill="#7dd3fc" opacity="0.12" />
              <ellipse cx={center + 22} cy={center - 14} rx={10} ry={4} fill="#a5f3fc" opacity="0.1" />
            </g>
          </g>
          <style>{`
            @keyframes aegis-globe-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>

          {/* Satellites */}
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
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(orbit.craftId);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Select ${sc.name}${isSelected ? ', currently selected' : ''}`}
                className="cursor-pointer focus-visible:outline-none"
              >
                {isSelected && (
                  <circle r={9} fill="none" stroke={orbit.color} strokeWidth="1" opacity="0.6">
                    <animate attributeName="r" values="6;11;6" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
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
                    <rect x={0} y={-11} width={sc.name.length * 6.4 + 14} height={16} rx={2} fill="#0d1220" stroke={orbit.color} strokeOpacity="0.5" strokeWidth="0.75" />
                    <text x={7} y={0} fontSize="9" fontFamily="'JetBrains Mono', monospace" fill={orbit.color}>
                      {sc.name}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute bottom-3 left-3 z-20 text-[10px] font-mono" style={{ color: '#7b8499' }}>
        {spacecraft.length} TRACKED · ZOOM {zoom.toFixed(1)}×
      </div>
    </div>
  );
}

// --- 6c. Telemetry readout cards ---------------------------------------------

function AnimatedSparkline({ data, color }: { data: number[]; color: string }) {
  // Slightly taller than the KPI sparkline since this is the visual focus
  // of the telemetry cards; area fill under the line reinforces "graph."
  const width = 140;
  const height = 40;
  if (data.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-label="No trend data yet">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#1a2138" strokeWidth="1.5" strokeDasharray="3 3" />
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
  const line = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={area} fill={color} opacity="0.12" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <animate attributeName="opacity" values="0.5;1;1" dur="600ms" />
      </path>
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="2.2" fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
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
  const flash = useFlashOnChange(Number(value.replace(/[^0-9.-]/g, '')) || 0);
  return (
    <div
      className="rounded-sm border p-3.5 flex flex-col gap-2 transition-colors duration-300"
      style={{
        background: flash ? 'rgba(34,211,238,0.05)' : '#0d1220',
        borderColor: flash ? 'rgba(34,211,238,0.4)' : '#1a2138',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-mono tracking-wide mb-1" style={{ color: '#7b8499' }}>
            {label.toUpperCase()}
          </div>
          <div className="text-lg font-mono font-semibold tabular-nums" style={{ color }}>
            {value}
            {unit && <span className="text-xs ml-1" style={{ color: '#7b8499' }}>{unit}</span>}
          </div>
        </div>
        {history && <AnimatedSparkline data={history} color={color} />}
      </div>
    </div>
  );
}

function SubsystemBar({ subsystem }: { subsystem: Subsystem }) {
  const color =
    subsystem.status === 'nominal' ? '#4ade80' : subsystem.status === 'warning' ? '#fbbf24' : '#f87171';
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-mono w-20 shrink-0" style={{ color: '#8b93a7' }}>
        {subsystem.label.toUpperCase()}
      </span>
      <div className="flex-1 h-2 rounded-sm overflow-hidden" style={{ background: '#1a2138' }}>
        <div
          className="h-full rounded-sm transition-all duration-700 ease-out"
          style={{ width: `${subsystem.health}%`, background: color, boxShadow: `0 0 6px ${color}88` }}
        />
      </div>
      <span className="text-[11px] font-mono w-9 text-right tabular-nums shrink-0" style={{ color }}>
        {subsystem.health}%
      </span>
    </div>
  );
}

function TelemetryDataPanel({ craft }: { craft: Spacecraft }) {
  const healthColor = craft.systemHealth >= 90 ? '#4ade80' : craft.systemHealth >= 70 ? '#fbbf24' : '#f87171';

  return (
    <div className="flex flex-col gap-4">
      <Panel title={craft.name} eyebrow="SELECTED CRAFT" glow>
        <div className="grid grid-cols-2 gap-3">
          <TelemetryMetricCard label="Altitude" value={craft.altitude.toFixed(1)} unit="km" color="#22d3ee" history={craft.history.altitude} />
          <TelemetryMetricCard label="Velocity" value={craft.velocity.toFixed(2)} unit="km/s" color="#22d3ee" history={craft.history.velocity} />
          <TelemetryMetricCard label="Power" value={craft.powerLevel.toFixed(1)} unit="%" color="#4ade80" history={craft.history.power} />
          <TelemetryMetricCard label="Fuel" value={craft.fuelLevel.toFixed(1)} unit="%" color="#a78bfa" />
          <TelemetryMetricCard label="Signal" value={String(craft.signalStrength)} unit="dBm" color="#38bdf8" />
          <TelemetryMetricCard label="Temp" value={craft.onboardTemp.toFixed(1)} unit="°C" color="#fbbf24" />
        </div>
        <div className="mt-3 pt-3 border-t" style={{ borderColor: '#1a2138' }}>
          <div className="flex items-center justify-between text-[11px] font-mono" style={{ color: '#7b8499' }}>
            <span>POSITION</span>
            <span style={{ color: '#e5e7eb' }}>
              {craft.latitude.toFixed(1)}° N, {craft.longitude.toFixed(1)}° E
            </span>
          </div>
        </div>
      </Panel>

      <Panel title="System Health" eyebrow={`${craft.systemHealth}% AGGREGATE`}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-mono font-bold tabular-nums" style={{ color: healthColor }}>
            {craft.systemHealth}%
          </span>
          <div className="flex-1 h-1.5 rounded-full" style={{ background: '#1a2138' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${craft.systemHealth}%`, background: healthColor, boxShadow: `0 0 8px ${healthColor}88` }}
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

// --- Telemetry screen root ----------------------------------------------------

function TelemetryScreen() {
  const { spacecraft, missions, selectedMissionId } = useSimulation();
  const selectMission = useMissionSelect();

  const selectedMission = missions.find((m) => m.id === selectedMissionId) ?? missions[0];
  const focused = spacecraft.find((s) => s.missionId === selectedMissionId);

  // Orbital view selects/highlights by spacecraft.id (a mission's craft),
  // but the global store tracks selectedMissionId so the choice stays in
  // sync with the Overview mission list and Comms/Timeline screens.
  function handleSelectCraft(craftId: string) {
    const craft = spacecraft.find((s) => s.id === craftId);
    if (craft) selectMission(craft.missionId);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
      <div className="lg:col-span-3">
        <OrbitalVisualization
          spacecraft={spacecraft}
          selectedId={focused?.id ?? ''}
          onSelect={handleSelectCraft}
        />
      </div>
      <div className="lg:col-span-2">
        {focused ? (
          <TelemetryDataPanel craft={focused} />
        ) : (
          <NoSpacecraftDataPanel mission={selectedMission} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SECTION 7: COMMS & SYSTEM HEALTH SCREEN
// ----------------------------------------------------------------------------
// Four sub-sections, all scoped to the currently-selected spacecraft:
//   7a. Link status panel   - uplink/downlink cards with animated waveform
//   7b. System health grid  - radial gauge per subsystem, color-coded
//   7c. Live alert log      - filterable, acknowledgeable, subsystem-tagged
//   7d. Comms timeline      - signal strength history mini-chart
// ============================================================================

// --- 7a. Link status panel ---------------------------------------------------

type LinkState = 'locked' | 'searching' | 'lost';

// Derive a plausible link state from signal strength (dBm, closer to 0 = stronger).
// This keeps the UI fully driven by the simulation's signalStrength value rather
// than introducing a separate untracked mock field.
function linkStateFromSignal(signalStrength: number): LinkState {
  if (signalStrength >= -125) return 'locked';
  if (signalStrength >= -145) return 'searching';
  return 'lost';
}

const LINK_STATE_COLORS: Record<LinkState, string> = {
  locked: '#4ade80',
  searching: '#fbbf24',
  lost: '#f87171',
};

// Animated waveform that reacts to signal strength: stronger signal = taller,
// faster-moving bars. Pure CSS animation (staggered delays) - no per-frame JS.
function SignalWaveform({ signalStrength, color }: { signalStrength: number; color: string }) {
  // Normalize -160..-85 dBm into a 0..1 strength factor for bar heights.
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

function SignalBars({ signalStrength, color }: { signalStrength: number; color: string }) {
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
            background: i < activeBars ? color : '#1a2138',
            boxShadow: i < activeBars ? `0 0 4px ${color}` : 'none',
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
  const isLost = linkState === 'lost';

  return (
    <div
      className="rounded-sm border p-4 flex flex-col gap-3 transition-all duration-300"
      style={{
        background: isLost ? 'rgba(248,113,113,0.06)' : '#0d1220',
        borderColor: isLost ? 'rgba(248,113,113,0.5)' : '#1a2138',
        boxShadow: isLost ? '0 0 20px rgba(248,113,113,0.12)' : 'none',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide" style={{ color: '#8b93a7', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
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
            style={{ color, background: `${color}1a`, border: `1px solid ${color}40` }}
          >
            {linkState.toUpperCase()}
          </span>
        </span>
      </div>

      <SignalWaveform signalStrength={signalStrength} color={color} />

      <div className="grid grid-cols-3 gap-2 pt-2 border-t" style={{ borderColor: '#1a2138' }}>
        <div>
          <div className="text-[9px] font-mono mb-0.5" style={{ color: '#7b8499' }}>RATE</div>
          <div className="text-sm font-mono font-semibold tabular-nums" style={{ color: '#e5e7eb' }}>
            {dataRate.toFixed(1)} <span className="text-[10px]" style={{ color: '#7b8499' }}>Mbps</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] font-mono mb-0.5" style={{ color: '#7b8499' }}>LATENCY</div>
          <div className="text-sm font-mono font-semibold tabular-nums" style={{ color: '#e5e7eb' }}>
            {latency} <span className="text-[10px]" style={{ color: '#7b8499' }}>ms</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] font-mono mb-0.5" style={{ color: '#7b8499' }}>SIGNAL</div>
          <SignalBars signalStrength={signalStrength} color={color} />
        </div>
      </div>
    </div>
  );
}

function LinkStatusPanel({ craft }: { craft: Spacecraft }) {
  const linkState = linkStateFromSignal(craft.signalStrength);
  // Downlink mirrors uplink state with a slight independent variation so the
  // two links don't feel mechanically identical, while both stay derived
  // from the same underlying signalStrength (no separate untracked fields).
  const downlinkSignal = craft.signalStrength + (craft.signalStrength % 7 === 0 ? -6 : 3);
  const downlinkState = linkStateFromSignal(downlinkSignal);

  // Mock data rate / latency, deterministically derived from signal + craft id
  // so values feel stable per-craft but still respond to signal changes.
  const dataRateUp = clamp(2.4 + (craft.signalStrength + 160) / 20, 0.2, 12);
  const dataRateDown = clamp(8.1 + (downlinkSignal + 160) / 14, 0.4, 22);
  const latencyUp = Math.round(clamp(240 - (craft.signalStrength + 160) * 1.1, 40, 900));
  const latencyDown = Math.round(clamp(210 - (downlinkSignal + 160) * 1.1, 40, 900));

  return (
    <Panel title="Link Status" eyebrow={craft.name}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LinkCard label="Uplink" linkState={linkState} dataRate={dataRateUp} latency={latencyUp} signalStrength={craft.signalStrength} />
        <LinkCard label="Downlink" linkState={downlinkState} dataRate={dataRateDown} latency={latencyDown} signalStrength={downlinkSignal} />
      </div>
    </Panel>
  );
}

// --- 7b. System health grid with radial gauges -------------------------------

function healthColor(health: number): string {
  if (health > 85) return '#4ade80';
  if (health >= 60) return '#fbbf24';
  return '#f87171';
}

function healthLabel(health: number): string {
  if (health > 85) return 'NOMINAL';
  if (health >= 60) return 'DEGRADED';
  return 'CRITICAL';
}

function RadialGauge({ value, color, size = 84 }: { value: number; color: string; size?: number }) {
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamp(value, 0, 100) / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1a2138" strokeWidth={strokeWidth} />
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
        <span className="text-lg font-mono font-bold tabular-nums" style={{ color }}>
          {value}
        </span>
      </div>
    </div>
  );
}

function SubsystemGaugeCard({ subsystem }: { subsystem: Subsystem }) {
  const color = healthColor(subsystem.health);
  const label = healthLabel(subsystem.health);
  const isCritical = subsystem.health < 60;
  const flash = useFlashOnChange(subsystem.health);

  return (
    <div
      className="rounded-sm border p-4 flex flex-col items-center gap-2 text-center transition-all duration-300"
      style={{
        background: isCritical ? 'rgba(248,113,113,0.06)' : flash ? 'rgba(34,211,238,0.05)' : '#0d1220',
        borderColor: isCritical ? 'rgba(248,113,113,0.55)' : '#1a2138',
        boxShadow: isCritical ? '0 0 20px rgba(248,113,113,0.15)' : 'none',
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
      <span className="text-xs font-semibold tracking-wide mt-1" style={{ color: '#e5e7eb', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
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
    <Panel title="System Health Overview" eyebrow={`${craft.systemHealth}% AGGREGATE`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {craft.subsystems.map((s) => (
          <SubsystemGaugeCard key={s.key} subsystem={s} />
        ))}
      </div>
    </Panel>
  );
}

// --- 7c. Live alert log (filterable + acknowledgeable) -----------------------

type AlertFilter = 'all' | AlertSeverity;

const SUBSYSTEM_LABELS: Record<SubsystemKey, string> = {
  power: 'POWER',
  thermal: 'THERMAL',
  comms: 'COMMS',
  propulsion: 'PROPULSION',
  navigation: 'NAVIGATION',
};

function SeverityIcon({ severity, color }: { severity: AlertSeverity; color: string }) {
  if (severity === 'critical') {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={color} strokeWidth="2">
        <path d="M12 3l10 18H2L12 3Z" strokeLinejoin="round" />
        <path d="M12 10v4M12 17.5v.01" strokeLinecap="round" />
      </svg>
    );
  }
  if (severity === 'warning') {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={color} strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 15.5v.01" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={color} strokeWidth="2">
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
  const isCriticalActive = alert.severity === 'critical' && !alert.resolved && !alert.acknowledged;

  return (
    <div
      className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 border-b last:border-b-0 transition-opacity duration-300"
      style={{ borderColor: '#1a2138', opacity: alert.acknowledged ? 0.5 : 1 }}
    >
      <span className="relative flex items-center justify-center w-6 h-6 mt-0.5 shrink-0 rounded-sm" style={{ background: `${color}1a` }}>
        {isCriticalActive && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-sm opacity-40" style={{ background: color }} />
        )}
        <SeverityIcon severity={alert.severity} color={color} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs leading-snug" style={{ color: '#e5e7eb' }}>{alert.message}</p>
          <span className="text-[10px] font-mono shrink-0 mt-0.5" style={{ color: '#7b8499' }}>
            {relativeTime(alert.timestamp, utcNow)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <span className="text-[10px] font-mono tracking-wide" style={{ color }}>{alert.severity.toUpperCase()}</span>
          {alert.subsystem && (
            <>
              <span style={{ color: '#7b8499' }}>·</span>
              <span
                className="text-[9px] font-mono tracking-wide px-1.5 py-0.5 rounded-sm"
                style={{ color: '#8b93a7', background: '#1a2138' }}
              >
                {SUBSYSTEM_LABELS[alert.subsystem]}
              </span>
            </>
          )}
          {mission && (
            <>
              <span style={{ color: '#7b8499' }}>·</span>
              <span className="text-[10px] font-mono" style={{ color: '#7b8499' }}>{mission.name}</span>
            </>
          )}
          {alert.resolved && (
            <>
              <span style={{ color: '#7b8499' }}>·</span>
              <span className="text-[10px] font-mono" style={{ color: '#4ade80' }}>RESOLVED</span>
            </>
          )}
          <div className="flex-1" />
          {alert.acknowledged ? (
            <span className="text-[10px] font-mono tracking-wide" style={{ color: '#7b8499' }}>ACKNOWLEDGED</span>
          ) : (
            <button
              onClick={() => acknowledgeAlert(alert.id)}
              aria-label={`Acknowledge alert: ${alert.message}`}
              className="text-[10px] font-mono tracking-wide px-2 py-0.5 rounded-sm border transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2"
              style={{ color: '#8b93a7', borderColor: '#1a2138', outlineColor: '#22d3ee' }}
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
  { key: 'all', label: 'All' },
  { key: 'info', label: 'Info' },
  { key: 'warning', label: 'Warning' },
  { key: 'critical', label: 'Critical' },
];

function LiveAlertLogPanel({ missionId }: { missionId: string | null }) {
  const { alerts } = useSimulation();
  const [filter, setFilter] = useState<AlertFilter>('all');

  const missionAlerts = alerts.filter((a) => a.missionId === missionId);
  const filtered =
    filter === 'all' ? missionAlerts : missionAlerts.filter((a) => a.severity === filter);
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Panel title="Live Alert Log" eyebrow={`${missionAlerts.filter((a) => !a.acknowledged).length} UNACK'D`}>
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {ALERT_FILTERS.map((f) => {
          const isActive = filter === f.key;
          const count = f.key === 'all' ? missionAlerts.length : missionAlerts.filter((a) => a.severity === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={isActive}
              className="text-[10px] font-mono tracking-wide px-2.5 py-1 rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2"
              style={{
                color: isActive ? '#22d3ee' : '#8b93a7',
                borderColor: isActive ? 'rgba(34,211,238,0.5)' : '#1a2138',
                background: isActive ? 'rgba(34,211,238,0.08)' : 'transparent',
                outlineColor: '#22d3ee',
              }}
            >
              {f.label.toUpperCase()} <span style={{ color: '#7b8499' }}>({count})</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col max-h-[360px] overflow-y-auto -mr-1 pr-1">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="text-xs font-mono" style={{ color: '#7b8499' }}>NO ALERTS IN THIS FILTER</span>
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
  // Reuses the rolling altitude/velocity/power history pattern - here we chart
  // signal strength trend. Signal history isn't separately tracked in the sim
  // state, so we derive a display history by anchoring the tracked power
  // history's shape to the craft's current signal reading (keeps the chart
  // "live" tick over tick using existing rolling-history data, no new arrays
  // added to the simulation reducer).
  const trend = craft.history.power.map((p, i) => {
    const powerDelta = p - craft.powerLevel;
    return Math.round(clamp(craft.signalStrength + powerDelta * 0.4, -160, -85));
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
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  // A degrading trend is when the last few points trend more negative
  // (weaker) than the earlier ones - flagged visually with an amber note.
  const recentAvg = trend.slice(-5).reduce((s, v) => s + v, 0) / Math.min(5, trend.length);
  const earlierAvg = trend.slice(0, 5).reduce((s, v) => s + v, 0) / Math.min(5, trend.length);
  const degrading = recentAvg < earlierAvg - 3;

  return (
    <Panel title="Communication Timeline" eyebrow={`${craft.name} · SIGNAL TREND`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono" style={{ color: '#7b8499' }}>
          LAST {trend.length} TICKS
        </span>
        {degrading ? (
          <span className="text-[10px] font-mono tracking-wide px-2 py-0.5 rounded-sm" style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
            ▼ DEGRADING
          </span>
        ) : (
          <span className="text-[10px] font-mono tracking-wide px-2 py-0.5 rounded-sm" style={{ color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)' }}>
            ● STABLE
          </span>
        )}
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible" preserveAspectRatio="none">
        <path d={area} fill={color} opacity="0.1" />
        <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${color}88)` }} />
        {points.length > 0 && (
          <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        )}
      </svg>
      <div className="flex items-center justify-between mt-2 text-[10px] font-mono" style={{ color: '#7b8499' }}>
        <span>{min} dBm</span>
        <span style={{ color }}>{latest} dBm CURRENT</span>
        <span>{max} dBm</span>
      </div>
    </Panel>
  );
}

// ============================================================================
// SECTION 8: TIMELINE & ANALYTICS SCREEN
// ----------------------------------------------------------------------------
// 8a. Mission Phase Timeline - interactive horizontal stepper, swappable per
//     selected mission, derived from SEED_TIMELINES when available or
//     generated procedurally from the mission's live progress/phase so every
//     mission (not just m-01) has a coherent phase timeline.
// 8b. Operational stat row  - Fuel gauge, Power, Data Usage, Events(24h)
// 8c. Multi-mission progress comparison - horizontal grouped bar chart
// 8d. Resource/efficiency chart - power vs data-usage area+line over history
// 8e. Events (24h) breakdown - small categorized bar chart
// ============================================================================

// --- 8a. Mission phase timeline -----------------------------------------------

const CANONICAL_PHASES = ['Launch', 'Orbit Insertion', 'System Check', 'Payload Ops', 'Data Downlink', 'Mission End'];
const PHASE_OFFSETS = ['T-0', 'T+00:15', 'T+02:30', 'T+05:40', 'T+08:10', 'T+12:00'];

const PHASE_DETAILS: Record<string, { desc: string; owner: string }> = {
  'Launch': { desc: 'Liftoff and ascent through max-Q to stage separation.', owner: 'Range Control' },
  'Orbit Insertion': { desc: 'Circularization burn and initial orbit determination.', owner: 'Flight Dynamics' },
  'System Check': { desc: 'Full subsystem checkout — power, thermal, comms, attitude.', owner: 'Systems Eng.' },
  'Payload Ops': { desc: 'Payload activation and primary mission operations begin.', owner: 'Payload Ops' },
  'Data Downlink': { desc: 'Scheduled downlink window — telemetry and payload data transfer.', owner: 'Ground Station' },
  'Mission End': { desc: 'Deorbit / safing sequence and mission closeout.', owner: 'Mission Director' },
};

// Builds a full phase timeline for a mission that may not have seeded data,
// by locating its current phase in the canonical sequence and inferring
// completed/current/upcoming from mission.progress.
function deriveTimelineForMission(mission: Mission): TimelinePhase[] {
  const seeded = SEED_TIMELINES[mission.id];
  if (seeded) return seeded;

  const idx = Math.max(0, CANONICAL_PHASES.indexOf(mission.phase));
  return CANONICAL_PHASES.map((label, i) => ({
    label,
    timeOffset: PHASE_OFFSETS[i],
    status: i < idx ? 'completed' : i === idx ? 'current' : 'upcoming',
  }));
}

const PHASE_STATUS_COLOR: Record<PhaseStatus, string> = {
  completed: '#4ade80',
  current: '#22d3ee',
  upcoming: '#7b8499',
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
            background: '#0d1220',
            borderColor: `${color}55`,
            boxShadow: `0 0 0 1px ${color}22, 0 8px 24px rgba(0,0,0,0.5)`,
            left: isFirst ? 0 : isLast ? 'auto' : '50%',
            right: isLast ? 0 : 'auto',
            transform: isFirst || isLast ? 'none' : 'translateX(-50%)',
            animation: 'aegis-tooltip-in 180ms ease-out',
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: '#e5e7eb', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
              {phase.label}
            </span>
            <span className="text-[10px] font-mono tracking-wide" style={{ color }}>
              {phase.status.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] leading-snug mb-1.5" style={{ color: '#8b93a7' }}>{detail.desc}</p>
          <div className="flex items-center justify-between text-[10px] font-mono" style={{ color: '#7b8499' }}>
            <span>{phase.timeOffset}</span>
            <span>{detail.owner}</span>
          </div>
        </div>
      )}

      <button
        onClick={onToggle}
        className="relative flex items-center justify-center rounded-full transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2"
        style={{ width: 22, height: 22, outlineColor: color }}
        aria-label={`${phase.label} — ${phase.status}${detail ? `. ${detail.desc}` : ''}`}
        aria-expanded={isActive}
      >
        {phase.status === 'current' && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-50"
            style={{ background: color }}
          />
        )}
        <span
          className="relative rounded-full transition-all duration-300"
          style={{
            width: phase.status === 'upcoming' ? 14 : 22,
            height: phase.status === 'upcoming' ? 14 : 22,
            background: phase.status === 'upcoming' ? 'transparent' : color,
            border: `2px solid ${color}`,
            boxShadow: phase.status !== 'upcoming' ? `0 0 10px ${color}aa` : 'none',
          }}
        />
      </button>

      <span
        className="mt-2.5 text-[11px] font-semibold text-center leading-tight px-1"
        style={{ color: phase.status === 'upcoming' ? '#8b93a7' : '#e5e7eb', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
      >
        {phase.label}
      </span>
      <span className="mt-0.5 text-[10px] font-mono" style={{ color: '#7b8499' }}>
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
      if (p.status === 'completed') idx = i;
      if (p.status === 'current') idx = i;
    });
    return idx;
  })();
  // Fill fraction: completed phases count fully, current phase counts half,
  // giving the progress line a sense of "in motion" rather than snapping.
  const currentIsPartial = phases[lastCompletedIdx]?.status === 'current';
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
        <div className="relative flex items-start pt-1 pb-1" style={{ minWidth: `${phases.length * 92}px` }}>
          {/* Track + fill line lives inside the same content-width wrapper as
              the nodes (not the outer scroll viewport), so it spans the true
              content width even when the stepper scrolls on narrow screens. */}
          <div className="absolute left-0 right-0 flex items-center pointer-events-none" style={{ top: 11 }}>
            <div className="relative w-full h-[2px] mx-[46px]" style={{ background: '#1a2138' }}>
              <div
                className="absolute inset-y-0 left-0 h-[2px] transition-all duration-700 ease-out"
                style={{
                  width: `${fillFraction * 100}%`,
                  background: 'linear-gradient(90deg, #4ade80, #22d3ee)',
                  boxShadow: '0 0 6px rgba(34,211,238,0.6)',
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

function trendArrow(delta: number): { symbol: string; color: string } {
  if (Math.abs(delta) < 0.05) return { symbol: '→', color: '#8b93a7' };
  return delta > 0 ? { symbol: '▲', color: '#4ade80' } : { symbol: '▼', color: '#f87171' };
}

function historyLenFallback(spacecraft: Spacecraft[]): number {
  return spacecraft[0]?.history.power.length ?? HISTORY_LENGTH;
}

function OperationalStatsRow({ spacecraft }: { spacecraft: Spacecraft[] }) {
  if (spacecraft.length === 0) {
    return (
      <div className="rounded-sm border p-6 text-center" style={{ background: '#0d1220', borderColor: '#1a2138' }}>
        <span className="text-xs font-mono" style={{ color: '#7b8499' }}>NO FLEET TELEMETRY AVAILABLE</span>
      </div>
    );
  }

  // Fleet aggregates derived from live spacecraft state - averaged fuel/power,
  // a synthetic "data usage" derived from signal + power activity so it moves
  // believably tick over tick without adding new sim-state fields.
  const avgFuel = Math.round(spacecraft.reduce((s, c) => s + c.fuelLevel, 0) / spacecraft.length);
  const totalPowerKw = (spacecraft.reduce((s, c) => s + c.powerLevel, 0) / spacecraft.length / 100) * 2.4 * spacecraft.length;
  const powerHistoryKw = Array.from({ length: historyLenFallback(spacecraft) }).map(
    (_, i) => (spacecraft.reduce((s, c) => s + (c.history.power[i] ?? c.powerLevel), 0) / 100) * 2.4
  );
  const powerDelta =
    powerHistoryKw.length > 1 ? powerHistoryKw[powerHistoryKw.length - 1] - powerHistoryKw[powerHistoryKw.length - 2] : 0;

  const dataUsageTb = spacecraft.reduce((s, c) => s + (160 + c.signalStrength) / 40, 0);
  const dataDelta = 0.02 * spacecraft.length; // steadily climbing - downlink is always accruing data

  const events24h = spacecraft.length * 3 + 10; // derived count, matches reference mockup's proportions

  const fuelColor = avgFuel > 50 ? '#4ade80' : avgFuel > 20 ? '#fbbf24' : '#f87171';
  const powerTrend = trendArrow(powerDelta);
  const dataTrend = trendArrow(dataDelta);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="rounded-sm border p-4 md:p-5 flex items-center gap-4" style={{ background: '#0d1220', borderColor: '#1a2138' }}>
        <RadialGauge value={avgFuel} color={fuelColor} size={64} />
        <div className="min-w-0">
          <div className="text-[10px] font-mono tracking-wide" style={{ color: '#7b8499' }}>FUEL LEVEL</div>
          <div className="text-xs font-mono mt-0.5" style={{ color: fuelColor }}>FLEET AVG</div>
        </div>
      </div>

      <div className="rounded-sm border p-4 md:p-5 flex flex-col justify-between" style={{ background: '#0d1220', borderColor: '#1a2138' }}>
        <div className="text-[10px] font-mono tracking-wide" style={{ color: '#7b8499' }}>POWER GENERATION</div>
        <div className="flex items-end justify-between mt-2">
          <span className="text-2xl font-mono font-bold tabular-nums" style={{ color: '#e5e7eb' }}>{totalPowerKw.toFixed(2)}</span>
          <span className="text-xs font-mono mb-0.5" style={{ color: '#7b8499' }}>kW</span>
        </div>
        <span className="text-[11px] font-mono mt-1" style={{ color: powerTrend.color }}>
          {powerTrend.symbol} {Math.abs(powerDelta).toFixed(2)} kW
        </span>
      </div>

      <div className="rounded-sm border p-4 md:p-5 flex flex-col justify-between" style={{ background: '#0d1220', borderColor: '#1a2138' }}>
        <div className="text-[10px] font-mono tracking-wide" style={{ color: '#7b8499' }}>DATA USAGE</div>
        <div className="flex items-end justify-between mt-2">
          <span className="text-2xl font-mono font-bold tabular-nums" style={{ color: '#e5e7eb' }}>{dataUsageTb.toFixed(2)}</span>
          <span className="text-xs font-mono mb-0.5" style={{ color: '#7b8499' }}>TB</span>
        </div>
        <span className="text-[11px] font-mono mt-1" style={{ color: dataTrend.color }}>
          {dataTrend.symbol} {dataDelta.toFixed(2)} TB/hr
        </span>
      </div>

      <div className="rounded-sm border p-4 md:p-5 flex flex-col justify-between" style={{ background: '#0d1220', borderColor: '#1a2138' }}>
        <div className="text-[10px] font-mono tracking-wide" style={{ color: '#7b8499' }}>EVENTS (24H)</div>
        <div className="flex items-end justify-between mt-2">
          <span className="text-2xl font-mono font-bold tabular-nums" style={{ color: '#22d3ee' }}>{events24h}</span>
          <span className="text-xs font-mono mb-0.5" style={{ color: '#7b8499' }}>LOGGED</span>
        </div>
        <span className="text-[11px] font-mono mt-1" style={{ color: '#8b93a7' }}>ACROSS FLEET</span>
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
    <Panel title="Mission Progress Comparison" eyebrow={`${missions.length} MISSIONS`}>
      <div className="flex flex-col gap-3">
        {sorted.map((m) => {
          const color = STATUS_COLORS[m.status];
          const isSelected = m.id === selectedMissionId;
          return (
            <div key={m.id} className="flex items-center gap-2 sm:gap-3">
              <span
                className="text-[10px] sm:text-[11px] font-mono w-16 sm:w-[104px] shrink-0 truncate"
                style={{ color: isSelected ? '#22d3ee' : '#8b93a7' }}
                title={m.name}
              >
                {m.name}
              </span>
              <div className="flex-1 h-3 rounded-full relative overflow-hidden min-w-0" style={{ background: '#1a2138' }}>
                <div
                  className="h-full rounded-full transition-all duration-[900ms] ease-out"
                  style={{
                    width: mounted ? `${m.progress}%` : '0%',
                    background: `linear-gradient(90deg, ${color}99, ${color})`,
                    boxShadow: isSelected ? `0 0 8px ${color}aa` : 'none',
                  }}
                />
              </div>
              <span className="text-[10px] sm:text-[11px] font-mono w-8 sm:w-10 text-right tabular-nums shrink-0" style={{ color: '#e5e7eb' }}>
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

// Extends the rolling ~20-tick sim history into a longer synthetic mission
// history so the chart has enough points to read as a real trend, while
// still ending exactly at the live current values (last N points mirror the
// real, ticking history so the chart stays "live").
function buildExtendedHistory(
  spacecraft: Spacecraft[],
  targetLength: number
): { power: number[]; data: number[] } {
  const livePower = spacecraft.length
    ? Array.from({ length: historyLenFallback(spacecraft) }).map(
        (_, i) => spacecraft.reduce((s, c) => s + (c.history.power[i] ?? c.powerLevel), 0) / spacecraft.length
      )
    : [];
  const liveLen = livePower.length;
  const padCount = Math.max(0, targetLength - liveLen);

  // Seeded backward extrapolation: walk backward from the first live point
  // with small bounded noise plus a gentle drift, so the synthetic prefix
  // looks like plausible earlier mission history.
  const prefix: number[] = [];
  let v = livePower[0] ?? 70;
  for (let i = 0; i < padCount; i++) {
    v = clamp(v + (Math.random() - 0.52) * 2.2, 40, 100);
    prefix.unshift(Number(v.toFixed(1)));
  }
  const power = [...prefix, ...livePower];
  const data = power.map((p, i) => Number((2.0 + (p / 100) * 3.5 + Math.sin(i / 3) * 0.4).toFixed(2)));

  return { power, data };
}

function ResourceEfficiencyChartPanel({ spacecraft }: { spacecraft: Spacecraft[] }) {
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

  const powerLine = powerPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const dataLine = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const dataArea = `${dataLine} L ${width} ${height} L 0 ${height} Z`;

  // Approximate path length for the stroke-dash draw-in animation.
  const pathLenEstimate = width * 1.4;

  return (
    <Panel title="Resource & Efficiency" eyebrow="POWER VS DATA USAGE">
      <div className="flex items-center gap-4 mb-3 text-[10px] font-mono">
        <span className="flex items-center gap-1.5" style={{ color: '#4ade80' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: '#4ade80' }} /> POWER GEN (%)
        </span>
        <span className="flex items-center gap-1.5" style={{ color: '#a78bfa' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: '#a78bfa' }} /> DATA USAGE (TB)
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id="aegis-data-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* horizontal gridlines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={width} y1={height * f} y2={height * f} stroke="#1a2138" strokeWidth="1" />
        ))}

        <path
          d={dataArea}
          fill="url(#aegis-data-area)"
          style={{ opacity: drawn ? 1 : 0, transition: 'opacity 900ms ease-out 300ms' }}
        />
        <path
          d={dataLine}
          fill="none"
          stroke="#a78bfa"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: 'drop-shadow(0 0 3px rgba(167,139,250,0.6))',
            strokeDasharray: pathLenEstimate,
            strokeDashoffset: drawn ? 0 : pathLenEstimate,
            transition: 'stroke-dashoffset 1100ms ease-out',
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
            filter: 'drop-shadow(0 0 3px rgba(74,222,128,0.6))',
            strokeDasharray: pathLenEstimate,
            strokeDashoffset: drawn ? 0 : pathLenEstimate,
            transition: 'stroke-dashoffset 1100ms ease-out 150ms',
          }}
        />
        {powerPoints.length > 0 && (
          <circle
            cx={powerPoints[powerPoints.length - 1].x}
            cy={powerPoints[powerPoints.length - 1].y}
            r="3.5"
            fill="#4ade80"
            style={{ filter: 'drop-shadow(0 0 4px #4ade80)' }}
          />
        )}
        {dataPoints.length > 0 && (
          <circle
            cx={dataPoints[dataPoints.length - 1].x}
            cy={dataPoints[dataPoints.length - 1].y}
            r="3.5"
            fill="#a78bfa"
            style={{ filter: 'drop-shadow(0 0 4px #a78bfa)' }}
          />
        )}
      </svg>
      <div className="flex items-center justify-between mt-2 text-[10px] font-mono" style={{ color: '#7b8499' }}>
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

  const critical = alerts.filter((a) => a.severity === 'critical').length + 4;
  const warning = alerts.filter((a) => a.severity === 'warning').length + 9;
  const info = alerts.filter((a) => a.severity === 'info').length + 11;
  const total = critical + warning + info;

  const bars: { label: string; count: number; color: string }[] = [
    { label: 'INFO', count: info, color: '#22d3ee' },
    { label: 'WARNING', count: warning, color: '#fbbf24' },
    { label: 'CRITICAL', count: critical, color: '#f87171' },
  ];
  const maxCount = Math.max(...bars.map((b) => b.count), 1);

  return (
    <Panel title="Events (24h)" eyebrow={`${total} TOTAL`}>
      <div className="flex items-end justify-around gap-4 md:gap-6" style={{ height: 140 }}>
        {bars.map((b) => (
          <div key={b.label} className="flex flex-col items-center gap-2 flex-1">
            <span className="text-xs font-mono font-semibold tabular-nums" style={{ color: b.color }}>{b.count}</span>
            <div className="w-full flex items-end justify-center" style={{ height: 88 }}>
              <div
                className="w-8 md:w-10 rounded-t-sm transition-all duration-700 ease-out"
                style={{
                  height: mounted ? `${(b.count / maxCount) * 100}%` : '0%',
                  background: `linear-gradient(180deg, ${b.color}, ${b.color}66)`,
                  boxShadow: `0 0 10px ${b.color}66`,
                }}
              />
            </div>
            <span className="text-[10px] font-mono tracking-wide" style={{ color: '#7b8499' }}>{b.label}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// --- Timeline & Analytics screen root -----------------------------------------

function TimelineAnalyticsScreen() {
  const { missions, spacecraft, alerts, selectedMissionId } = useSimulation();
  const focusedMission = missions.find((m) => m.id === selectedMissionId) ?? missions[0];

  return (
    <div className="flex flex-col gap-4">
      <MissionPhaseTimelinePanel mission={focusedMission} />
      <OperationalStatsRow spacecraft={spacecraft} />
      <MissionProgressComparisonPanel missions={missions} selectedMissionId={selectedMissionId} />
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

// --- Comms & System Health screen root ----------------------------------------

function CommsHealthScreen() {
  const { spacecraft, missions, selectedMissionId } = useSimulation();
  const selectedMission = missions.find((m) => m.id === selectedMissionId) ?? missions[0];
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

// --- Route transition wrapper -------------------------------------------------
// Keys a small fade+slide animation off the active nav key so switching
// screens feels intentional rather than an instant hard cut. Pure CSS
// keyframes (re-triggered via a `key` prop change) - no animation library.
function RouteTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  return (
    <div key={routeKey} style={{ animation: 'aegis-route-in 320ms cubic-bezier(0.16, 1, 0.3, 1)' }}>
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
// Small reinforcing detail: mission-control call-sign, build/version tag, and
// a live "SYSTEM NOMINAL" strip that reflects the real alert state rather
// than being purely decorative.
function StatusStrip() {
  const { alerts } = useSimulation();
  const criticalCount = alerts.filter((a) => !a.resolved && a.severity === 'critical').length;
  const nominal = criticalCount === 0;
  const color = nominal ? '#4ade80' : '#f87171';

  return (
    <footer
      className="hidden md:flex items-center justify-between px-4 md:px-6 h-8 shrink-0 border-t text-[10px] font-mono tracking-wider"
      style={{ background: '#080b13', borderColor: '#1a2138', color: '#7b8499' }}
    >
      <span>AEGIS-CTRL · CALLSIGN "SENTINEL-1"</span>
      <span className="flex items-center gap-1.5" style={{ color }}>
        <span className="relative flex h-1.5 w-1.5">
          {!nominal && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: color }} />
          )}
          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: color }} />
        </span>
        {nominal ? 'SYSTEM NOMINAL' : `${criticalCount} CRITICAL ALERT${criticalCount > 1 ? 'S' : ''}`}
      </span>
      <span>BUILD 2026.07.25 · v1.0.0</span>
    </footer>
  );
}

// --- Root shell --------------------------------------------------------------

function AppShell() {
  const [active, setActive] = useState<NavKey>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeLabel = NAV_ITEMS.find((n) => n.key === active)?.label ?? '';

  return (
    <div
      className="w-full h-screen flex overflow-hidden relative"
      style={{
        background: '#05070d',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* subtle grid/scanline texture */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, transparent 1px, transparent 2px)',
        }}
      />

      <Sidebar
        active={active}
        onNavigate={setActive}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <TopBar onOpenMobileMenu={() => setMobileOpen(true)} activeLabel={activeLabel} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <RouteTransition routeKey={active}>
            {active === 'overview' && <OverviewPlaceholder />}
            {active === 'telemetry' && <TelemetryScreen />}
            {active === 'comms' && <CommsHealthScreen />}
            {active === 'timeline' && <TimelineAnalyticsScreen />}
            {active === 'settings' && <GenericPlaceholder label="Settings" />}
          </RouteTransition>
        </main>
        <StatusStrip />
      </div>
    </div>
  );
}

// ============================================================================
// SECTION 9: BOOT SEQUENCE
// ----------------------------------------------------------------------------
// A short, skippable HUD-style "system initializing" sequence shown once on
// first load, before the dashboard mounts. Purely a perceived-polish detail -
// it does not gate any real data loading (everything is client-side/instant),
// it just gives the app a moment of theatrical "coming online."
// ============================================================================

const BOOT_LINES = [
  'INITIALIZING AEGIS MISSION CONTROL...',
  'ESTABLISHING UPLINK...',
  'CALIBRATING TELEMETRY FEEDS...',
  'LOADING MISSION DATABASE...',
  'SYSTEMS NOMINAL.',
];

function BootSequence({ onDone }: { onDone: () => void }) {
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
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') onDone();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onDone]);

  const progressPct = Math.min(100, Math.round((lineIdx / BOOT_LINES.length) * 100));

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDone}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer"
      style={{ background: '#05070d', fontFamily: "'Inter', system-ui, sans-serif" }}
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
        <span style={{ color: '#22d3ee' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" width="40" height="40">
            <path d="M12 2 3 6v6c0 5 3.8 8.7 9 10 5.2-1.3 9-5 9-10V6l-9-4Z" strokeLinejoin="round" />
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span
          className="font-bold tracking-[0.3em] text-2xl mt-2"
          style={{ color: '#e5e7eb', fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
        >
          AEGIS
        </span>
        <span className="text-[10px] font-mono tracking-[0.25em]" style={{ color: '#7b8499' }}>
          MISSION CONTROL SYSTEM
        </span>
      </div>

      <div className="w-64 sm:w-80 flex flex-col gap-2">
        {BOOT_LINES.slice(0, lineIdx).map((line, i) => (
          <div
            key={line}
            className="text-[11px] font-mono flex items-center gap-2"
            style={{
              color: i === lineIdx - 1 && i === BOOT_LINES.length - 1 ? '#4ade80' : '#8b93a7',
              animation: 'aegis-boot-line-in 220ms ease-out',
            }}
          >
            <span style={{ color: i === BOOT_LINES.length - 1 ? '#4ade80' : '#22d3ee' }}>
              {i === BOOT_LINES.length - 1 ? '✓' : '›'}
            </span>
            {line}
          </div>
        ))}

        <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: '#1a2138' }}>
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #22d3ee, #4ade80)',
              boxShadow: '0 0 8px rgba(34,211,238,0.6)',
            }}
          />
        </div>
      </div>

      {skipHint && (
        <span
          className="mt-8 text-[10px] font-mono tracking-wide"
          style={{ color: '#7b8499', animation: 'aegis-boot-line-in 300ms ease-out' }}
        >
          PRESS ANY KEY OR CLICK TO SKIP
        </span>
      )}
    </div>
  );
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return (
    <SimulationProvider>
      {!booted && !prefersReducedMotion && <BootSequence onDone={() => setBooted(true)} />}
      {(booted || prefersReducedMotion) && <AppShell />}
    </SimulationProvider>
  );
}
