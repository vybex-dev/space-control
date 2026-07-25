export type MissionStatus = "active" | "completed" | "planned" | "warning";

export interface Mission {
  id: string;
  name: string;
  status: MissionStatus;
  progress: number; // 0-100
  phase: string; // human-readable current phase label
  crew: number; // crew count (0 for uncrewed/payload-only)
  payload: string; // short payload description
  launchDate: string; // ISO date string
}

export type SubsystemKey =
  | "power"
  | "thermal"
  | "comms"
  | "propulsion"
  | "navigation";

export interface Subsystem {
  key: SubsystemKey;
  label: string;
  health: number; // 0-100
  status: "nominal" | "warning" | "critical";
}

export interface Spacecraft {
  id: string;
  missionId: string;
  name: string;
  altitude: number; // km
  velocity: number; // km/s
  latitude: number; // degrees
  longitude: number; // degrees
  signalStrength: number; // dBm (negative, closer to 0 = stronger)
  powerLevel: number; // %
  fuelLevel: number; // %
  onboardTemp: number; // °C
  systemHealth: number; // % aggregate
  subsystems: Subsystem[];
  // Rolling history for sparklines - last N ticks
  history: {
    altitude: number[];
    velocity: number[];
    power: number[];
  };
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: string;
  missionId: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string; // ISO datetime
  resolved: boolean;
  subsystem?: SubsystemKey; // optional tag - which subsystem raised this, if any
  acknowledged?: boolean; // client-side operator ack, set via ACKNOWLEDGE_ALERT
}

export type PhaseStatus = "completed" | "current" | "upcoming";

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
