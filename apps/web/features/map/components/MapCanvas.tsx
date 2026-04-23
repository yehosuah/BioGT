"use client";

import type { ReactNode } from "react";

import { MapLibreAdapter } from "@/features/map/adapters/MapLibreAdapter";
import type { MapAdapter } from "@/features/map/core/MapAdapter";
import { LazyMapLibreDeckCanvas, type MapCanvasMarker } from "@/features/map/components/LazyMapLibreDeckCanvas";
import type { MapController } from "@/features/map/core/MapController";
import type { Coordinate, MapFeature, MapInitOptions, MapViewport } from "@/features/map/core/MapTypes";

type MapCanvasProps = {
  adapter: MapAdapter;
  controller: MapController;
  options: MapInitOptions;
  mapStyleUrl: string;
  markers?: MapCanvasMarker[];
  renderVersion?: string | number;
  loading?: boolean;
  errorMessage?: string | null;
  emptyMessage?: string | null;
  overlay?: ReactNode;
  children?: ReactNode;
  onReady?: () => void;
  onMapLoaded?: () => void;
  onError?: (error: Error) => void;
  onMove?: (viewport: MapViewport) => void;
  onMoveEnd?: (viewport: MapViewport) => void;
  onFeatureHover?: (feature: MapFeature | null, layerId?: string | null) => void;
  getTooltipText?: (feature: MapFeature, layerId?: string | null) => string | null;
};

export const DEFAULT_MAP_CENTER: Coordinate = [-90.25, 15.68];
export const DEFAULT_MAP_ZOOM = 6.25;

export type { MapCanvasMarker };

export function MapCanvas({
  adapter,
  controller,
  options,
  mapStyleUrl,
  markers = [],
  renderVersion,
  loading = false,
  errorMessage,
  emptyMessage,
  overlay,
  children,
  onReady,
  onMapLoaded,
  onError,
  onMove,
  onMoveEnd,
  onFeatureHover,
  getTooltipText
}: MapCanvasProps) {
  const provider = adapter.getProviderName();
  const overlayContent = overlay ?? children;

  return (
    <div className="atlas-map-stage" data-testid="map-canvas">
      {provider === "maplibre" ? (
        <LazyMapLibreDeckCanvas
          adapter={adapter as MapLibreAdapter}
          controller={controller}
          getTooltipText={getTooltipText}
          mapStyleUrl={mapStyleUrl}
          markers={markers}
          onFeatureHover={onFeatureHover}
          onMapLoaded={onMapLoaded}
          onMove={onMove}
          onMoveEnd={onMoveEnd}
          onError={onError}
          onReady={onReady}
          options={options}
          renderVersion={renderVersion}
        >
          {overlayContent}
        </LazyMapLibreDeckCanvas>
      ) : (
        <div
          aria-live="assertive"
          className="atlas-map-stage-banner atlas-map-stage-banner-error"
          data-testid="map-error"
        >
          Proveedor de mapa no disponible en esta compilación: {provider}
        </div>
      )}

      {loading ? (
        <div aria-live="polite" className="atlas-map-stage-banner" data-testid="map-loading">
          Cargando mapa…
        </div>
      ) : null}

      {errorMessage ? (
        <div
          aria-live="assertive"
          className="atlas-map-stage-banner atlas-map-stage-banner-error"
          data-testid="map-error"
        >
          {errorMessage}
        </div>
      ) : null}

      {!loading && !errorMessage && emptyMessage ? (
        <div
          aria-live="polite"
          className="atlas-map-stage-banner atlas-map-stage-banner-empty"
          data-testid="map-empty"
        >
          {emptyMessage}
        </div>
      ) : null}
    </div>
  );
}
