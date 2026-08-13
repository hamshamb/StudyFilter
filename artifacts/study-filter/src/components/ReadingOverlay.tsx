import React from "react";
import { useReadingMode } from "@/hooks/use-reading-mode";

/**
 * A fixed full-screen warm amber tint that sits above the page content
 * but below modals (z-50). pointer-events:none so it never blocks clicks.
 * Fades in/out smoothly when reading mode toggles.
 */
export function ReadingOverlay() {
  const { isActive } = useReadingMode();

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 45,
        pointerEvents: "none",
        background: "rgba(255, 140, 30, 0.11)",
        opacity: isActive ? 1 : 0,
        transition: "opacity 0.8s ease",
        mixBlendMode: "multiply",
      }}
    />
  );
}
