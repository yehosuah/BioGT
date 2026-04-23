"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType
} from "react";

import { getMapMetricTime, trackMapMetric } from "@/features/map/performance/mapMetrics";
import type { MapCanvasMarker } from "@/features/map/components/MapLibreDeckCanvas";

type MapLibreDeckCanvasComponent = typeof import("./MapLibreDeckCanvas").MapLibreDeckCanvas;
type LazyMapLibreDeckCanvasProps = ComponentProps<MapLibreDeckCanvasComponent>;

function MapCanvasLoadingPlaceholder() {
  return (
    <div aria-busy="true" aria-live="polite" className="atlas-map-loading-shell">
      <div className="atlas-map-loading-grid" />
      <div className="atlas-map-loading-copy">
        <strong>Cargando proveedor del mapa…</strong>
        <span>Base primero. Capas opcionales después.</span>
      </div>
    </div>
  );
}

export type { MapCanvasMarker };

export function LazyMapLibreDeckCanvas(props: LazyMapLibreDeckCanvasProps) {
  const [LoadedComponent, setLoadedComponent] = useState<ComponentType<LazyMapLibreDeckCanvasProps> | null>(
    null
  );
  const importStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    importStartedAtRef.current = getMapMetricTime();
    trackMapMetric("map_provider_load_start", {
      provider: props.options.provider
    });

    void import("./MapLibreDeckCanvas")
      .then((module) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setLoadedComponent(() => module.MapLibreDeckCanvas);
        });
        trackMapMetric("map_provider_load_end", {
          provider: props.options.provider,
          durationMs: getMapMetricTime() - (importStartedAtRef.current ?? getMapMetricTime())
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        props.onError?.(error instanceof Error ? error : new Error(String(error)));
      });

    return () => {
      cancelled = true;
    };
  }, [props.options.provider]);

  if (!LoadedComponent) {
    return <MapCanvasLoadingPlaceholder />;
  }

  return <LoadedComponent {...props} />;
}
