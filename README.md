# 🚀 AEGIS - Space Mission Control SaaS Platform

> **Frontend Wars 2026 Submission** | Modern, responsive, client-side Space Mission Control platform designed for real-time spacecraft telemetry monitoring, operational analytics, communication health tracking, and mission management.

---

## 📌 Project Overview

**AEGIS** is a next-generation Space Mission Control SaaS platform built for mission operators and flight controllers. It delivers real-time situational awareness by aggregating spacecraft telemetry, orbital trajectories, communication subsystem health, and mission phase timelines into an interactive, high-density dashboard.

All data stream simulation, telemetry calculations, orbital tracking, and timeline controls run **100% client-side** in the browser with zero backend or external database dependencies.

---

## 🛠️ Mandatory Technology Stack

This project strictly adheres to all technology rules specified in the competition rulebook:

- ⚡ **Vite** — High-performance frontend tooling & bundler
- ⚛️ **React 18** — Component-driven UI architecture
- 📘 **TypeScript** — End-to-end static type safety
- 🎨 **Tailwind CSS** — Utility-first, responsive design system

---

## ✨ Key Features & Problem Statement Requirements

### 1. 📊 Mission Status Overview (`OverviewDashboard`)

- Real-time KPI summaries for total active, nominal, warning, critical, and completed missions.
- Global telemetry snapshot (altitude, velocity, system health, power flux).
- Live alert feed with severity filters (Critical, Warning, Info) and manual alert resolution.
- Dynamic sparklines showing real-time trends.

### 2. 📡 Spacecraft Telemetry Visualization (`TelemetryScreen`)

- Real-time track of orbital parameters: **Altitude (408.7 km)**, **Velocity (7.67 km/s)**, **Position (28.5° N, 80.6° E)**, **Signal Strength (-120 dBm)**.
- Dual-mode visualization:
  - **2D World Map Ground Track** with animated satellite orbital paths.
  - **Interactive 3D Globe View** built with WebGL / HTML5 canvas.
- Telemetry history graphs with live streaming updates.

### 3. 📶 Communication & System Health (`CommsHealthScreen`)

- Live Downlink/Uplink status indicators with lock toggles and latency monitoring.
- Subsystem health diagnostics: **Power (98%)**, **Thermal (22.6 °C)**, Comms, Propulsion, Navigation.
- Interactive telemetry override controls (Simulate Signal Drop, Trigger Thermal Spike, Reset Subsystems).

### 4. ⏱️ Mission Timeline & Operational Analytics (`TimelineAnalyticsScreen`)

- Interactive mission phase scrubber tracking key milestones: _Launch → Orbit Insertion → System Check → Payload Ops → Data Downlink → Mission End_.
- Operational metrics breakdown: **Power Load (2.34 kW)**, **Data Usage (1.28 TB)**, **24h Events Count (24)**.
- Step-forward phase simulator and interactive mission phase controls.

### 5. 🎛️ Simulation Controls & Settings (`SettingsScreen`)

- Real-time simulation tick rate control (Pause, 1x, 2x, 5x speed).
- Mock data generator with configurable drift parameters.
- Dark theme mission control visual styling.

---

## 🚀 Getting Started Locally

### Prerequisites

- Node.js (v18.0 or higher)
- npm or yarn

### Installation & Execution

1. **Clone the repository:**

   ```bash
   git clone https://github.com/vybex-dev/space-control.git
   cd aegis-app
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**

   ```bash
   npm run dev
   ```

   Open `http://localhost:5173` in your browser.

4. **Build for production:**

   ```bash
   npm run build
   ```

5. **Preview production build:**
   ```bash
   npm run preview
   ```

---

## 🔒 Compliance & Non-Disqualification Audit

- ✅ **Client-side Execution**: Runs entirely in the browser. Zero backend, SSR, database, cloud function, or external dynamic API calls.
- ✅ **Tech Stack Strictness**: Exclusively built using React, TypeScript, Vite, and Tailwind CSS.
- ✅ **No Pre-built Templates**: Custom-architected component structure and styling.
- ✅ **Type Safety & Build Cleanliness**: 0 TypeScript compilation errors (`tsc -b` passes cleanly).

---

## 📄 License

Created for Frontend Wars 2026. All rights reserved.
