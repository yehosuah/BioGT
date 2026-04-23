"use client";

import { MapExplorer } from "@/components/map-explorer";
import { MapErrorBoundary } from "@/features/map/components/MapErrorBoundary";

type MapShellProps = {
  className?: string;
};

export function MapShell({ className }: MapShellProps) {
  return (
    <MapErrorBoundary>
      <section className={className ?? "atlas-map-shell-root"} data-testid="map-shell">
        <MapExplorer />
      </section>
    </MapErrorBoundary>
  );
}
