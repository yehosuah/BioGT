"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { PickingInfo } from "@deck.gl/core";
import { GeoJsonLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { DeckGLProps } from "@deck.gl/react";
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Marker,
  NavigationControl,
  useControl,
  type MapRef
} from "react-map-gl/maplibre";

import { MapSpeciesCard } from "@/components/map-species-card";
import { SourceBadge } from "@/components/source-badge";
import { filtersToQueryString } from "@/lib/filters";
import type { MapFilters } from "@/lib/repository";
import type {
  MapFeatureCollection,
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

function DeckGLOverlay(props: DeckGLProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

type SelectionState = {
  scopeType: MapScopeType;
  scopeId: string;
};

type LayerName = "departments" | "protected_areas" | "public_hex" | "species_presence";

type LayerVisibility = {
  departments: boolean;
  protectedAreas: boolean;
  publicHex: boolean;
  speciesPresence: boolean;
  markers: boolean;
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

const defaultLayerVisibility: LayerVisibility = {
  departments: true,
  protectedAreas: true,
  publicHex: true,
  speciesPresence: true,
  markers: true
};

const scopeLabels: Record<MapScopeType, string> = {
  country: "País",
  department: "Departamento",
  protected_area: "Área protegida",
  public_hex: "Celda pública"
};

const formatBBox = (bounds: {
  getWest: () => number;
  getSouth: () => number;
  getEast: () => number;
  getNorth: () => number;
}) =>
  [
    bounds.getWest().toFixed(4),
    bounds.getSouth().toFixed(4),
    bounds.getEast().toFixed(4),
    bounds.getNorth().toFixed(4)
  ].join(",");

async function fetchSummary(filters: MapFilters) {
  const query = filtersToQueryString(filters);
  const response = await fetch(`/api/map/summary${query ? `?${query}` : ""}`);
  return (await response.json()) as MapSummaryResponse;
}

async function fetchLayer(layer: LayerName, filters: MapFilters, bbox?: string) {
  const params = new URLSearchParams(filtersToQueryString(filters));
  if (bbox) {
    params.set("bbox", bbox);
  }

  const response = await fetch(
    `/api/map/layers/${layer}${params.toString() ? `?${params.toString()}` : ""}`
  );
  return (await response.json()) as MapFeatureCollection;
}

async function fetchPanel({
  filters,
  page,
  scope,
  sort
}: {
  filters: MapFilters;
  page: number;
  scope: SelectionState;
  sort: MapSpeciesSort;
}) {
  const params = new URLSearchParams(filtersToQueryString(filters));
  params.set("scopeType", scope.scopeType);
  params.set("scopeId", scope.scopeId);
  params.set("sort", sort);
  params.set("page", String(page));
  params.set("pageSize", "6");
  const response = await fetch(`/api/map/panel?${params.toString()}`);
  return (await response.json()) as MapPanelResponse;
}

async function fetchSpeciesPanel(filters: MapFilters) {
  const params = new URLSearchParams(filtersToQueryString(filters));
  const response = await fetch(`/api/map/species-panel?${params.toString()}`);
  return (await response.json()) as MapSpeciesPanelResponse;
}

async function fetchMarkers({
  mode,
  filters,
  bbox,
  scope
}: {
  mode: MapMarkerMode;
  filters: MapFilters;
  bbox?: string;
  scope: SelectionState;
}) {
  const params = new URLSearchParams(filtersToQueryString(filters));
  params.set("mode", mode);
  params.set("scopeType", scope.scopeType);
  params.set("scopeId", scope.scopeId);
  if (bbox) {
    params.set("bbox", bbox);
  }

  const response = await fetch(`/api/map/markers?${params.toString()}`);
  return (await response.json()) as MapMarkerResponse;
}

async function fetchSearchResults(query: string) {
  const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
  return ((await response.json()) as { results: SearchResult[] }).results;
}

const isFloraGroup = (group: string) => group === "flora";

const formatScopeEyebrow = (scopeType: MapScopeType) => scopeLabels[scopeType];

const buildHoverLabel = (marker: MapSpeciesMarker) =>
  `${marker.label} · ${marker.occurrenceCount} registros públicos`;

function AtlasMarker({
  marker,
  mode,
  onClick,
  onHoverChange
}: {
  marker: MapSpeciesMarker;
  mode: MapViewMode;
  onClick: (marker: MapSpeciesMarker) => void;
  onHoverChange: (value: string | null) => void;
}) {
  return (
    <Marker
      anchor="bottom"
      key={marker.id}
      latitude={marker.point.latitude}
      longitude={marker.point.longitude}
    >
      <button
        className={`atlas-marker atlas-marker-${mode}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick(marker);
        }}
        onMouseEnter={() => onHoverChange(buildHoverLabel(marker))}
        onMouseLeave={() => onHoverChange(null)}
        type="button"
      >
        <span
          className={`atlas-marker-visual ${marker.visual.kind === "photo" ? "has-photo" : ""}`}
          style={
            marker.visual.kind === "photo" && marker.visual.src
              ? { backgroundImage: `url(${marker.visual.src})` }
              : { background: marker.visual.accent }
          }
        >
          {marker.visual.kind === "photo" ? null : marker.visual.fallbackLabel}
        </span>
        {mode === "coverage" ? (
          <span className="atlas-marker-copy">
            <strong>{marker.label}</strong>
            <small>{marker.occurrenceCount} registros</small>
          </span>
        ) : null}
        <span className="atlas-marker-count">{marker.occurrenceCount}</span>
      </button>
    </Marker>
  );
}

export function MapExplorer() {
  const mapRef = useRef<MapRef | null>(null);
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
  const [layers, setLayers] = useState<Record<LayerName, MapFeatureCollection | undefined>>({
    departments: undefined,
    protected_areas: undefined,
    public_hex: undefined,
    species_presence: undefined
  });
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(defaultLayerVisibility);
  const [zoom, setZoom] = useState(6.25);
  const [bbox, setBBox] = useState<string | undefined>(undefined);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const deferredFilters = useDeferredValue(filters);
  const deferredSelection = useDeferredValue(selection);
  const deferredSort = useDeferredValue(sort);
  const activeMode: MapViewMode = deferredFilters.viewMode ?? "coverage";
  const activeTaxonScope: TaxonScope = deferredFilters.taxonScope ?? "all";
  const activeTaxonSlug =
    deferredFilters.taxonSlug ?? speciesPanel?.focusSpecies.slug ?? panel?.species[0]?.slug;

  useEffect(() => {
    void (async () => {
      setSummary(await fetchSummary(deferredFilters));
    })();
  }, [deferredFilters]);

  useEffect(() => {
    void (async () => {
      if (activeMode === "species") {
        const [departments, protectedAreas, speciesPresence] = await Promise.all([
          fetchLayer("departments", deferredFilters, bbox),
          fetchLayer("protected_areas", deferredFilters, bbox),
          fetchLayer("species_presence", deferredFilters, bbox)
        ]);

        setLayers({
          departments,
          protected_areas: protectedAreas,
          public_hex: undefined,
          species_presence: speciesPresence
        });
        return;
      }

      const [departments, protectedAreas, publicHex] = await Promise.all([
        fetchLayer("departments", deferredFilters, bbox),
        fetchLayer("protected_areas", deferredFilters, bbox),
        fetchLayer("public_hex", deferredFilters, bbox)
      ]);

      setLayers({
        departments,
        protected_areas: protectedAreas,
        public_hex: publicHex,
        species_presence: undefined
      });
    })();
  }, [activeMode, bbox, deferredFilters]);

  useEffect(() => {
    if (activeMode !== "coverage") {
      return;
    }

    void (async () => {
      setPanel(
        await fetchPanel({
          filters: deferredFilters,
          page,
          scope: deferredSelection,
          sort: deferredSort
        })
      );
    })();
  }, [activeMode, deferredFilters, deferredSelection, deferredSort, page]);

  useEffect(() => {
    if (activeMode !== "species") {
      return;
    }

    void (async () => {
      setSpeciesPanel(await fetchSpeciesPanel(deferredFilters));
    })();
  }, [activeMode, deferredFilters]);

  useEffect(() => {
    void (async () => {
      const nextFilters =
        activeMode === "species" && activeTaxonSlug
          ? {
              ...deferredFilters,
              taxonSlug: activeTaxonSlug
            }
          : deferredFilters;

      const response = await fetchMarkers({
        mode: activeMode === "species" ? "species_presence" : "coverage_preview",
        filters: nextFilters,
        bbox,
        scope: deferredSelection
      });

      setMarkers(response.markers);
    })();
  }, [activeMode, activeTaxonSlug, bbox, deferredFilters, deferredSelection]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        setSearchResults(await fetchSearchResults(searchQuery));
      })();
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const deckLayers = useMemo(() => {
    const selectedMatches = (feature: { properties?: Record<string, unknown> }) =>
      selection.scopeId === String(feature.properties?.id ?? "") &&
      selection.scopeType === String(feature.properties?.kind ?? "");

    const departmentLayer = new GeoJsonLayer({
      id: "departments",
      data: layers.departments,
      autoHighlight: activeMode === "coverage",
      filled: true,
      pickable: activeMode === "coverage" && layerVisibility.departments,
      stroked: true,
      visible: layerVisibility.departments,
      lineWidthMinPixels: 1,
      getLineWidth: (feature: { properties?: Record<string, unknown> }) =>
        selectedMatches(feature) ? 3.4 : 1.2,
      getFillColor: (feature) =>
        activeMode === "coverage"
          ? selectedMatches(feature)
            ? [42, 96, 111, 118]
            : [64, 109, 122, zoom < 6.9 ? 34 : 18]
          : [64, 109, 122, 8],
      getLineColor: (feature) =>
        selectedMatches(feature) ? [17, 48, 58, 230] : [87, 112, 118, 144]
    });

    const protectedLayer = new GeoJsonLayer({
      id: "protected-areas",
      data: layers.protected_areas,
      autoHighlight: activeMode === "coverage",
      filled: true,
      pickable: activeMode === "coverage" && layerVisibility.protectedAreas,
      stroked: true,
      visible: layerVisibility.protectedAreas,
      lineWidthMinPixels: 1,
      getLineWidth: (feature: { properties?: Record<string, unknown> }) =>
        selectedMatches(feature) ? 2.8 : 1.2,
      getFillColor: (feature) =>
        selectedMatches(feature)
          ? [224, 188, 116, 174]
          : activeMode === "species"
            ? [203, 182, 128, 26]
            : [214, 191, 140, zoom >= 7 ? 74 : 34],
      getLineColor: (feature) =>
        selectedMatches(feature) ? [101, 76, 31, 220] : [142, 119, 74, 160]
    });

    const richnessLayer = new GeoJsonLayer({
      id: "public-hex",
      data: layers.public_hex,
      filled: true,
      pickable: activeMode === "coverage" && layerVisibility.publicHex,
      stroked: true,
      visible: activeMode === "coverage" && layerVisibility.publicHex,
      lineWidthMinPixels: 1,
      getLineWidth: (feature: { properties?: Record<string, unknown> }) =>
        selectedMatches(feature) ? 2.4 : 0.8,
      getFillColor: (feature) => {
        const richness = Number(feature.properties?.speciesCount ?? 0);
        const alpha = zoom < 6.8 ? 84 : zoom < 8 ? 118 : 154;
        const red = Math.min(230, 108 + richness * 14);
        return selectedMatches(feature)
          ? [240, 133, 92, 188]
          : [red, 128, 101, alpha];
      },
      getLineColor: (feature) =>
        selectedMatches(feature) ? [125, 62, 41, 255] : [151, 102, 81, 98]
    });

    const speciesPresenceLayer = new GeoJsonLayer({
      id: "species-presence",
      data: layers.species_presence,
      visible: activeMode === "species" && layerVisibility.speciesPresence,
      pickable: false,
      filled: true,
      stroked: true,
      lineWidthMinPixels: 1,
      getLineWidth: 1.1,
      getFillColor: () => [50, 122, 90, 70],
      getLineColor: () => [22, 82, 60, 180]
    });

    return activeMode === "species"
      ? [departmentLayer, protectedLayer, speciesPresenceLayer]
      : [departmentLayer, protectedLayer, richnessLayer];
  }, [activeMode, layerVisibility, layers, selection, zoom]);

  const updateFilter = (key: keyof MapFilters, value: string | boolean | undefined) => {
    startTransition(() => {
      setPage(1);
      setFilters((current) => ({
        ...current,
        [key]: value
      }));
    });
  };

  const updateLayerVisibility = (key: keyof LayerVisibility, value: boolean) => {
    setLayerVisibility((current) => ({
      ...current,
      [key]: value
    }));
  };

  const switchMode = (mode: MapViewMode) => {
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

  const resetExplorer = () => {
    startTransition(() => {
      setFilters(defaultFilters);
      setSelection({
        scopeType: "country",
        scopeId: "guatemala"
      });
      setPage(1);
      setSort("presence");
    });
    mapRef.current?.flyTo({ center: [-90.25, 15.68], zoom: 6.25, duration: 900 });
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

    if (result.type === "species") {
      const nextSpecies = panel?.species.find((species) => species.slug === result.slug);
      activateSpeciesMode(result.slug, nextSpecies && isFloraGroup(nextSpecies.group) ? "flora" : "fauna");
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

      setSelection(
        region
          ? {
              scopeType: region.scopeType,
              scopeId: region.id
            }
          : {
              scopeType: "country",
              scopeId: "guatemala"
            }
      );
      return;
    }

    window.location.assign(result.href);
  };

  const selectFeature = (info: PickingInfo) => {
    const featureId = info.object?.properties?.id;
    const featureKind = info.object?.properties?.kind;
    if (!featureId || !featureKind || activeMode !== "coverage") {
      return;
    }

    setPage(1);
    setSelection({
      scopeType: featureKind as MapScopeType,
      scopeId: String(featureId)
    });
  };

  const handleMarkerClick = (marker: MapSpeciesMarker) => {
    if (marker.mode === "coverage_preview") {
      activateSpeciesMode(marker.slug, isFloraGroup(marker.group) ? "flora" : "fauna");
      mapRef.current?.flyTo({
        center: [marker.point.longitude, marker.point.latitude],
        zoom: Math.max(zoom, 7.2),
        duration: 900
      });
      return;
    }

    switchMode("coverage");
    setPage(1);
    setSelection({
      scopeType: "public_hex",
      scopeId: marker.scopeRef.scopeId
    });
    updateFilter("region", "all");
    mapRef.current?.flyTo({
      center: [marker.point.longitude, marker.point.latitude],
      zoom: Math.max(zoom, 8.8),
      duration: 900
    });
  };

  const coveragePanelTitle = panel?.selection.title ?? "Guatemala";
  const coveragePanelSubtitle =
    panel?.selection.subtitle ?? "Preparando lectura territorial de la biodiversidad visible.";
  const speciesPlaces = speciesPanel?.places ?? [];
  const focusSpecies = speciesPanel?.focusSpecies;
  const coverageScopeLabel = formatScopeEyebrow(panel?.selection.scopeType ?? selection.scopeType);
  const activeModeCopy =
    activeMode === "coverage"
      ? "Explora territorios, compara riqueza pública y entra a especies representativas."
      : "Sigue una especie específica con presencia pública generalizada y cambia entre celdas o áreas.";

  return (
    <div className="atlas-workspace">
      <div className="atlas-topbar">
        <div className="atlas-topbar-copy">
          <p className="eyebrow">Explorador público</p>
          <h1>Mapa de biodiversidad pública</h1>
          <p>{summary?.subtitle ?? activeModeCopy}</p>
        </div>

        <div className="atlas-topbar-actions">
          <div className="atlas-search">
            <input
              aria-label="Buscar especies, áreas o fuentes"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar especie, área o fuente"
              type="search"
              value={searchQuery}
            />
            {searchResults.length ? (
              <div className="atlas-search-results">
                {searchResults.slice(0, 7).map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSearchSelection(result)}
                    type="button"
                  >
                    <strong>{result.title}</strong>
                    <span>
                      {result.type} · {result.subtitle}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

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
        </div>
      </div>

      <aside className="atlas-filter-rail">
        <section className="atlas-rail-section">
          <p className="atlas-section-label">Cobertura taxonómica</p>
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
        </section>

        <section className="atlas-rail-section">
          <div className="atlas-rail-section-head">
            <div>
              <p className="atlas-section-label">Selección</p>
              <strong>{coveragePanelTitle}</strong>
            </div>
            <button className="atlas-reset-link" onClick={resetExplorer} type="button">
              Reiniciar
            </button>
          </div>
          <p className="atlas-rail-copy">{activeModeCopy}</p>
        </section>

        <section className="atlas-rail-section">
          <p className="atlas-section-label">Filtros</p>
          <div className="atlas-filter-grid">
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

        <section className="atlas-rail-section">
          <p className="atlas-section-label">Capas del mapa</p>
          <div className="atlas-layer-list">
            <label className="atlas-toggle-row">
              <input
                checked={layerVisibility.departments}
                onChange={(event) => updateLayerVisibility("departments", event.target.checked)}
                type="checkbox"
              />
              <span>Departamentos</span>
            </label>
            <label className="atlas-toggle-row">
              <input
                checked={layerVisibility.protectedAreas}
                onChange={(event) => updateLayerVisibility("protectedAreas", event.target.checked)}
                type="checkbox"
              />
              <span>Áreas protegidas</span>
            </label>
            {activeMode === "coverage" ? (
              <label className="atlas-toggle-row">
                <input
                  checked={layerVisibility.publicHex}
                  onChange={(event) => updateLayerVisibility("publicHex", event.target.checked)}
                  type="checkbox"
                />
                <span>Riqueza pública</span>
              </label>
            ) : (
              <label className="atlas-toggle-row">
                <input
                  checked={layerVisibility.speciesPresence}
                  onChange={(event) => updateLayerVisibility("speciesPresence", event.target.checked)}
                  type="checkbox"
                />
                <span>Presencia pública</span>
              </label>
            )}
            <label className="atlas-toggle-row">
              <input
                checked={layerVisibility.markers}
                onChange={(event) => updateLayerVisibility("markers", event.target.checked)}
                type="checkbox"
              />
              <span>{activeMode === "coverage" ? "Especies destacadas" : "Marcadores de especie"}</span>
            </label>
          </div>
        </section>

        <section className="atlas-rail-section">
          <p className="atlas-section-label">Contexto público</p>
          <div className="atlas-note-stack">
            <span className="atlas-inline-note">{summary?.sourceMeta.canonicalLabel}</span>
            <span className="atlas-inline-note">{summary?.sourceMeta.confidenceLabel}</span>
            <span className="atlas-inline-note">{summary?.sourceMeta.optionalOverlayLabel}</span>
          </div>
        </section>
      </aside>

      <section className="atlas-stage">
        <div className="atlas-stage-summary">
          <div className="atlas-stage-summary-copy">
            <p className="atlas-selection-breadcrumb">
              <span>{scopeLabels[selection.scopeType]}</span>
              <span>{coveragePanelTitle}</span>
            </p>
            <p>{summary?.title ?? "BioGT / Atlas vivo de Guatemala"}</p>
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

        <div className="atlas-map-shell">
          <Map
            initialViewState={{ longitude: -90.25, latitude: 15.68, zoom }}
            mapStyle={
              process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
              "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
            }
            onMove={(event) => setZoom(event.viewState.zoom)}
            onMoveEnd={(event) => {
              setZoom(event.viewState.zoom);
              setBBox(formatBBox(event.target.getBounds()));
            }}
            ref={mapRef}
          >
            <NavigationControl position="top-right" />
            <DeckGLOverlay
              getTooltip={({ object }: PickingInfo) => {
                if (!object) {
                  return null;
                }

                if (String(object.properties?.kind ?? "") === "species_presence") {
                  return {
                    text: `${object.properties?.label}\n${object.properties?.occurrenceCount ?? 0} registros públicos`
                  };
                }

                return {
                  text: `${object.properties?.label}\n${object.properties?.speciesCount ?? 0} especies visibles`
                };
              }}
              layers={deckLayers}
              onClick={selectFeature}
              onHover={({ object }: PickingInfo) => {
                setHoveredLabel(object ? String(object.properties?.label ?? "") : null);
              }}
            />

            {layerVisibility.markers
              ? markers.map((marker) => (
                  <AtlasMarker
                    key={marker.id}
                    marker={marker}
                    mode={activeMode}
                    onClick={handleMarkerClick}
                    onHoverChange={setHoveredLabel}
                  />
                ))
              : null}
          </Map>

          <div className="atlas-map-legend">
            <span className="legend-item">
              <i className="legend-swatch legend-department" />
              Departamentos
            </span>
            <span className="legend-item">
              <i className="legend-swatch legend-protected" />
              Áreas protegidas
            </span>
            {activeMode === "coverage" ? (
              <>
                <span className="legend-item">
                  <i className="legend-swatch legend-public" />
                  Riqueza pública
                </span>
                <span className="legend-item">
                  <i className="legend-swatch legend-marker" />
                  Especies destacadas
                </span>
              </>
            ) : (
              <>
                <span className="legend-item">
                  <i className="legend-swatch legend-species" />
                  Presencia generalizada
                </span>
                <span className="legend-item">
                  <i className="legend-swatch legend-marker" />
                  Objetos de especie
                </span>
              </>
            )}
          </div>

          {hoveredLabel ? <div className="map-hover-badge">{hoveredLabel}</div> : null}
        </div>
      </section>

      <aside className="atlas-panel">
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
                        setSelection({
                          scopeType: place.scopeType,
                          scopeId: place.scopeId
                        });
                        updateFilter("region", place.scopeId);
                        setPage(1);
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
      </aside>
    </div>
  );
}
