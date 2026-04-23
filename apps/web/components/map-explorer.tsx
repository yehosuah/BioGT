"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties
} from "react";

import { appEnv, getMissingPublicEnvVars, validateMapEnvironment } from "@/config/env";
import { MapSpeciesCard } from "@/components/map-species-card";
import { SourceBadge } from "@/components/source-badge";
import { createMapAdapter, resolveConfiguredMapProvider } from "@/features/map/adapters/createMapAdapter";
import { getIconForFeature } from "@/features/map/assets/iconRegistry";
import type { MapIconId, MapLegendItem } from "@/features/map/assets/iconTypes";
import { MapCanvas, type MapCanvasMarker } from "@/features/map/components/MapCanvas";
import { FeatureDetailPanel } from "@/features/map/components/FeatureDetailPanel";
import { FeaturePopup } from "@/features/map/components/FeaturePopup";
import { MapIcon } from "@/features/map/components/MapIcon";
import {
  MapOperationalBoundary,
  type MapOperationalFailure,
  type MapOperationalFailureKind
} from "@/features/map/components/MapOperationalBoundary";
import { MapControls } from "@/features/map/components/MapControls";
import { MapLayerToggle } from "@/features/map/components/MapLayerToggle";
import { MapLegend } from "@/features/map/components/MapLegend";
import { MapSearch } from "@/features/map/components/MapSearch";
import { MobileBottomSheet } from "@/features/map/components/MobileBottomSheet";
import { MapController } from "@/features/map/core/MapController";
import type {
  Coordinate,
  MapFeature,
  MapFeatureCollection as ControllerMapFeatureCollection
} from "@/features/map/core/MapTypes";
import type { NormalizedFeatureReference } from "@/features/map/core/interactionTypes";
import { clusterMarkers } from "@/features/map/performance/clusterStrategy";
import { getDatasetStrategy } from "@/features/map/performance/datasetStrategy";
import { createDebouncedCallback } from "@/features/map/performance/eventRate";
import { runLayerLoadQueue } from "@/features/map/performance/layerLoadQueue";
import { buildLayerLoadState, type MapLayerLoadState } from "@/features/map/performance/mapLoadingState";
import { createMapCacheKey, MapDataCache } from "@/features/map/performance/mapCache";
import { getMapMetricTime, trackMapMetric } from "@/features/map/performance/mapMetrics";
import { buildViewportCacheKey, formatViewportBounds, padBounds } from "@/features/map/performance/viewportScheduler";
import {
  createLayerVisibilityState,
  getLayerConfig,
  getRenderableGeoJsonLayers,
  getToggleableLayers,
  getVisibleLayers,
  layerRegistry,
  toMapLayerVisibility,
  type LayerVisibilityState
} from "@/features/map/registry/layerRegistry";
import {
  resolveLayerDescription,
  resolveLayerIcon,
  resolveLayerLabel,
  resolveLayerTooltip
} from "@/features/map/registry/layerResolvers";
import { resolveMapStyleByKey } from "@/features/map/styles/mapStyleResolvers";
import { validateFeatureCollectionForLayer } from "@/features/map/registry/layerValidation";
import { filtersToQueryString } from "@/lib/filters";
import type { MapFilters } from "@/lib/repository";
import type {
  MapFeatureCollection as AtlasMapFeatureCollection,
  MapMarkerMode,
  MapMarkerResponse,
  MapPanelResponse,
  MapScopeType,
  MapSpeciesMarker,
  MapSpeciesPanelResponse,
  MapSpeciesSort,
  MapSummaryResponse,
  MapViewMode,
  SearchResult,
  TaxonScope
} from "@/lib/types";
import { logger } from "@/observability/logger";
import { trackMapEvent } from "@/observability/mapTelemetry";

type SelectionState = {
  scopeType: MapScopeType;
  scopeId: string;
};

const defaultFilters: MapFilters = {
  viewMode: "coverage",
  taxonScope: "all",
  group: "all",
  sourceTier: "all",
  region: "all",
  elevationBand: "all",
  dateRange: "all",
  protectedOnly: false,
  taxonSlug: undefined
};

const scopeLabels: Record<MapScopeType, string> = {
  country: "País",
  department: "Departamento",
  protected_area: "Área protegida",
  public_hex: "Celda pública"
};

const emptyFeatureCollection: ControllerMapFeatureCollection = {
  type: "FeatureCollection",
  features: []
};

const mapClientCache = new MapDataCache<
  | MapSummaryResponse
  | AtlasMapFeatureCollection
  | MapPanelResponse
  | MapSpeciesPanelResponse
  | MapMarkerResponse
  | SearchResult[]
>();

const cacheTtlMs = {
  summary: 45_000,
  layer: 60_000,
  panel: 30_000,
  speciesPanel: 30_000,
  markers: 20_000,
  search: 15_000
};

const LARGE_DATASET_WARNING_THRESHOLD = 5_000;
const SLOW_LAYER_WARNING_MS = 2_000;

const fixtureMode = appEnv.map.fixtureMode;

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const buildMapFailure = (
  kind: MapOperationalFailureKind,
  options: Omit<MapOperationalFailure, "kind"> = {}
): MapOperationalFailure => ({
  kind,
  fatal: options.fatal ?? (kind !== "layer_load" && kind !== "geojson_fetch"),
  ...options
});

const classifyMapFailure = (
  error: unknown,
  options: Omit<MapOperationalFailure, "kind"> & {
    fallbackKind?: MapOperationalFailureKind;
  } = {}
): MapOperationalFailure => {
  const message = toErrorMessage(error);
  const normalized = message.toLowerCase();
  let kind = options.fallbackKind ?? "initialization";

  if (normalized.includes("style")) {
    kind = "style_load";
  } else if (normalized.includes("provider") || normalized.includes("import") || normalized.includes("module")) {
    kind = "provider_load";
  } else if (normalized.includes("container")) {
    kind = "container_unavailable";
  }

  return buildMapFailure(kind, {
    ...options,
    message
  });
};

const resolveFixtureUrl = (url: string) => {
  if (!fixtureMode) {
    return url;
  }

  const source = new URL(url, "http://localhost");
  const searchParams = source.searchParams;

  if (source.pathname === "/api/map/summary") {
    return "/map-test-fixtures/api/map-summary.json";
  }

  if (source.pathname.startsWith("/api/map/layers/")) {
    const layerId = source.pathname.split("/").pop();
    return `/map-test-fixtures/api/layers/${layerId}.json`;
  }

  if (source.pathname === "/api/map/panel") {
    const scopeType = searchParams.get("scopeType") ?? "country";
    return `/map-test-fixtures/api/panel-${scopeType}.json`;
  }

  if (source.pathname === "/api/map/species-panel") {
    return "/map-test-fixtures/api/species-panel.json";
  }

  if (source.pathname === "/api/map/markers") {
    return "/map-test-fixtures/api/markers.json";
  }

  if (source.pathname === "/api/search") {
    return "/map-test-fixtures/api/search.json";
  }

  return url;
};

