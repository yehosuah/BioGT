"use client";

import { useEffect, useRef } from "react";

import type { MapController } from "@/features/map/core/MapController";
import type { MapInitOptions } from "@/features/map/core/MapTypes";

type MapFoundationCanvasProps = {
  controller: MapController;
  options: MapInitOptions;
};

export function MapFoundationCanvas({ controller, options }: MapFoundationCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    void controller.initialize(containerRef.current, options);

    return () => {
      controller.destroy();
    };
  }, [controller, options]);

  return (
    <div className="map-foundation-canvas-shell">
      <div
        aria-label="Map foundation canvas placeholder"
        className="map-foundation-canvas"
        ref={containerRef}
      />
      <div aria-live="polite" className="map-foundation-overlay">
        Map system initialized.
      </div>
    </div>
  );
}
