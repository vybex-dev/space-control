import React, { useState } from "react";
import { SimulationProvider } from "./context/SimulationContext";
import { BootSequence } from "./components/BootSequence";
import { AppShell } from "./components/AppShell";

export default function App() {
  const [booted, setBooted] = useState(false);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <SimulationProvider>
      <AppShell />
      {!booted && !prefersReducedMotion && (
        <BootSequence onDone={() => setBooted(true)} />
      )}
    </SimulationProvider>
  );
}