async function fetchJson<TResponse>(url: string, signal?: AbortSignal): Promise<TResponse> {
  const response = await fetch(resolveFixtureUrl(url), signal ? { signal } : undefined);
  if (!response.ok) {
    throw new Error(`Map request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as TResponse;
}

async function fetchSummary(filters: MapFilters, signal?: AbortSignal) {
  const query = filtersToQueryString(filters);
  const url = `/api/map/summary${query ? `?${query}` : ""}`;
  return mapClientCache.getOrLoad(
    createMapCacheKey("summary", filters),
    () => fetchJson<MapSummaryResponse>(url, signal),
    {
      ttlMs: cacheTtlMs.summary
    }
  ) as Promise<MapSummaryResponse>;
}

async function fetchLayer(layer: string, filters: MapFilters, bbox?: string, signal?: AbortSignal) {
  const params = new URLSearchParams(filtersToQueryString(filters));
  if (bbox) {
    params.set("bbox", bbox);
  }

  const url = `/api/map/layers/${layer}${params.toString() ? `?${params.toString()}` : ""}`;
  return mapClientCache.getOrLoad(
    createMapCacheKey("layer", layer, filters, bbox),
    () => fetchJson<AtlasMapFeatureCollection>(url, signal),
    {
      ttlMs: cacheTtlMs.layer
    }
  ) as Promise<AtlasMapFeatureCollection>;
}

async function fetchPanel({
  filters,
  page,
  scope,
  sort,
  signal
}: {
  filters: MapFilters;
  page: number;
  scope: SelectionState;
  sort: MapSpeciesSort;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams(filtersToQueryString(filters));
  params.set("scopeType", scope.scopeType);
  params.set("scopeId", scope.scopeId);
  params.set("sort", sort);
  params.set("page", String(page));
  params.set("pageSize", "6");
  const url = `/api/map/panel?${params.toString()}`;
  return mapClientCache.getOrLoad(
    createMapCacheKey("panel", filters, page, scope, sort),
    () => fetchJson<MapPanelResponse>(url, signal),
    {
      ttlMs: cacheTtlMs.panel
    }
  ) as Promise<MapPanelResponse>;
}

async function fetchSpeciesPanel(filters: MapFilters, signal?: AbortSignal) {
  const params = new URLSearchParams(filtersToQueryString(filters));
  const url = `/api/map/species-panel?${params.toString()}`;
  return mapClientCache.getOrLoad(
    createMapCacheKey("species-panel", filters),
    () => fetchJson<MapSpeciesPanelResponse>(url, signal),
    {
      ttlMs: cacheTtlMs.speciesPanel
    }
  ) as Promise<MapSpeciesPanelResponse>;
}

async function fetchMarkers({
  mode,
  filters,
  bbox,
  scope,
  signal
}: {
  mode: MapMarkerMode;
  filters: MapFilters;
  bbox?: string;
  scope: SelectionState;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams(filtersToQueryString(filters));
  params.set("mode", mode);
  params.set("scopeType", scope.scopeType);
  params.set("scopeId", scope.scopeId);
  if (bbox) {
    params.set("bbox", bbox);
  }

  const url = `/api/map/markers?${params.toString()}`;
  return mapClientCache.getOrLoad(
    createMapCacheKey("markers", mode, filters, bbox, scope),
    () => fetchJson<MapMarkerResponse>(url, signal),
    {
      ttlMs: cacheTtlMs.markers
    }
  ) as Promise<MapMarkerResponse>;
}

async function fetchSearchResults(query: string, signal?: AbortSignal) {
  const url = `/api/search?query=${encodeURIComponent(query)}`;
  const cacheKey = createMapCacheKey("search", query);
  const cached = mapClientCache.peek(cacheKey) as SearchResult[] | undefined;
  if (cached) {
    return cached;
  }

  const results = await fetchJson<{ results: SearchResult[] }>(url, signal).then(
    (response) => response.results
  );
  void mapClientCache.getOrLoad(cacheKey, async () => results, {
    ttlMs: cacheTtlMs.search
  });
  return results;
}

const isFloraGroup = (group: string) => group === "flora";

const formatScopeEyebrow = (scopeType: MapScopeType) => scopeLabels[scopeType];

const buildHoverLabel = (marker: MapSpeciesMarker) =>
  `${marker.label} · ${marker.occurrenceCount} registros públicos`;

const getLayerIdForScope = (scopeType: MapScopeType) => {
  if (scopeType === "department") {
    return "departments";
  }

  if (scopeType === "protected_area") {
    return "protected_areas";
  }

  if (scopeType === "public_hex") {
    return "public_hex";
  }

  return null;
};

const getFeatureTitle = (feature: NormalizedFeatureReference | null) =>
  String(feature?.properties?.label ?? feature?.properties?.name ?? "Selección del mapa");

const getFeatureMeta = (feature: NormalizedFeatureReference | null) => {
  const kind = feature?.properties?.kind;
  if (typeof kind === "string" && scopeLabels[kind as MapScopeType]) {
    return scopeLabels[kind as MapScopeType];
  }

  return feature?.layerId === "species_markers" ? "Marcador" : "Mapa";
};

const getFeatureSupportingLine = (feature: NormalizedFeatureReference | null) => {
  const speciesCount = feature?.properties?.speciesCount;
  const occurrenceCount = feature?.properties?.occurrenceCount;

  if (typeof speciesCount === "number") {
    return `${speciesCount} especies visibles`;
  }

  if (typeof occurrenceCount === "number") {
    return `${occurrenceCount} registros públicos`;
  }

  return typeof feature?.properties?.biodiversityLabel === "string"
    ? feature.properties.biodiversityLabel
    : null;
};

const createMarkerStyleVars = (style: Record<string, unknown>): CSSProperties => ({
  "--atlas-marker-surface": String(style.surfaceColor ?? "#ffffff"),
  "--atlas-marker-stroke": String(style.strokeColor ?? "rgba(16, 33, 36, 0.12)"),
  "--atlas-marker-text": String(style.textColor ?? "var(--ink)"),
  "--atlas-marker-badge": String(style.badgeColor ?? "var(--forest)"),
  "--atlas-marker-badge-text": String(style.badgeTextColor ?? "#ffffff"),
  "--atlas-marker-icon": String(style.iconColor ?? "#ffffff")
} as CSSProperties);

const buildMarkerStyleFeature = (marker: MapSpeciesMarker): MapFeature => ({
  type: "Feature",
  id: marker.id,
  properties: {
    id: marker.id,
    category: marker.group,
    mode: marker.mode,
    priority:
      marker.occurrenceCount >= 250
        ? "critical"
        : marker.occurrenceCount >= 120
          ? "high"
          : marker.occurrenceCount >= 40
            ? "medium"
            : "low"
  },
  geometry: {
    type: "Point",
    coordinates: [marker.point.longitude, marker.point.latitude]
  }
});

function AtlasMarkerContent({
  marker,
  mode,
  selected = false,
  onClick,
  onHoverChange
}: {
  marker: MapSpeciesMarker;
  mode: MapViewMode;
  selected?: boolean;
  onClick: (marker: MapSpeciesMarker) => void;
  onHoverChange: (value: string | null) => void;
}) {
  const markerIcon = getIconForFeature({
    category: marker.group,
    mode: marker.mode
  });
  const markerStyle = resolveMapStyleByKey(
    "species_markers",
    buildMarkerStyleFeature(marker),
    { viewMode: mode },
    selected ? "selected" : "default"
  );

  return (
    <button
      aria-label={buildHoverLabel(marker)}
      className={`atlas-marker atlas-marker-${mode}`}
      data-selected={selected ? "true" : "false"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick(marker);
      }}
      onMouseEnter={() => onHoverChange(buildHoverLabel(marker))}
      onMouseLeave={() => onHoverChange(null)}
      style={createMarkerStyleVars(markerStyle)}
      type="button"
    >
      <span
        className={`atlas-marker-visual ${marker.visual.kind === "photo" ? "has-photo" : ""}`}
        style={
          marker.visual.kind === "photo" && marker.visual.src
            ? { backgroundImage: `url(${marker.visual.src})`, color: String(markerStyle.iconColor ?? "#ffffff") }
            : { background: marker.visual.accent, color: String(markerStyle.iconColor ?? "#ffffff") }
        }
      >
        {marker.visual.kind === "photo" ? (
          <span className="atlas-marker-badge">
            <MapIcon decorative iconId={markerIcon.id} size={14} />
          </span>
        ) : (
          <MapIcon decorative iconId={markerIcon.id} size={18} />
        )}
      </span>
      {mode === "coverage" ? (
        <span className="atlas-marker-copy">
          <strong>{marker.label}</strong>
          <small>{marker.occurrenceCount} registros</small>
        </span>
      ) : null}
      <span className="atlas-marker-count">{marker.occurrenceCount}</span>
    </button>
  );
}

function AtlasClusterContent({
  count,
  selected = false,
  onClick,
  onHoverChange
}: {
  count: number;
  selected?: boolean;
  onClick: () => void;
  onHoverChange: (value: string | null) => void;
}) {
  const clusterStyle = resolveMapStyleByKey(
    "marker_clusters",
    {
      type: "Feature",
      id: `cluster-${count}`,
      properties: {
        id: `cluster-${count}`,
        priority: count >= 120 ? "critical" : count >= 40 ? "high" : "medium"
      },
      geometry: {
        type: "Point",
        coordinates: [0, 0]
      }
    },
    {},
    selected ? "selected" : "default"
  );

  return (
    <button
      aria-label={`${count} ubicaciones agrupadas`}
      className="atlas-marker atlas-marker-cluster"
      data-selected={selected ? "true" : "false"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => onHoverChange(`${count} ubicaciones agrupadas`)}
      onMouseLeave={() => onHoverChange(null)}
      style={createMarkerStyleVars(clusterStyle)}
      type="button"
    >
      <span className="atlas-marker-cluster-count">{count}</span>
      <span className="atlas-marker-cluster-copy">Agrupadas</span>
    </button>
  );
}

export function MapExplorer() {
  const mapValidation = useMemo(() => validateMapEnvironment(appEnv), []);
  const mapProvider = appEnv.map.provider;
  const runtimeMapProvider = mapValidation.valid
    ? resolveConfiguredMapProvider(mapProvider)
    : "maplibre";
  const [adapter] = useState(() => createMapAdapter({ provider: runtimeMapProvider }));
  const [controller] = useState(() => new MapController(adapter));
  const interactionState = useSyncExternalStore(
    (listener) => controller.subscribeToInteractionState(listener),
    () => controller.getInteractionState(),
    () => controller.getInteractionState()
  );
  const [mapReady, setMapReady] = useState(false);
  const layersRegisteredRef = useRef(false);
  const [filters, setFilters] = useState<MapFilters>(defaultFilters);
  const [selection, setSelection] = useState<SelectionState>({
    scopeType: "country",
    scopeId: "guatemala"
  });
  const [sort, setSort] = useState<MapSpeciesSort>("presence");
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<MapSummaryResponse | null>(null);
  const [panel, setPanel] = useState<MapPanelResponse | null>(null);
  const [speciesPanel, setSpeciesPanel] = useState<MapSpeciesPanelResponse | null>(null);
  const [markers, setMarkers] = useState<MapSpeciesMarker[]>([]);
  const [markerMeta, setMarkerMeta] = useState<MapMarkerResponse["meta"] | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibilityState>(() =>
    createLayerVisibilityState(layerRegistry)
  );
  const [layerStatuses, setLayerStatuses] = useState<Record<string, MapLayerLoadState>>({});
  const [markerHoveredLabel, setMarkerHoveredLabel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapFailure, setMapFailure] = useState<MapOperationalFailure | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"filters" | "legend" | null>(null);

  const deferredFilters = useDeferredValue(filters);
  const deferredSelection = useDeferredValue(selection);
  const deferredSort = useDeferredValue(sort);
  const zoom = interactionState.viewport?.zoom ?? appEnv.map.defaultZoom;
  const bbox = interactionState.viewport?.bounds
    ? formatViewportBounds(padBounds(interactionState.viewport.bounds))
    : undefined;
  const activeMode: MapViewMode = deferredFilters.viewMode ?? "coverage";
  const activeTaxonScope: TaxonScope = deferredFilters.taxonScope ?? "all";
  const activeTaxonSlug =
    deferredFilters.taxonSlug ?? speciesPanel?.focusSpecies.slug ?? panel?.species[0]?.slug;
  const showRichnessCells =
    activeMode === "coverage" && (zoom >= 7.15 || selection.scopeType !== "country");
  const geoJsonLayers = useMemo(() => getRenderableGeoJsonLayers(layerRegistry), []);
  const activeModeRef = useRef(activeMode);

  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  useEffect(() => {
    trackMapEvent("map_preflight_started", {
      provider: mapProvider,
      appEnv: appEnv.appEnv
    });

    if (!mapValidation.valid) {
      const missingEnvVars = getMissingPublicEnvVars(appEnv);
      logger.warn("Map preflight validation failed.", {
        provider: mapProvider,
        missingEnvVars,
        errors: mapValidation.errors,
        warnings: mapValidation.warnings
      });
      trackMapEvent("map_preflight_failed", {
        provider: mapProvider,
        count: mapValidation.errors.length,
        errorMessage: mapValidation.errors.join(" | ")
      });
      return;
    }

    trackMapEvent("map_preflight_passed", {
      provider: mapProvider
    });
    trackMapEvent("map_initialization_started", {
      provider: mapProvider
    });
  }, [mapProvider, mapValidation]);

  useEffect(
    () => () => {
      trackMapEvent("map_destroyed", {
        provider: mapProvider
      });
    },
    [mapProvider]
  );

  useEffect(() => {
    const updateViewportMode = () => setIsMobile(window.innerWidth < 820);
    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    return () => window.removeEventListener("resize", updateViewportMode);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobilePanel(null);
    }
  }, [isMobile]);

  useEffect(() => {
    trackMapMetric("map_initial_render_start", {
      provider: mapProvider
    });
  }, [mapProvider]);

  useEffect(() => {
    const debouncedFetch = createDebouncedCallback(async (nextFilters: MapFilters) => {
      try {
        setSummary(await fetchSummary(nextFilters));
      } catch (error) {
        logger.error("Map summary request failed.", error, {
          provider: mapProvider
        });
      }
    }, 180);

    debouncedFetch(deferredFilters);

    return () => {
      debouncedFetch.cancel();
    };
  }, [deferredFilters]);

  useEffect(() => {
    if (!mapReady || !layersRegisteredRef.current) {
      return undefined;
    }

    const requestController = new AbortController();
    const sourceLayers = getVisibleLayers(layerRegistry, {
      toggles: layerVisibility,
      viewMode: activeMode,
      zoom,
      showRichnessCells,
      selection
    }).filter(
      (layer) =>
        layer.renderMode === "geojson" &&
        layer.dataSource.kind === "atlas-api-layer" &&
        layer.dataSource.dataShape === "geojson"
    );
    const inactiveLayers = geoJsonLayers.filter(
      (layer) => !sourceLayers.some((sourceLayer) => sourceLayer.id === layer.id)
    );
    const requestStartedAt = getMapMetricTime();
    const viewportKey = buildViewportCacheKey(
      interactionState.viewport?.bounds ? padBounds(interactionState.viewport.bounds) : undefined,
      zoom
    );

    startTransition(() => {
      setLayerStatuses((current) => ({
        ...current,
        ...Object.fromEntries(
          sourceLayers.map((layer) => [
            layer.id,
            buildLayerLoadState({
              layer,
              status: "loading",
              viewMode: activeMode
            })
          ])
        ),
        ...Object.fromEntries(
          inactiveLayers.map((layer) => [
            layer.id,
            buildLayerLoadState({
              layer,
              status: "disabled",
              viewMode: activeMode
            })
          ])
        )
      }));
    });

    inactiveLayers.forEach((layer) => {
      controller.updateLayerData(layer.id, emptyFeatureCollection);
    });

    const debouncedLoad = createDebouncedCallback(async () => {
      trackMapMetric("viewport_query_start", {
        bbox: viewportKey,
        layerIds: sourceLayers.map((layer) => layer.id)
      });

      await runLayerLoadQueue(
        sourceLayers.map((layer) => ({
          id: layer.id,
          priority:
            layer.id === "departments" ||
            layer.id === "protected_areas" ||
            (activeMode === "species" && layer.id === "species_presence")
              ? "critical"
              : "important",
          run: async () => {
            const layerStartedAt = getMapMetricTime();
            trackMapMetric("layer_load_start", {
              layerId: layer.id
            });
            trackMapEvent("layer_load_started", {
              provider: mapProvider,
              layerId: layer.id
            });
            return {
              layer,
              collection: await fetchLayer(layer.id, deferredFilters, bbox, requestController.signal),
              durationMs: getMapMetricTime() - layerStartedAt
            };
          },
          onResolved: ({ layer: resolvedLayer, collection, durationMs }) => {
            const validation = validateFeatureCollectionForLayer(collection, resolvedLayer);
            const strategy = getDatasetStrategy(collection.features.length, resolvedLayer.geometryType);

            trackMapMetric("layer_feature_count", {
              layerId: resolvedLayer.id,
              featureCount: collection.features.length
            });
            trackMapMetric("layer_strategy_selected", {
              layerId: resolvedLayer.id,
              sizeClass: strategy.sizeClass,
              shouldCluster: strategy.shouldCluster,
              shouldUseViewportLoading: strategy.shouldUseViewportLoading
            });

            if (!validation.valid) {
              controller.updateLayerData(resolvedLayer.id, emptyFeatureCollection);
              setLayerStatuses((current) => ({
                ...current,
                [resolvedLayer.id]: buildLayerLoadState({
                  layer: resolvedLayer,
                  status: "invalid",
                  errors: validation.errors,
                  strategy,
                  viewMode: activeMode
                })
              }));
              trackMapEvent("layer_failed", {
                provider: mapProvider,
                layerId: resolvedLayer.id,
                errorName: "ValidationError",
                errorMessage: validation.errors.join(" | ")
              });
              return;
            }

            if (collection.features.length > strategy.maxDirectRenderFeatures) {
              controller.updateLayerData(resolvedLayer.id, emptyFeatureCollection);
              trackMapMetric("too_large_dataset_blocked", {
                layerId: resolvedLayer.id,
                featureCount: collection.features.length
              });
              trackMapEvent("large_dataset_warning", {
                provider: mapProvider,
                layerId: resolvedLayer.id,
                featureCount: collection.features.length
              });
              setLayerStatuses((current) => ({
                ...current,
                [resolvedLayer.id]: buildLayerLoadState({
                  layer: resolvedLayer,
                  status: "too_large",
                  featureCount: collection.features.length,
                  strategy,
                  viewMode: activeMode
                })
              }));
              return;
            }

            controller.updateLayerData(resolvedLayer.id, collection);
            setLayerStatuses((current) => ({
              ...current,
              [resolvedLayer.id]: buildLayerLoadState({
                layer: resolvedLayer,
                status: collection.features.length === 0 ? "empty" : "ready",
                featureCount: collection.features.length,
                strategy,
                viewMode: activeMode
              })
            }));
            trackMapMetric("layer_load_end", {
              layerId: resolvedLayer.id,
              durationMs
            });
            trackMapEvent("layer_loaded", {
              provider: mapProvider,
              layerId: resolvedLayer.id,
              featureCount: collection.features.length,
              durationMs
            });
            if (collection.features.length > LARGE_DATASET_WARNING_THRESHOLD) {
              trackMapEvent("large_dataset_warning", {
                provider: mapProvider,
                layerId: resolvedLayer.id,
                featureCount: collection.features.length
              });
            }
            if (durationMs > SLOW_LAYER_WARNING_MS) {
              trackMapEvent("provider_usage_warning", {
                provider: mapProvider,
                layerId: resolvedLayer.id,
                durationMs
              });
            }
            setMapFailure((current) =>
              current?.kind === "layer_load" && current.layerId === resolvedLayer.id ? null : current
            );
          },
          onRejected: (error) => {
            if (isAbortError(error)) {
              return;
            }

            logger.error("Map layer load failed.", error, {
              provider: mapProvider,
              layerId: layer.id
            });
            controller.updateLayerData(layer.id, emptyFeatureCollection);
            setLayerStatuses((current) => ({
              ...current,
              [layer.id]: buildLayerLoadState({
                layer,
                status: "error",
                errors: [error instanceof Error ? error.message : String(error)],
                viewMode: activeMode
              })
            }));
            trackMapMetric("layer_load_error", {
              layerId: layer.id,
              error: error instanceof Error ? error.message : String(error)
            });
            trackMapEvent("layer_failed", {
              provider: mapProvider,
              layerId: layer.id,
              errorName: error instanceof Error ? error.name : "LayerLoadError",
              errorMessage: toErrorMessage(error)
            });
            setMapFailure(
              buildMapFailure("layer_load", {
                provider: mapProvider,
                layerId: layer.id,
                message: toErrorMessage(error),
                fatal: false
              })
            );
          }
        })),
        {
          signal: requestController.signal
        }
      );

      trackMapMetric("viewport_query_end", {
        bbox: viewportKey,
        durationMs: getMapMetricTime() - requestStartedAt
      });
    }, 160);

    debouncedLoad();

    return () => {
      debouncedLoad.cancel();
      requestController.abort();
    };
  }, [
    activeMode,
    bbox,
    controller,
    deferredFilters,
    geoJsonLayers,
    interactionState.viewport?.bounds,
    layerVisibility,
    mapReady,
    selection,
    showRichnessCells,
    zoom
  ]);

  useEffect(() => {
    if (activeMode !== "coverage") {
      return;
    }

    const debouncedFetch = createDebouncedCallback(async () => {
      try {
        setPanel(
          await fetchPanel({
            filters: deferredFilters,
            page,
            scope: deferredSelection,
            sort: deferredSort
          })
        );
      } catch (error) {
        logger.error("Coverage panel request failed.", error, {
          provider: mapProvider
        });
      }
    }, 160);

    debouncedFetch();

    return () => {
      debouncedFetch.cancel();
    };
  }, [activeMode, deferredFilters, deferredSelection, deferredSort, page]);

  useEffect(() => {
    if (activeMode !== "species") {
      return;
    }

    const debouncedFetch = createDebouncedCallback(async () => {
      try {
        setSpeciesPanel(await fetchSpeciesPanel(deferredFilters));
      } catch (error) {
        logger.error("Species panel request failed.", error, {
          provider: mapProvider
        });
      }
    }, 160);

    debouncedFetch();

    return () => {
      debouncedFetch.cancel();
    };
  }, [activeMode, deferredFilters]);

  useEffect(() => {
    const markersLayer = getLayerConfig("species_markers");

    if (!layerVisibility.species_markers) {
      setMarkers([]);
      setMarkerMeta(null);
      setLayerStatuses((current) => ({
        ...current,
        species_markers: buildLayerLoadState({
          layer: markersLayer,
          status: "disabled",
          viewMode: activeMode
        })
      }));
      return;
    }

    setLayerStatuses((current) => ({
      ...current,
      species_markers: buildLayerLoadState({
        layer: markersLayer,
        status: "loading",
        viewMode: activeMode
      })
    }));

    const debouncedFetch = createDebouncedCallback(async () => {
      try {
        const markerLoadStartedAt = getMapMetricTime();
        const nextFilters =
          activeMode === "species" && activeTaxonSlug
            ? {
                ...deferredFilters,
                taxonSlug: activeTaxonSlug
              }
            : deferredFilters;

        trackMapEvent("layer_load_started", {
          provider: mapProvider,
          layerId: "species_markers"
        });
        const response = await fetchMarkers({
          mode: activeMode === "species" ? "species_presence" : "coverage_preview",
          filters: nextFilters,
          bbox,
          scope: deferredSelection
        });
        const strategy = getDatasetStrategy(response.meta.totalCount, "point");

        if (strategy.shouldUseVectorTiles && response.meta.totalCount > strategy.maxDirectRenderFeatures) {
          setMarkers([]);
          setMarkerMeta(response.meta);
          setLayerStatuses((current) => ({
            ...current,
            species_markers: buildLayerLoadState({
              layer: markersLayer,
              status: "too_large",
              featureCount: response.meta.totalCount,
              strategy,
              viewMode: activeMode
            })
          }));
          trackMapMetric("too_large_dataset_blocked", {
            layerId: "species_markers",
            featureCount: response.meta.totalCount
          });
          trackMapEvent("large_dataset_warning", {
            provider: mapProvider,
            layerId: "species_markers",
            featureCount: response.meta.totalCount
          });
          return;
        }

        setMarkers(response.markers);
        setMarkerMeta(response.meta);
        setLayerStatuses((current) => ({
          ...current,
          species_markers: buildLayerLoadState({
            layer: markersLayer,
            status: response.markers.length === 0 ? "empty" : "ready",
            featureCount: response.meta.totalCount,
            strategy,
            viewMode: activeMode
          })
        }));
        trackMapMetric("layer_strategy_selected", {
          layerId: "species_markers",
          sizeClass: strategy.sizeClass,
          shouldCluster: strategy.shouldCluster,
          featureCount: response.meta.totalCount
        });
        const durationMs = getMapMetricTime() - markerLoadStartedAt;
        trackMapEvent("layer_loaded", {
          provider: mapProvider,
          layerId: "species_markers",
          featureCount: response.meta.totalCount,
          durationMs
        });
        if (response.meta.totalCount > LARGE_DATASET_WARNING_THRESHOLD) {
          trackMapEvent("large_dataset_warning", {
            provider: mapProvider,
            layerId: "species_markers",
            featureCount: response.meta.totalCount
          });
        }
        if (durationMs > SLOW_LAYER_WARNING_MS) {
          trackMapEvent("provider_usage_warning", {
            provider: mapProvider,
            layerId: "species_markers",
            durationMs
          });
        }
        setMapFailure((current) =>
          current?.kind === "layer_load" && current.layerId === "species_markers" ? null : current
        );
      } catch (error) {
        logger.error("Marker layer load failed.", error, {
          provider: mapProvider,
          layerId: "species_markers"
        });
        setLayerStatuses((current) => ({
          ...current,
          species_markers: buildLayerLoadState({
            layer: markersLayer,
            status: "error",
            errors: [error instanceof Error ? error.message : String(error)],
            viewMode: activeMode
          })
        }));
        trackMapEvent("layer_failed", {
          provider: mapProvider,
          layerId: "species_markers",
          errorName: error instanceof Error ? error.name : "LayerLoadError",
          errorMessage: toErrorMessage(error)
        });
        setMapFailure(
          buildMapFailure("layer_load", {
            provider: mapProvider,
            layerId: "species_markers",
            message: toErrorMessage(error),
            fatal: false
          })
        );
      }
    }, 160);

    debouncedFetch();

    return () => {
      debouncedFetch.cancel();
    };
  }, [activeMode, activeTaxonSlug, bbox, deferredFilters, deferredSelection, layerVisibility.species_markers]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchLoading(false);
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const debouncedSearch = createDebouncedCallback(async (query: string) => {
      setSearchLoading(true);
      try {
        setSearchResults(await fetchSearchResults(query, controller.signal));
      } catch (error) {
        if (!isAbortError(error)) {
          logger.error("Map search request failed.", error, {
            provider: mapProvider
          });
        }
      } finally {
        setSearchLoading(false);
      }
    }, 280);

    debouncedSearch(searchQuery);

    return () => {
      setSearchLoading(false);
      debouncedSearch.cancel();
      controller.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!mapReady || layersRegisteredRef.current) {
      return undefined;
    }

    geoJsonLayers.forEach((layer) => {
      controller.addLayer({
        ...layer,
        data: emptyFeatureCollection,
        visibility: "hidden"
      });
    });
    layersRegisteredRef.current = true;

    return () => {
      layersRegisteredRef.current = false;
    };
  }, [controller, geoJsonLayers, mapReady]);

  useEffect(() => {
    if (activeModeRef.current !== "coverage") {
      return;
    }

    const selectedFeature = interactionState.selectedFeature;
    const featureId = selectedFeature?.properties?.id;
    const featureKind = selectedFeature?.properties?.kind;

    if (
      !featureId ||
      !featureKind ||
      !scopeLabels[featureKind as MapScopeType] ||
      selection.scopeType === featureKind &&
        selection.scopeId === String(featureId)
    ) {
      return;
    }

    setPage(1);
    setSelection({
      scopeType: featureKind as MapScopeType,
      scopeId: String(featureId)
    });
  }, [interactionState.selectedFeature, selection.scopeId, selection.scopeType]);

  useEffect(() => {
    const selectedFeature = interactionState.selectedFeature;
    if (!selectedFeature) {
      return;
    }

    trackMapEvent("feature_clicked", {
      provider: mapProvider,
      layerId: selectedFeature.layerId,
      featureId:
        selectedFeature.featureId ??
        (selectedFeature.properties?.id ? String(selectedFeature.properties.id) : undefined),
      geometryType: selectedFeature.geometry?.type,
      category:
        typeof selectedFeature.properties?.kind === "string"
          ? selectedFeature.properties.kind
          : undefined,
      status: "selected"
    });
  }, [interactionState.selectedFeature, mapProvider]);

  useEffect(() => {
    if (!mapReady || !layersRegisteredRef.current) {
      return;
    }

    const visibleLayerIds = new Set(
      getVisibleLayers(layerRegistry, {
        toggles: layerVisibility,
        viewMode: activeMode,
        zoom,
        showRichnessCells,
        selection
      })
        .filter((layer) => layer.renderMode === "geojson")
        .map((layer) => layer.id)
    );

    geoJsonLayers.forEach((layer) => {
      controller.setLayerVisibility(layer.id, toMapLayerVisibility(visibleLayerIds.has(layer.id)));
    });
  }, [activeMode, controller, geoJsonLayers, layerVisibility, mapReady, selection, showRichnessCells, zoom]);

  const updateFilter = (key: keyof MapFilters, value: string | boolean | undefined) => {
    trackMapEvent("filter_applied", {
      provider: mapProvider,
      category: String(key),
      status: value === undefined ? "cleared" : String(value)
    });
    startTransition(() => {
      setPage(1);
      setFilters((current) => ({
        ...current,
        [key]: value
      }));
    });
  };

  const updateLayerVisibility = (key: string, value: boolean) => {
    trackMapEvent("filter_applied", {
      provider: mapProvider,
      category: "layer_visibility",
      layerId: key,
      status: value ? "enabled" : "disabled"
    });
    setLayerVisibility((current) => ({
      ...current,
      [key]: value
    }));
  };

  const switchMode = (mode: MapViewMode) => {
    trackMapEvent("filter_applied", {
      provider: mapProvider,
      category: "view_mode",
      status: mode
    });
    if (mode === "species") {
      const nextSpecies = panel?.species[0] ?? speciesPanel?.focusSpecies;

      startTransition(() => {
        setFilters((current) => ({
          ...current,
          viewMode: "species",
          taxonSlug: current.taxonSlug ?? nextSpecies?.slug,
          taxonScope: nextSpecies
            ? isFloraGroup(nextSpecies.group)
              ? "flora"
              : "fauna"
            : current.taxonScope
        }));
      });
      return;
    }

    startTransition(() => {
      setFilters((current) => ({
        ...current,
        viewMode: "coverage"
      }));
    });
  };

  const updateRegion = (value: string) => {
    updateFilter("region", value);

    if (value === "all") {
      setSelection({
        scopeType: "country",
        scopeId: "guatemala"
      });
      return;
    }

    const region = summary?.filterOptions.regions.find((entry) => entry.id === value);
    if (!region) {
      return;
    }

    setSelection({
      scopeType: region.scopeType,
      scopeId: region.id
    });
  };

  const selectCoverageScope = (
    scopeType: MapScopeType,
    scopeId: string,
    source: "search" | "list" | "system" = "system",
    fit = true
  ) => {
    const layerId = getLayerIdForScope(scopeType);
    if (layerId) {
      controller.selectFeature(layerId, scopeId, {
        source,
        fit,
        openPopup: false,
        openDetail: true
      });
    }

    setPage(1);
    setSelection({
      scopeType,
      scopeId
    });
  };

  const handleDetailClose = () => {
    controller.closePopup("list");
    controller.closeDetail("list");
    controller.clearSelection("list");
  };

  const resetExplorer = () => {
    startTransition(() => {
      setFilters(defaultFilters);
      setSelection({
        scopeType: "country",
        scopeId: "guatemala"
      });
      setPage(1);
      setSort("presence");
      setMobilePanel(null);
    });
    if (mapReady) {
      controller.setView(mapOptions.center, mapOptions.zoom);
    }
  };

  const activateSpeciesMode = (slug: string, nextTaxonScope: TaxonScope = activeTaxonScope) => {
    startTransition(() => {
      setFilters((current) => ({
        ...current,
        viewMode: "species",
        taxonSlug: slug,
        taxonScope: nextTaxonScope
      }));
    });
  };

  const handleSearchSelection = (result: SearchResult) => {
    setSearchQuery(result.title);
    setSearchResults([]);
    setSearchLoading(false);
    setMobilePanel(null);
    trackMapEvent("search_used", {
      provider: mapProvider,
      category: result.type,
      featureId: result.id
    });

    if (result.type === "species") {
      const nextSpecies = panel?.species.find((species) => species.slug === result.slug);
      activateSpeciesMode(
        result.slug,
        nextSpecies ? (isFloraGroup(nextSpecies.group) ? "flora" : "fauna") : "all"
      );
      return;
    }

    if (result.type === "area") {
      const region = summary?.filterOptions.regions.find((entry) => entry.id === result.slug);

      startTransition(() => {
        setPage(1);
        setFilters((current) => ({
          ...current,
          viewMode: "coverage",
            region: region?.id ?? "all"
        }));
      });

      if (region) {
        selectCoverageScope(region.scopeType, region.id, "search");
      } else {
        setSelection({
          scopeType: "country",
          scopeId: "guatemala"
        });
      }
      return;
    }

    window.location.assign(result.href);
  };
  const handleMarkerClick = (marker: MapSpeciesMarker) => {
    if (marker.mode === "coverage_preview") {
      activateSpeciesMode(marker.slug, isFloraGroup(marker.group) ? "flora" : "fauna");
      if (mapReady) {
        controller.setView([marker.point.longitude, marker.point.latitude], Math.max(zoom, 7.2));
      }
      return;
    }

    switchMode("coverage");
    setPage(1);
    setSelection({
      scopeType: "public_hex",
      scopeId: marker.scopeRef.scopeId
    });
    updateFilter("region", "all");
    if (mapReady) {
      controller.setView([marker.point.longitude, marker.point.latitude], Math.max(zoom, 8.8));
    }
  };

  const coveragePanelTitle = panel?.selection.title ?? "Guatemala";
  const coveragePanelSubtitle =
    panel?.selection.subtitle ?? "Preparando lectura territorial de la biodiversidad visible.";
  const speciesPlaces = speciesPanel?.places ?? [];
  const focusSpecies = speciesPanel?.focusSpecies;
  const coverageScopeLabel = formatScopeEyebrow(panel?.selection.scopeType ?? selection.scopeType);
  const activeModeCopy =
    activeMode === "coverage"
      ? "Explora territorios primero; las celdas públicas aparecen al acercar o al entrar en una región."
      : "Sigue una especie puntual con presencia generalizada y vuelve al territorio desde cada zona.";
  const toggleableLayers = useMemo(
    () => getToggleableLayers(layerRegistry, { viewMode: activeMode }),
    [activeMode]
  );
  const legendItems = useMemo<MapLegendItem[]>(
    () =>
      (activeMode === "coverage"
        ? ["departments", "protected_areas", "public_hex", "species_markers"]
        : ["departments", "protected_areas", "species_presence", "species_markers"]
      ).flatMap((layerId) => {
        const layer = getLayerConfig(layerId);
        if (!layer) {
          return [];
        }

        const metadataIconId =
          typeof layer.metadata?.legendIconId === "string" ? layer.metadata.legendIconId : null;
        const iconId = metadataIconId ?? resolveLayerIcon(layer, undefined, { viewMode: activeMode })?.id;
        if (!iconId) {
          return [];
        }

        return [
          {
            iconId: iconId as MapIconId,
            label: resolveLayerLabel(layer, undefined, { viewMode: activeMode }) ?? undefined,
            styleKey: layer.mapStyleKey ?? layer.id,
            styleContext: {
              viewMode: activeMode
            }
          }
        ];
      }),
    [activeMode]
  );
  const mapStyleUrl =
    appEnv.map.mapStyleUrl ??
    "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
  const mapOptions = useMemo(
    () => ({
      provider: runtimeMapProvider,
      center: [appEnv.map.defaultCenter.lng, appEnv.map.defaultCenter.lat] as Coordinate,
      zoom: appEnv.map.defaultZoom,
      maxZoom: 14,
      minZoom: 5,
      interactive: true,
      styleUrl: mapStyleUrl
    }),
    [mapStyleUrl, runtimeMapProvider]
  );
  const preflightFailure = mapValidation.valid
    ? null
    : buildMapFailure("preflight", {
        provider: mapProvider,
        missingEnvVars: getMissingPublicEnvVars(appEnv),
        warnings: mapValidation.warnings,
        message: mapValidation.errors.join(" | ")
      });
  const renderVersion = `${activeMode}:${selection.scopeType}:${selection.scopeId}:${showRichnessCells ? "1" : "0"}:${zoom.toFixed(2)}`;
  const markerStrategy = useMemo(
    () => getDatasetStrategy(markerMeta?.totalCount ?? markers.length, "point"),
    [markerMeta?.totalCount, markers.length]
  );
  const clusteredMarkers = useMemo(
    () => (markerStrategy.shouldCluster ? clusterMarkers(markers, zoom) : markers.map((marker) => ({
      kind: "marker" as const,
      marker
    }))),
    [markerStrategy.shouldCluster, markers, zoom]
  );
  const canvasMarkers = useMemo<MapCanvasMarker[]>(
    () =>
      layerVisibility.species_markers
        ? clusteredMarkers.map((entry) =>
            entry.kind === "cluster"
                ? {
                    id: entry.id,
                    coordinate: entry.coordinate,
                    content: (
                      <AtlasClusterContent
                        count={entry.count}
                        onClick={() => controller.fitBounds(entry.bounds, { padding: 96, duration: 640 })}
                        onHoverChange={setMarkerHoveredLabel}
                        selected={false}
                      />
                    )
                  }
                : {
                    id: entry.marker.id,
                    coordinate: [entry.marker.point.longitude, entry.marker.point.latitude] as Coordinate,
                    content: (
                      <AtlasMarkerContent
                        marker={entry.marker}
                        mode={activeMode}
                        selected={
                          activeMode === "species"
                            ? entry.marker.slug === activeTaxonSlug
                            : selection.scopeType === "public_hex" &&
                              selection.scopeId === entry.marker.scopeRef.scopeId
                        }
                        onClick={handleMarkerClick}
                        onHoverChange={setMarkerHoveredLabel}
                      />
                    )
                  }
          )
        : [],
    [activeMode, activeTaxonSlug, clusteredMarkers, controller, layerVisibility.species_markers, selection]
  );
  const activeLayerNote =
    activeMode === "coverage" && !showRichnessCells
      ? "Celdas públicas ocultas a esta escala para priorizar máscara geográfica real."
      : layerStatuses.species_markers?.status === "loading"
        ? "Actualizando capas visibles…"
        : layerStatuses.species_markers?.status === "too_large"
          ? layerStatuses.species_markers.message
          : activeMode === "coverage"
            ? layerStatuses.public_hex?.message ?? null
            : layerStatuses.species_presence?.message ?? null;
  const layerStatusItems = useMemo(
    () =>
      Object.entries(layerStatuses).filter(([, state]) =>
        state.status === "loading" ||
        state.status === "error" ||
        state.status === "too_large" ||
        state.status === "empty" ||
        state.status === "disabled"
      ),
    [layerStatuses]
  );
  const hasRecoverableLayerError = layerStatusItems.some(([, state]) => state.status === "error");
  const hasLoadingLayers = layerStatusItems.some(([, state]) => state.status === "loading");
  const hasNoVisibleData =
    mapReady &&
    !mapError &&
    !hasLoadingLayers &&
    !hasRecoverableLayerError &&
    summary !== null &&
    (summary.metrics.visibleSpecies ?? 0) === 0 &&
    (summary.metrics.visibleOccurrences ?? 0) === 0 &&
    (markerMeta?.totalCount ?? 0) === 0;
  const getTooltipText = (feature: MapFeature, layerId?: string | null) =>
    resolveLayerTooltip(layerId ? getLayerConfig(layerId) : null, feature, {
      viewMode: activeMode,
      zoom,
      selection,
      showRichnessCells
    });
  const popupFeature = interactionState.popupFeature;
  const detailFeature = interactionState.detailFeature;
  const popupTitle = getFeatureTitle(popupFeature);
  const popupMeta = getFeatureMeta(popupFeature);
  const popupSupportingLine = getFeatureSupportingLine(popupFeature);

  return (
    <div className="atlas-workspace">
      <div className="atlas-topbar">
        <div className="atlas-topbar-copy">
          <p className="eyebrow">Explorador público</p>
          <h1>Mapa de biodiversidad pública</h1>
          <p>{summary?.subtitle ?? activeModeCopy}</p>
        </div>

        <div className="atlas-topbar-actions">
          <MapSearch
            loading={searchLoading}
            onQueryChange={setSearchQuery}
            onSelectResult={handleSearchSelection}
            query={searchQuery}
            results={searchResults}
          />

          <div className="atlas-topbar-chips">
            <div className="atlas-mode-switch" role="tablist" aria-label="Modo del mapa">
              <button
                className={activeMode === "coverage" ? "is-active" : undefined}
                onClick={() => switchMode("coverage")}
                type="button"
              >
                Cobertura
              </button>
              <button
                className={activeMode === "species" ? "is-active" : undefined}
                onClick={() => switchMode("species")}
                type="button"
              >
                Especie
              </button>
            </div>

            <div className="atlas-scope-toggle" role="tablist" aria-label="Cobertura taxonómica">
              {(["all", "flora", "fauna"] as TaxonScope[]).map((scope) => (
                <button
                  className={activeTaxonScope === scope ? "is-active" : undefined}
                  key={scope}
                  onClick={() => updateFilter("taxonScope", scope)}
                  type="button"
                >
                  {scope === "all" ? "Todo" : scope}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <aside className="atlas-filter-rail">
        <section className="atlas-rail-section">
          <div className="atlas-rail-section-head">
            <div>
              <p className="atlas-section-label">Enfoque</p>
              <strong>{coveragePanelTitle}</strong>
            </div>
            <button className="atlas-reset-link" onClick={resetExplorer} type="button">
              Reiniciar
            </button>
          </div>
          <p className="atlas-rail-copy">{activeModeCopy}</p>
        </section>

        <section className="atlas-rail-section">
          <p className="atlas-section-label">Filtros rápidos</p>
          <div className="atlas-filter-grid atlas-filter-grid-compact">
            <label>
              Región
              <select value={filters.region} onChange={(event) => updateRegion(event.target.value)}>
                <option value="all">Todo el país</option>
                {(summary?.filterOptions.regions ?? []).map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Grupo
              <select
                value={filters.group}
                onChange={(event) => updateFilter("group", event.target.value)}
              >
                {(summary?.filterOptions.groups ?? ["all"]).map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>

            <label className="atlas-toggle-row atlas-toggle-inline">
              <input
                checked={filters.protectedOnly ?? false}
                onChange={(event) => updateFilter("protectedOnly", event.target.checked)}
                type="checkbox"
              />
              <span>Solo cobertura protegida</span>
            </label>
          </div>
        </section>

        <details className="atlas-detail-group">
          <summary>Filtros avanzados</summary>
          <div className="atlas-detail-body">
            <div className="atlas-filter-grid">
              <label>
                Fuente
                <select
                  value={filters.sourceTier}
                  onChange={(event) => updateFilter("sourceTier", event.target.value)}
                >
                  {(summary?.filterOptions.sourceTiers ?? ["all"]).map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Elevación
                <select
                  value={filters.elevationBand}
                  onChange={(event) => updateFilter("elevationBand", event.target.value)}
                >
                  {(summary?.filterOptions.elevationBands ?? ["all"]).map((band) => (
                    <option key={band} value={band}>
                      {band}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Tiempo
                <select
                  value={filters.dateRange}
                  onChange={(event) => updateFilter("dateRange", event.target.value)}
                >
                  {(summary?.filterOptions.dateRanges ?? ["all"]).map((range) => (
                    <option key={range} value={range}>
                      {range}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </details>

        <details className="atlas-detail-group">
          <summary>Capas y procedencia</summary>
          <div className="atlas-detail-body">
            <MapLayerToggle
              layerStatuses={layerStatuses}
              layerVisibility={layerVisibility}
              layers={toggleableLayers}
              onToggleLayer={updateLayerVisibility}
              viewMode={activeMode}
            />

            <div className="atlas-note-stack">
              <span className="atlas-inline-note">{summary?.sourceMeta.canonicalLabel}</span>
              <span className="atlas-inline-note">{summary?.sourceMeta.confidenceLabel}</span>
              <span className="atlas-inline-note">{summary?.sourceMeta.optionalOverlayLabel}</span>
              {toggleableLayers
                .map((layer) => resolveLayerDescription(layer, { viewMode: activeMode }))
                .filter((value): value is string => Boolean(value))
                .slice(0, 1)
                .map((description) => (
                  <span className="atlas-inline-note" key={description}>
                    {description}
                  </span>
                ))}
              {layerStatusItems.map(([layerId, state]) => (
                <span
                  className={`atlas-inline-note atlas-inline-note-${state.status}`}
                  key={`${layerId}-${state.status}`}
                >
                  {state.message}
                </span>
              ))}
            </div>
          </div>
        </details>
      </aside>

      <section className="atlas-stage">
        <div className="atlas-stage-summary">
          <div className="atlas-stage-summary-copy">
            <p className="atlas-selection-breadcrumb">
              <span>{scopeLabels[selection.scopeType]}</span>
              <span>{coveragePanelTitle}</span>
            </p>
            <p>{summary?.title ?? "BioGT / Atlas vivo de Guatemala"}</p>
            <p className="atlas-stage-hint">
              {showRichnessCells
                ? "Celdas generalizadas activas para lectura fina."
                : "Vista amplia con máscara geográfica por departamento. Acerca el mapa para ver celdas públicas."}
            </p>
          </div>
          <div className="atlas-stage-metrics">
            <div>
              <strong>{summary?.metrics.visibleSpecies ?? "..."}</strong>
              <span>especies visibles</span>
            </div>
            <div>
              <strong>{summary?.metrics.visibleOccurrences ?? "..."}</strong>
              <span>registros públicos</span>
            </div>
            <div>
              <strong>{summary?.metrics.activeSources ?? "..."}</strong>
              <span>fuentes activas</span>
            </div>
          </div>
        </div>

        <MapOperationalBoundary failure={preflightFailure ?? mapFailure} validation={mapValidation}>
          <MapCanvas
            adapter={adapter}
            controller={controller}
            getTooltipText={getTooltipText}
            mapStyleUrl={mapStyleUrl}
            markers={canvasMarkers}
            onMapLoaded={() => {
              trackMapEvent("map_loaded", {
                provider: mapProvider
              });
            }}
            onMoveEnd={(viewport) => {
              trackMapEvent("bounds_changed", {
                provider: mapProvider,
                zoom: viewport.zoom
              });
            }}
            onReady={() => {
              setMapReady(true);
              setMapError(null);
              setMapFailure((current) =>
                current?.fatal === false ? current : null
              );
              trackMapMetric("map_initial_render_end", {
                provider: mapOptions.provider
              });
            }}
            onError={(error) => {
              const failure = classifyMapFailure(error, {
                provider: mapProvider
              });
              logger.error("Map initialization failed.", error, {
                provider: mapProvider
              });
              setMapFailure(failure);
              setMapError("Map unavailable");
              setMapReady(false);
              trackMapEvent("map_failed", {
                provider: mapProvider,
                errorName: error.name,
                errorMessage: error.message
              });
            }}
            options={mapOptions}
            renderVersion={renderVersion}
          >
          <MapControls
            filtersActive={mobilePanel === "filters"}
            legendActive={mobilePanel === "legend"}
            loading={!mapReady || hasLoadingLayers}
            mapReady={mapReady}
            onRecenter={() => controller.setView(mapOptions.center, mapOptions.zoom)}
            onToggleFilters={() => setMobilePanel((current) => (current === "filters" ? null : "filters"))}
            onToggleLegend={() => setMobilePanel((current) => (current === "legend" ? null : "legend"))}
            onZoomIn={() => controller.setView(interactionState.viewport?.center ?? mapOptions.center, zoom + 0.8)}
            onZoomOut={() => controller.setView(interactionState.viewport?.center ?? mapOptions.center, Math.max(5, zoom - 0.8))}
            statusLabel={mapError ?? (hasRecoverableLayerError ? "Hay capas con error." : null)}
          />

          {isMobile ? (
            <MapSearch
              className="atlas-map-search-overlay"
              floating
              loading={searchLoading}
              onQueryChange={setSearchQuery}
              onSelectResult={handleSearchSelection}
              query={searchQuery}
              results={searchResults}
            />
          ) : null}

          {activeLayerNote ? (
            <div className="atlas-map-note">
              <span>{activeLayerNote}</span>
              {hasRecoverableLayerError ? (
                <button
                  className="atlas-map-note-action"
                  onClick={() => window.location.reload()}
                  type="button"
                >
                  Reintentar
                </button>
              ) : null}
            </div>
          ) : null}

          {mapError ? (
            <div className="atlas-map-state-card" data-testid="map-error" role="alert">
              <strong>No se pudo iniciar el mapa</strong>
              <p>{mapError}</p>
              <button onClick={() => window.location.reload()} type="button">
                Reintentar
              </button>
            </div>
          ) : null}

          {hasNoVisibleData ? (
            <div className="atlas-map-state-card" data-testid="map-empty">
              <strong>No hay datos visibles</strong>
              <p>Ajusta filtros, cambia de región o reinicia la vista para recuperar geometrías públicas.</p>
              <button onClick={resetExplorer} type="button">
                Reiniciar vista
              </button>
            </div>
          ) : null}

          {!isMobile ? (
            <MapLegend className="atlas-map-legend atlas-map-legend-desktop" items={legendItems} />
          ) : null}

          {popupFeature ? (
            <FeaturePopup
              actionLabel="Abrir detalle"
              feature={popupFeature}
              meta={popupMeta}
              onAction={() => {
                if (popupFeature.layerId && popupFeature.featureId !== null) {
                  controller.selectFeature(popupFeature.layerId, popupFeature.featureId, {
                    source: "list",
                    openPopup: true,
                    openDetail: true
                  });
                }
              }}
              supportingLine={popupSupportingLine}
              title={popupTitle}
            />
          ) : null}

          {markerHoveredLabel ? <div className="map-hover-badge">{markerHoveredLabel}</div> : null}
          </MapCanvas>
        </MapOperationalBoundary>
      </section>

      {isMobile && mobilePanel === "filters" ? (
        <div className="atlas-mobile-overlay">
          <div className="atlas-mobile-panel">
            <div className="atlas-mobile-panel-head">
              <strong>Filtros y capas</strong>
              <button onClick={() => setMobilePanel(null)} type="button">
                Cerrar
              </button>
            </div>

            <div className="atlas-mobile-mode-stack">
              <div className="atlas-mode-switch" role="tablist" aria-label="Modo del mapa">
                <button
                  className={activeMode === "coverage" ? "is-active" : undefined}
                  onClick={() => switchMode("coverage")}
                  type="button"
                >
                  Cobertura
                </button>
                <button
                  className={activeMode === "species" ? "is-active" : undefined}
                  onClick={() => switchMode("species")}
                  type="button"
                >
                  Especie
                </button>
              </div>

              <div className="atlas-scope-toggle" role="tablist" aria-label="Cobertura taxonómica">
                {(["all", "flora", "fauna"] as TaxonScope[]).map((scope) => (
                  <button
                    className={activeTaxonScope === scope ? "is-active" : undefined}
                    key={`mobile-${scope}`}
                    onClick={() => updateFilter("taxonScope", scope)}
                    type="button"
                  >
                    {scope === "all" ? "Todo" : scope}
                  </button>
                ))}
              </div>

              <button className="atlas-reset-link atlas-mobile-reset" onClick={resetExplorer} type="button">
                Reiniciar mapa
              </button>
            </div>

            <div className="atlas-filter-grid atlas-filter-grid-compact">
              <label>
                Región
                <select value={filters.region} onChange={(event) => updateRegion(event.target.value)}>
                  <option value="all">Todo el país</option>
                  {(summary?.filterOptions.regions ?? []).map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Grupo
                <select value={filters.group} onChange={(event) => updateFilter("group", event.target.value)}>
                  {(summary?.filterOptions.groups ?? ["all"]).map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>

              <label className="atlas-toggle-row atlas-toggle-inline">
                <input
                  checked={filters.protectedOnly ?? false}
                  onChange={(event) => updateFilter("protectedOnly", event.target.checked)}
                  type="checkbox"
                />
                <span>Solo cobertura protegida</span>
              </label>
            </div>

            <MapLayerToggle
              layerStatuses={layerStatuses}
              layerVisibility={layerVisibility}
              layers={toggleableLayers}
              onToggleLayer={updateLayerVisibility}
              viewMode={activeMode}
            />
          </div>
        </div>
      ) : null}

      {isMobile && mobilePanel === "legend" ? (
        <div className="atlas-mobile-overlay">
          <div className="atlas-mobile-panel">
            <div className="atlas-mobile-panel-head">
              <strong>Leyenda</strong>
              <button onClick={() => setMobilePanel(null)} type="button">
                Cerrar
              </button>
            </div>
            <MapLegend className="atlas-map-legend atlas-map-legend-inline" items={legendItems} />
          </div>
        </div>
      ) : null}

      <FeatureDetailPanel
        feature={detailFeature}
        isActive={Boolean(interactionState.activeDetailFeatureId)}
        onClose={handleDetailClose}
      >
        {activeMode === "coverage" ? (
          <>
            <div className="atlas-panel-head">
              <p className="eyebrow">Selección actual</p>
              <p className="atlas-selection-breadcrumb">
                <span>{coverageScopeLabel}</span>
                <span>{coveragePanelTitle}</span>
              </p>
              <h2>{coveragePanelTitle}</h2>
              <p>{coveragePanelSubtitle}</p>
            </div>

            <div className="atlas-panel-metrics">
              <div>
                <strong>{panel?.selection.metrics.visibleSpecies ?? "..."}</strong>
                <span>especies</span>
              </div>
              <div>
                <strong>{panel?.selection.metrics.visibleOccurrences ?? "..."}</strong>
                <span>registros</span>
              </div>
              <div>
                <strong>{panel?.selection.metrics.activeSources ?? "..."}</strong>
                <span>fuentes</span>
              </div>
            </div>

            <div className="atlas-note-stack">
              <span className="atlas-inline-note">
                {panel?.selection.sourceMeta.confidenceLabel ?? summary?.sourceMeta.confidenceLabel}
              </span>
              <span className="atlas-inline-note">
                {panel?.selection.sourceMeta.freshnessLabel ?? summary?.sourceMeta.freshnessLabel}
              </span>
            </div>

            <div className="atlas-panel-toolbar">
              <label>
                Orden
                <select
                  value={sort}
                  onChange={(event) => {
                    setPage(1);
                    setSort(event.target.value as MapSpeciesSort);
                  }}
                >
                  <option value="presence">Más visibles</option>
                  <option value="recent">Más recientes</option>
                  <option value="name">A-Z</option>
                </select>
              </label>
              <span>
                Página {panel?.pagination.page ?? 1} / {panel?.pagination.totalPages ?? 1}
              </span>
            </div>

            <div className="map-species-list">
              {panel?.species.length ? (
                panel.species.map((species) => (
                  <MapSpeciesCard
                    actionLabel="Ver cobertura"
                    hrefLabel="Abrir ficha"
                    key={species.speciesId}
                    onAction={() =>
                      activateSpeciesMode(species.slug, isFloraGroup(species.group) ? "flora" : "fauna")
                    }
                    species={species}
                  />
                ))
              ) : (
                <div className="empty-state">
                  No hay especies visibles con la selección actual. Ajusta el alcance territorial o los filtros.
                </div>
              )}
            </div>

            <div className="map-pagination">
              <button
                disabled={(panel?.pagination.page ?? 1) <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Anterior
              </button>
              <button
                disabled={(panel?.pagination.page ?? 1) >= (panel?.pagination.totalPages ?? 1)}
                onClick={() =>
                  setPage((current) =>
                    Math.min(panel?.pagination.totalPages ?? current, current + 1)
                  )
                }
                type="button"
              >
                Siguiente
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="atlas-panel-head">
              <p className="eyebrow">Especie en el mapa</p>
              <p className="atlas-selection-breadcrumb">
                <span>Especie</span>
                <span>{focusSpecies?.commonName ?? "Cargando"}</span>
              </p>
              <h2>{focusSpecies?.commonName ?? "Cargando especie"}</h2>
              <p>
                {focusSpecies?.scientificName ??
                  "Preparando la presencia pública generalizada en Guatemala."}
              </p>
            </div>

            {focusSpecies ? (
              <MapSpeciesCard hrefLabel="Abrir ficha completa" species={focusSpecies} />
            ) : (
              <div className="empty-state">Buscando una especie con cobertura pública disponible.</div>
            )}

            <div className="atlas-panel-metrics atlas-panel-metrics-quad">
              <div>
                <strong>{speciesPanel?.metrics.visibleDepartments ?? "..."}</strong>
                <span>departamentos</span>
              </div>
              <div>
                <strong>{speciesPanel?.metrics.visibleProtectedAreas ?? "..."}</strong>
                <span>áreas protegidas</span>
              </div>
              <div>
                <strong>{speciesPanel?.metrics.visibleCells ?? "..."}</strong>
                <span>celdas públicas</span>
              </div>
              <div>
                <strong>{speciesPanel?.metrics.activeSources ?? "..."}</strong>
                <span>fuentes</span>
              </div>
            </div>

            <div className="atlas-note-stack">
              <span className="atlas-inline-note">
                {speciesPanel?.sourceMeta.canonicalLabel ?? summary?.sourceMeta.canonicalLabel}
              </span>
              <span className="atlas-inline-note">
                {speciesPanel?.sourceMeta.confidenceLabel ?? summary?.sourceMeta.confidenceLabel}
              </span>
            </div>

            <div className="atlas-panel-subsection">
              <div className="atlas-panel-subhead">
                <strong>Zonas con presencia pública</strong>
                <span>Pulsa una región para volver al contexto territorial.</span>
              </div>
              <div className="atlas-place-list">
                {speciesPlaces.length ? (
                  speciesPlaces.slice(0, 10).map((place) => (
                    <button
                      className="atlas-place-card"
                      key={`${place.scopeType}-${place.scopeId}`}
                      onClick={() => {
                        switchMode("coverage");
                        updateFilter(
                          "region",
                          place.scopeType === "department" ? place.scopeId : "all"
                        );
                        selectCoverageScope(place.scopeType, place.scopeId, "list");
                      }}
                      type="button"
                    >
                      <strong>{place.title}</strong>
                      <span>{place.subtitle}</span>
                      <small>
                        {place.occurrenceCount} registros ·{" "}
                        {place.latestObservedAt ? place.latestObservedAt.slice(0, 4) : "sin fecha"}
                      </small>
                    </button>
                  ))
                ) : (
                  <div className="empty-state">
                    Esta especie no tiene regiones públicas visibles con los filtros actuales.
                  </div>
                )}
              </div>
            </div>

            <div className="atlas-panel-subsection">
              <div className="atlas-panel-subhead">
                <strong>Procedencia visible</strong>
                <span>Las marcas del mapa provienen solo de geometrías públicas generalizadas.</span>
              </div>
              <div className="badge-row">
                {(focusSpecies?.sourceTiers ?? []).map((tier, index) => (
                  <SourceBadge key={`${focusSpecies?.speciesId}-${tier}-${index}`} tier={tier} />
                ))}
              </div>
            </div>
          </>
        )}
      </FeatureDetailPanel>

      <MobileBottomSheet
        feature={detailFeature}
        onClose={handleDetailClose}
        open={Boolean(interactionState.activeDetailFeatureId)}
      >
        {activeMode === "coverage" ? (
          <>
            <p className="atlas-mobile-sheet-copy">{coveragePanelSubtitle}</p>
            <div className="atlas-panel-metrics">
              <div>
                <strong>{panel?.selection.metrics.visibleSpecies ?? "..."}</strong>
                <span>especies</span>
              </div>
              <div>
                <strong>{panel?.selection.metrics.visibleOccurrences ?? "..."}</strong>
                <span>registros</span>
              </div>
            </div>
            <div className="map-species-list">
              {(panel?.species ?? []).slice(0, 2).map((species) => (
                <MapSpeciesCard
                  actionLabel="Ver cobertura"
                  hrefLabel="Abrir ficha"
                  key={`mobile-${species.speciesId}`}
                  onAction={() =>
                    activateSpeciesMode(species.slug, isFloraGroup(species.group) ? "flora" : "fauna")
                  }
                  species={species}
                />
              ))}
            </div>
          </>
        ) : focusSpecies ? (
          <>
            <MapSpeciesCard hrefLabel="Abrir ficha completa" species={focusSpecies} />
            <div className="atlas-note-stack">
              <span className="atlas-inline-note">
                {speciesPanel?.sourceMeta.canonicalLabel ?? summary?.sourceMeta.canonicalLabel}
              </span>
              <span className="atlas-inline-note">
                {speciesPanel?.sourceMeta.confidenceLabel ?? summary?.sourceMeta.confidenceLabel}
              </span>
            </div>
          </>
        ) : (
          <div className="empty-state">Selecciona una geometría para abrir detalle móvil.</div>
        )}
      </MobileBottomSheet>
    </div>
  );
}
