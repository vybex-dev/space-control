import React, { useState } from "react";
import { Panel } from "./Panel";

export function SettingsScreen() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("aegis_theme") || "cyan",
  );
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("aegis_sound") !== "false",
  );
  const [logRefreshRate, setLogRefreshRate] = useState(
    () => localStorage.getItem("aegis_refresh_rate") || "2.5s",
  );
  const [alertSeverityFilter, setAlertSeverityFilter] = useState(
    () => localStorage.getItem("aegis_alert_filter") || "all",
  );
  const [showOrbitPaths, setShowOrbitPaths] = useState(
    () => localStorage.getItem("aegis_orbit_paths") !== "false",
  );

  const saveSetting = (key: string, value: string | boolean) => {
    localStorage.setItem(key, String(value));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      <Panel title="System Configuration" eyebrow="AEGIS CONFIG V1.0" glow>
        <div className="space-y-6 my-2">
          {/* Theme Selector */}
          <div className="flex flex-col gap-2">
            <label
              className="text-xs font-mono text-left"
              style={{ color: "#cbd5e1" }}
            >
              HUD INTERFACE THEME
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "cyan", label: "CYBERPUNK CYAN", color: "#22d3ee" },
                { id: "gold", label: "SOLAR GOLD", color: "#fbbf24" },
                { id: "crimson", label: "CRIMSON ALERT", color: "#f87171" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTheme(t.id);
                    saveSetting("aegis_theme", t.id);
                  }}
                  className="px-3 py-2 rounded-sm border font-mono text-[10px] text-center transition-colors cursor-pointer"
                  style={{
                    borderColor: theme === t.id ? t.color : "#1a2138",
                    background: theme === t.id ? `${t.color}15` : "#0d1220",
                    color: theme === t.id ? t.color : "#cbd5e1",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Telemetry Cadence */}
          <div
            className="flex items-center justify-between py-2 border-b"
            style={{ borderColor: "#1a2138" }}
          >
            <div className="flex flex-col text-left">
              <span
                className="text-xs font-semibold"
                style={{ color: "#e5e7eb" }}
              >
                Telemetry Update Interval
              </span>
              <span
                className="text-[10px] font-mono"
                style={{ color: "#94a3b8" }}
              >
                Controls satellite telemetry update ticks
              </span>
            </div>
            <select
              value={logRefreshRate}
              onChange={(e) => {
                setLogRefreshRate(e.target.value);
                saveSetting("aegis_refresh_rate", e.target.value);
              }}
              className="bg-[#0a0e18] border font-mono text-xs rounded-sm p-1.5 focus:outline-none focus:border-[#22d3ee] cursor-pointer"
              style={{ borderColor: "#1a2138", color: "#e5e7eb" }}
              aria-label="Telemetry update interval"
            >
              <option value="1s">1.0s (Fast)</option>
              <option value="2.5s">2.5s (Standard)</option>
              <option value="5s">5.0s (Power Saver)</option>
            </select>
          </div>

          {/* Alert Level Filter */}
          <div
            className="flex items-center justify-between py-2 border-b"
            style={{ borderColor: "#1a2138" }}
          >
            <div className="flex flex-col text-left">
              <span
                className="text-xs font-semibold"
                style={{ color: "#e5e7eb" }}
              >
                Default Alert Log Filter
              </span>
              <span
                className="text-[10px] font-mono"
                style={{ color: "#94a3b8" }}
              >
                Minimum severity level to display
              </span>
            </div>
            <select
              value={alertSeverityFilter}
              onChange={(e) => {
                setAlertSeverityFilter(e.target.value);
                saveSetting("aegis_alert_filter", e.target.value);
              }}
              className="bg-[#0a0e18] border font-mono text-xs rounded-sm p-1.5 focus:outline-none focus:border-[#22d3ee] cursor-pointer"
              style={{ borderColor: "#1a2138", color: "#e5e7eb" }}
              aria-label="Default alert log filter"
            >
              <option value="all">ALL LEVELS</option>
              <option value="warning">WARNINGS & CRITICAL</option>
              <option value="critical">CRITICAL ONLY</option>
            </select>
          </div>

          {/* Sound toggle */}
          <div
            className="flex items-center justify-between py-2 border-b"
            style={{ borderColor: "#1a2138" }}
          >
            <div className="flex flex-col text-left">
              <span
                className="text-xs font-semibold"
                style={{ color: "#e5e7eb" }}
              >
                Audible Alarms
              </span>
              <span
                className="text-[10px] font-mono"
                style={{ color: "#94a3b8" }}
              >
                Play warning sound for critical telemetry drops
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                saveSetting("aegis_sound", !soundEnabled);
              }}
              className="px-3 py-1.5 rounded-sm font-mono text-xs border transition-colors w-24 cursor-pointer"
              style={{
                borderColor: soundEnabled ? "#22d3ee" : "#1a2138",
                background: soundEnabled
                  ? "rgba(34, 211, 238, 0.1)"
                  : "transparent",
                color: soundEnabled ? "#22d3ee" : "#cbd5e1",
              }}
            >
              {soundEnabled ? "ENABLED" : "MUTED"}
            </button>
          </div>

          {/* Show Orbit paths toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="flex flex-col text-left">
              <span
                className="text-xs font-semibold"
                style={{ color: "#e5e7eb" }}
              >
                Orbit Visualization Trails
              </span>
              <span
                className="text-[10px] font-mono"
                style={{ color: "#94a3b8" }}
              >
                Render active satellite orbital path projection lines
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowOrbitPaths(!showOrbitPaths);
                saveSetting("aegis_orbit_paths", !showOrbitPaths);
              }}
              className="px-3 py-1.5 rounded-sm font-mono text-xs border transition-colors w-24 cursor-pointer"
              style={{
                borderColor: showOrbitPaths ? "#22d3ee" : "#1a2138",
                background: showOrbitPaths
                  ? "rgba(34, 211, 238, 0.1)"
                  : "transparent",
                color: showOrbitPaths ? "#22d3ee" : "#cbd5e1",
              }}
            >
              {showOrbitPaths ? "VISIBLE" : "HIDDEN"}
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="System Diagnostics" eyebrow="HARDWARE STATUS">
        <div className="space-y-4 my-2 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span style={{ color: "#cbd5e1" }}>COSMIC RAY DAMPENING</span>
            <span className="text-[#4ade80]">99.8% nominal</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "#cbd5e1" }}>DOPPLER COMPENSATOR</span>
            <span className="text-[#4ade80]">Active (14.2 GHz)</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "#cbd5e1" }}>UP-LINK PACKET CACHE</span>
            <span style={{ color: "#e5e7eb" }}>0.012 MB / 16.0 MB</span>
          </div>
          <div
            className="h-2 rounded-sm overflow-hidden"
            style={{ background: "#1a2138" }}
          >
            <div className="h-full bg-[#22d3ee]" style={{ width: "2%" }} />
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "#cbd5e1" }}>CONNECTION ENCRYPTION</span>
            <span className="text-[#22d3ee]">SHA-256 AES-GCM</span>
          </div>

          <div className="pt-4 border-t border-[#1a2138] mt-4 text-left">
            <h4
              className="text-xs font-semibold mb-2"
              style={{ color: "#e5e7eb" }}
            >
              MISSION CONTROL DIRECTIVES
            </h4>
            <p
              className="text-[10px] leading-relaxed"
              style={{ color: "#94a3b8" }}
            >
              All command operations executed through this terminal are logged.
              Unauthorised telemetry spoofing violates space-fleet ordinance
              48-B.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
