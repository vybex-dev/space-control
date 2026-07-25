import { Mission, Spacecraft, Alert, TimelinePhase, Subsystem, SubsystemKey } from "../types";

export const HISTORY_LENGTH = 20;

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

function makeSubsystems(
  overrides?: Partial<Record<SubsystemKey, number>>,
): Subsystem[] {
  const defs: { key: SubsystemKey; label: string }[] = [
    { key: "power", label: "Power" },
    { key: "thermal", label: "Thermal" },
    { key: "comms", label: "Comms" },
    { key: "propulsion", label: "Propulsion" },
    { key: "navigation", label: "Navigation" },
  ];
  return defs.map((d) => {
    const health = overrides?.[d.key] ?? 95 + Math.round(Math.random() * 5);
    const status: Subsystem["status"] =
      health >= 90 ? "nominal" : health >= 70 ? "warning" : "critical";
    return { ...d, health, status };
  });
}

export const SEED_MISSIONS: Mission[] = [
  {
    id: "m-01",
    name: "ARTEMIS RELAY",
    status: "active",
    progress: 78,
    phase: "Orbit Insertion",
    crew: 0,
    payload: "Lunar comms relay satellite",
    launchDate: "2026-02-11",
  },
  {
    id: "m-02",
    name: "HELIOS WATCH",
    status: "active",
    progress: 64,
    phase: "Payload Ops",
    crew: 0,
    payload: "Solar weather monitoring array",
    launchDate: "2026-03-02",
  },
  {
    id: "m-03",
    name: "ORION CREWED-7",
    status: "warning",
    progress: 55,
    phase: "System Check",
    crew: 4,
    payload: "Crew transport + ISS resupply",
    launchDate: "2026-04-18",
  },
  {
    id: "m-04",
    name: "TITAN SURVEYOR",
    status: "active",
    progress: 91,
    phase: "Data Downlink",
    crew: 0,
    payload: "Deep-space imaging probe",
    launchDate: "2025-11-30",
  },
  {
    id: "m-05",
    name: "POLARIS-2",
    status: "active",
    progress: 47,
    phase: "Orbit Insertion",
    crew: 0,
    payload: "Polar ice observation satellite",
    launchDate: "2026-05-09",
  },
  {
    id: "m-06",
    name: "VANGUARD CARGO",
    status: "active",
    progress: 88,
    phase: "Payload Ops",
    crew: 0,
    payload: "Automated cargo resupply",
    launchDate: "2026-01-22",
  },
  {
    id: "m-07",
    name: "AEGIS-X TEST",
    status: "active",
    progress: 33,
    phase: "Launch",
    crew: 0,
    payload: "Next-gen propulsion testbed",
    launchDate: "2026-06-30",
  },
  {
    id: "m-08",
    name: "MERIDIAN-1",
    status: "completed",
    progress: 100,
    phase: "Mission End",
    crew: 0,
    payload: "Earth observation constellation node",
    launchDate: "2025-08-14",
  },
];

export const SEED_SPACECRAFT: Spacecraft[] = [
  {
    id: "sc-01",
    missionId: "m-01",
    name: "SAT-01",
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
    id: "sc-02",
    missionId: "m-02",
    name: "SAT-02",
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
    id: "sc-03",
    missionId: "m-03",
    name: "ORION-7",
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
    id: "sc-04",
    missionId: "m-04",
    name: "SAT-03",
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
    id: "sc-05",
    missionId: "m-05",
    name: "POLARIS-2A",
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
    id: "sc-06",
    missionId: "m-06",
    name: "CARGO-V6",
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
    id: "sc-07",
    missionId: "m-07",
    name: "AEGIS-X1",
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
    id: "al-01",
    missionId: "m-03",
    severity: "critical",
    message: "Propulsion subsystem health below threshold (62%)",
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    resolved: false,
    subsystem: "propulsion",
    acknowledged: false,
  },
  {
    id: "al-02",
    missionId: "m-03",
    severity: "warning",
    message: "Thermal regulation drift detected on ORION-7",
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    resolved: false,
    subsystem: "thermal",
    acknowledged: false,
  },
  {
    id: "al-03",
    missionId: "m-04",
    severity: "info",
    message: "Data downlink window opened for TITAN SURVEYOR",
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    resolved: true,
    subsystem: "comms",
    acknowledged: true,
  },
  {
    id: "al-04",
    missionId: "m-01",
    severity: "info",
    message: "Uplink handshake completed on ARTEMIS RELAY",
    timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    resolved: true,
    subsystem: "comms",
    acknowledged: false,
  },
  {
    id: "al-05",
    missionId: "m-06",
    severity: "warning",
    message: "Fuel reserve trending below planned burn margin",
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    resolved: false,
    subsystem: "propulsion",
    acknowledged: false,
  },
];

export const SEED_TIMELINES: Record<string, TimelinePhase[]> = {
  "m-01": [
    { label: "Launch", timeOffset: "T-0", status: "completed" },
    { label: "Orbit Insertion", timeOffset: "T+00:15", status: "current" },
    { label: "System Check", timeOffset: "T+02:30", status: "upcoming" },
    { label: "Payload Ops", timeOffset: "T+05:40", status: "upcoming" },
    { label: "Data Downlink", timeOffset: "T+08:10", status: "upcoming" },
    { label: "Mission End", timeOffset: "T+12:00", status: "upcoming" },
  ],
};
