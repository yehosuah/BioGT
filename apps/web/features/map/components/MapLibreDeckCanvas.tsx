"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { MapboxOverlay } from "@deck.gl/mapbox";
import type { DeckGLProps } from "@deck.gl/react";
import { useControl } from "react-map-gl/maplibre";
import Map, { Marker, type MapRef } from "react-map-gl/maplibre";
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode
} from "react";

import { MapLibreDeckAdapter } from "@/features/map/adapters/MapLibreDeckAdapter";
import type { MapController } from "@/features/map/core/MapController";
import type { Coordinate, MapFeature, MapInitOptions, MapViewport } from "@/features/map/core/MapTypes";
import { createMapBounds } from "@/features/map/core/mapGeometry";
import { createThrottledCallback } from "@/features/map/performance/eventRate";

function DeckGLOverlay(props: DeckGLProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

export type MapCanvasMarker = {
  id: string;
  coordinate: Coordinate;
  content: ReactNode;
};

type MapLibreDeckCanvasProps = {
  controller: MapController;
  adapter: MapLibreDeckAdapter;
  options: MapInitOptions;
  mapStyleUrl: string;
  markers?: MapCanvasMarker[];
  renderVersion?: string | number;
  onReady?: () => void;
  onMapLoaded?: () => void;
  onError?: (error: Error) => void;
  onMove?: (viewport: MapViewport) => void;
  onMoveEnd?: (viewport: MapViewport) => void;
  onFeatureHover?: (feature: MapFeature | null, layerId?: string | null) => void;
  getTooltipText?: (feature: MapFeature, layerId?: string | null) => string | null;
  children?: ReactNode;
};

const toViewport = (
  event: {
    viewState: {
      longitude: number;
      latitude: number;
      zoom: number;
      bearing?: number;
      pitch?: number;
    };
    target?: {
      getBounds?: () => {
        getWest: () => number;
        getSouth: () => number;
        getEast: () => number;
        getNorth: () => number;
      };
    };
  }
): MapViewport => {
  const bounds =
    typeof event.target?.getBounds === "function"
      ? event.target.getBounds()
      : undefined;

  return {
    center: [event.viewState.longitude, event.viewState.latitude],
    zoom: event.viewState.zoom,
    bearing: event.viewState.bearing,
    pitch: event.viewState.pitch,
    bounds: bounds
      ? createMapBounds(bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth())
      : undefined
  };
};

export function MapLibreDeckCanvas({
  controller,
  adapter,
  options,
  mapStyleUrl,
  markers = [],
  renderVersion,
  onReady,
  onMapLoaded,
  onError,
  onMove,
  onMoveEnd,
  onFeatureHover,
  getTooltipText,
  children
}: MapLibreDeckCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapRef | null>(null);
  const [initialized, setInitialized] = useState(false);
  const adapterVersion = useSyncExternalStore(
    (listener) => adapter.subscribe(listener),
    () => adapter.getVersion(),
    () => adapter.getVersion()
  );
  const throttledMoveRef = useRef(
    createThrottledCallback((viewport: MapViewport, originalEvent?: unknown) => {
      adapter.handleViewportChange(viewport, originalEvent);
      onMove?.(viewport);
    }, 120)
  );
  const throttledMoveEndRef = useRef(
    createThrottledCallback((viewport: MapViewport, originalEvent?: unknown) => {
      adapter.handleViewportChange(viewport, originalEvent);
      onMoveEnd?.(viewport);
    }, 180)
  );
  const emitReady = useEffectEvent(() => {
    onReady?.();
  });
  const emitError = useEffectEvent((error: Error) => {
    onError?.(error);
  });
  const emitMoveEnd = useEffectEvent((viewport: MapViewport) => {
    onMoveEnd?.(viewport);
  });
  const emitFeatureHover = useEffectEvent((feature: MapFeature | null, layerId?: string | null) => {
    onFeatureHover?.(feature, layerId);
  });

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    let cancelled = false;

    void controller
      .initialize(containerRef.current, options)
      .then(() => {
        if (!cancelled) {
          setInitialized(true);
          emitReady();
        }
      })
      .catch((error) => {
        if (!cancelled) {
          emitError(error instanceof Error ? error : new Error(String(error)));
        }
      });

    return () => {
      cancelled = true;
      controller.destroy();
    };
  }, [controller, options]);

  useEffect(() => {
    return () => {
      throttledMoveRef.current.cancel();
      throttledMoveEndRef.current.cancel();
    };
  }, []);

  useEffect(() => {
    if (!initialized || !mapRef.current) {
      return;
    }

    adapter.attachMap(mapRef.current);
    const map = mapRef.current;
    const bounds = map.getBounds?.();
    const nextViewport: MapViewport = {
      center: [map.getCenter().lng, map.getCenter().lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      bounds: bounds
        ? createMapBounds(bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth())
        : undefined
    };
    adapter.handleViewportChange(nextViewport);
    emitMoveEnd(nextViewport);

    return () => {
      adapter.detachMap();
    };
  }, [adapter, emitMoveEnd, initialized]);

  const deckLayers = useMemo(
    () => adapter.getDeckLayers(),
    [adapter, adapterVersion, renderVersion]
  );

  return (
    <div className="atlas-map-shell" data-testid="map-canvas" ref={containerRef}>
      <Map
        initialViewState={{
          longitude: options.center[0],
          latitude: options.center[1],
          zoom: options.zoom
        }}
        interactive={options.interactive}
        mapStyle={mapStyleUrl}
        maxZoom={options.maxZoom}
        minZoom={options.minZoom}
        onClick={(event) => adapter.handleMapClick(event)}
        onError={(event) => {
          const candidate =
            event && typeof event === "object" && "error" in event
              ? (event as { error?: unknown }).error
              : undefined;
          onError?.(
            candidate instanceof Error ? candidate : new Error("Map provider or style failed to load.")
          );
        }}
        onLoad={() => onMapLoaded?.()}
        onMove={(event) => {
          const viewport = toViewport(event);
          throttledMoveRef.current(viewport, event);
        }}
        onMoveEnd={(event) => {
          const viewport = toViewport(event);
          throttledMoveEndRef.current(viewport, event);
        }}
        ref={mapRef}
      >
        <DeckGLOverlay
          getTooltip={({ layer, object }) => {
            const feature = object as MapFeature | undefined;
            if (!feature || !getTooltipText) {
              return null;
            }

            const text = getTooltipText(feature, String(layer?.id ?? ""));
            return text ? { text } : null;
          }}
          layers={deckLayers}
          onClick={(info) => {
            adapter.handleDeckClick(info);
          }}
          onHover={(info) => {
            adapter.handleDeckHover(info);
            const { layer, object } = info;
            emitFeatureHover((object as MapFeature | undefined) ?? null, String(layer?.id ?? ""));
          }}
        />

        {markers.map((marker) => (
          <Marker
            anchor="bottom"
            key={marker.id}
            latitude={marker.coordinate[1]}
            longitude={marker.coordinate[0]}
          >
            {marker.content}
          </Marker>
        ))}
      </Map>
      {children}
    </div>
  );
}
