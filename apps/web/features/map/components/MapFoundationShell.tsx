"use client";

import { useState } from "react";

import { appEnv, toRuntimeMapProvider } from "@/config/env";
import { NullMapAdapter } from "@/features/map/adapters/NullMapAdapter";
import { MapFoundationCanvas } from "@/features/map/components/MapFoundationCanvas";
import { MapController } from "@/features/map/core/MapController";
import type { MapInitOptions } from "@/features/map/core/MapTypes";
import { layerRegistryList } from "@/features/map/registry/layerRegistry";
import { resolveLayerLabel } from "@/features/map/registry/layerResolvers";

const createDefaultOptions = (): MapInitOptions => ({
  provider: toRuntimeMapProvider(appEnv.map.provider),
  interactive: false,
  center: [appEnv.map.defaultCenter.lng, appEnv.map.defaultCenter.lat],
  zoom: appEnv.map.defaultZoom
});

type MapFoundationShellProps = {
  title?: string;
  description?: string;
};

export function MapFoundationShell({
  title = "Map foundation preview",
  description = "Phase 1 keeps product logic outside any specific provider SDK and proves adapter wiring with a safe null renderer."
}: MapFoundationShellProps) {
  const [controller] = useState(() => new MapController(new NullMapAdapter()));
  const [options] = useState(createDefaultOptions);

  return (
    <section className="map-foundation-shell">
      <div className="map-foundation-copy">
        <p className="eyebrow">Phase 1 foundation</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="map-foundation-stage">
        <MapFoundationCanvas controller={controller} options={options} />

        <aside className="map-foundation-panel">
          <div className="map-foundation-panel-block">
            <span>Adapter</span>
            <strong>{options.provider}</strong>
            <p>Current preview uses `NullMapAdapter`. Future providers swap in behind same contract.</p>
          </div>

          <div className="map-foundation-panel-block">
            <span>Viewport seed</span>
            <strong>
              {options.center[1].toFixed(4)}, {options.center[0].toFixed(4)}
            </strong>
            <p>Zoom {options.zoom}</p>
          </div>

          <div className="map-foundation-panel-block">
            <span>Layer registry</span>
            <ul className="map-foundation-layer-list">
              {layerRegistryList.map((layer) => (
                <li key={layer.id}>
                  <strong>{layer.id}</strong>
                  <span>
                    {resolveLayerLabel(layer) ?? layer.label.toString()} · {layer.geometryType} ·{" "}
                    {layer.visibleByDefault ? "visible" : "hidden"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
