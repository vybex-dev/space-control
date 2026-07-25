import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import {
  SimulationState,
  Spacecraft,
  Alert,
  Subsystem,
  SubsystemKey,
} from "../types";
import {
  SEED_MISSIONS,
  SEED_SPACECRAFT,
  SEED_ALERTS,
  SEED_TIMELINES,
  HISTORY_LENGTH,
} from "../constants/mockData";

type SimAction =
  | { type: "TICK" }
  | { type: "SELECT_MISSION"; missionId: string }
  | { type: "ACKNOWLEDGE_ALERT"; alertId: string };

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
  const altitude = Number(
    clamp(sc.altitude + (Math.random() - 0.5) * 1.0, 150, 2000).toFixed(2),
  );
  const velocity = Number(
    clamp(sc.velocity + (Math.random() - 0.5) * 0.02, 6.5, 8.0).toFixed(3),
  );
  const signalStrength = Math.round(
    clamp(sc.signalStrength + (Math.random() - 0.5) * 3, -160, -85),
  );
  // Power drains very slowly unless it's a solar-charged nominal craft, in which case it
  // hovers with tiny noise (simulating charge/discharge cycles).
  const powerDrift = (Math.random() - 0.52) * 0.6;
  const powerLevel = Number(
    clamp(sc.powerLevel + powerDrift, 0, 100).toFixed(1),
  );
  const fuelLevel = Number(
    clamp(sc.fuelLevel - Math.random() * 0.02, 0, 100).toFixed(2),
  );
  const onboardTemp = Number(
    clamp(sc.onboardTemp + (Math.random() - 0.5) * 0.4, -60, 60).toFixed(1),
  );

  // Subsystem health wobbles slightly; status recalculated from health.
  const subsystems = sc.subsystems.map((s) => {
    const health = Math.round(
      clamp(s.health + (Math.random() - 0.5) * 1.5, 0, 100),
    );
    const status: Subsystem["status"] =
      health >= 90 ? "nominal" : health >= 70 ? "warning" : "critical";
    return { ...s, health, status };
  });
  const systemHealth = Math.round(
    subsystems.reduce((sum, s) => sum + s.health, 0) / subsystems.length,
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
  { text: "Signal strength degraded below nominal range", subsystem: "comms" },
  { text: "Minor thermal fluctuation detected", subsystem: "thermal" },
  { text: "Telemetry packet loss above baseline", subsystem: "comms" },
  {
    text: "Attitude control micro-adjustment triggered",
    subsystem: "navigation",
  },
  { text: "Power bus voltage ripple detected", subsystem: "power" },
];

function simulationReducer(
  state: SimulationState,
  action: SimAction,
): SimulationState {
  switch (action.type) {
    case "TICK": {
      const spacecraft = state.spacecraft.map(jitterSpacecraft);

      let alerts = state.alerts;
      let newlyAddedAlertIds: string[] = [];

      // Low-probability: raise a new warning alert on a random active mission.
      if (Math.random() < 0.04) {
        const activeMissions = state.missions.filter(
          (m) => m.status === "active",
        );
        if (activeMissions.length > 0) {
          const target =
            activeMissions[Math.floor(Math.random() * activeMissions.length)];
          const msg =
            ALERT_MESSAGES_WARNING[
              Math.floor(Math.random() * ALERT_MESSAGES_WARNING.length)
            ];
          const newId = `al-${Date.now()}`;
          const newAlert: Alert = {
            id: newId,
            missionId: target.id,
            severity: "warning",
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
          (a) => !a.resolved && a.severity !== "critical",
        );
        if (unresolvedIdx !== -1) {
          alerts = alerts.map((a, i) =>
            i === unresolvedIdx ? { ...a, resolved: true } : a,
          );
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
    case "SELECT_MISSION": {
      return {
        ...state,
        selectedMissionId: action.missionId,
      };
    }
    case "ACKNOWLEDGE_ALERT": {
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          a.id === action.alertId ? { ...a, acknowledged: true } : a,
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

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(simulationReducer, initialState);

  useEffect(() => {
    // Telemetry perturbation tick - every 2.5s, per the brief's 2-3s cadence.
    const interval = setInterval(() => {
      dispatch({ type: "TICK" });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const selectMission = (missionId: string) =>
    dispatch({ type: "SELECT_MISSION", missionId });
  const acknowledgeAlert = (alertId: string) =>
    dispatch({ type: "ACKNOWLEDGE_ALERT", alertId });

  return (
    <SimulationContext.Provider
      value={{ state, selectMission, acknowledgeAlert }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

// Hook for consuming simulation state anywhere in the tree.
export function useSimulation(): SimulationState {
  const ctx = useContext(SimulationContext);
  if (!ctx)
    throw new Error("useSimulation must be used within SimulationProvider");
  return ctx.state;
}

// Hook for consuming the mission-selection dispatcher.
export function useMissionSelect(): (missionId: string) => void {
  const ctx = useContext(SimulationContext);
  if (!ctx)
    throw new Error("useMissionSelect must be used within SimulationProvider");
  return ctx.selectMission;
}

// Hook for consuming the alert-acknowledge dispatcher.
export function useAlertAcknowledge(): (alertId: string) => void {
  const ctx = useContext(SimulationContext);
  if (!ctx)
    throw new Error(
      "useAlertAcknowledge must be used within SimulationProvider",
    );
  return ctx.acknowledgeAlert;
}

// A separate 1s ticking clock, decoupled from the telemetry simulation
// interval so the top bar clock feels perfectly live regardless of the
// 2.5s telemetry cadence.
export function useLiveClock(): Date {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function formatUTC(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// Relative time formatter for the alerts feed ("2m ago", "just now"). Re-derived
// from the live clock rather than a static Date.now() so it keeps advancing.
export function relativeTime(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

// Generic "flash on change" hook: tracks a numeric value and returns true for
// a brief window whenever it changes, so consumers can apply a highlight
// flash class/style. Used across KPI cards and telemetry readouts.
export function useFlashOnChange(value: number, durationMs = 600): boolean {
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
