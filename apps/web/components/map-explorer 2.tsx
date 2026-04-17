"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { PickingInfo } from "@deck.gl/core";
import { GeoJsonLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { DeckGLProps } from "@deck.gl/react";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import Map, { NavigationControl, useControl } from "react-map-gl/maplibre";

import { MapSpeciesCard } from "@/components/map-species-card";
import { PretextTitle } from "@/components/pretext-title";
import { filtersToQueryString } from "@/lib/filters";
import type { MapFilters } from "@/lib/repository";
import type {
  MapFeatureCollection,
  MapPanelResponse,
  MapScopeType,
  MapSpeciesSort
} from "@/lib/types";

function DeckGLOverlay(props: DeckGLProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

type SummaryPayload = Awaited<ReturnType<typeof fetchSummary>>;
type SelectionState = {
  scopeType: MapScopeType;
  scopeId: string;
};

async function fetchSummary(filters: MapFilters) {
  const query = filtersToQueryString(filters);
  const response = await fetch(`/api/map/summary${query ? `?${query}` : ""}`);
  return (await response.json()) as {
    metrics: {
      visibleSpecies: number;
      visibleOccurrences: number;
      activeSources: number;
    };
    filterOptions: {
      groups: string[];
      sourceTiers: string[];
      regions: Array<{ id: string; label: string; scopeType: MapScopeType }>;
      elevationBands: string[];
      dateRanges: string[];
    };
  };
}

async function fetchLayer(
  layer: "departments" | "protected_areas" | "public_hex",
  filters: MapFilters
) {
  const query = filtersToQueryString(filters);
  const response = await fetch(`/api/map/layers/${layer}${query ? `?${query}` : ""}`);
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

export function MapExplorer() {
  const [filters, setFilters] = useState<MapFilters>({
    group: "all",
    sourceTier: "all",
    region: "all",
    elevationBand: "all",
    dateRange: "all",
    protectedOnly: false
  });
  const [selection, setSelection] = useState<SelectionState>({
    scopeType: "country",
    scopeId: "guatemala"
  });
  const [sort, setSort] = useState<MapSpeciesSort>("presence");
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [panel, setPanel] = useState<MapPanelResponse | null>(null);
  const [layers, setLayers] = useState<{
    departments?: MapFeatureCollection;
    protected_areas?: MapFeatureCollection;
    public_hex?: MapFeatureCollection;
  }>({});
  const [zoom, setZoom] = useState(6.2);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const deferredFilters = useDeferredValue(filters);
  const deferredSelection = useDeferredValue(selection);
  const deferredSort = useDeferredValue(sort);

  useEffect(() => {
    void (async () => {
      const [nextSummary, departments, protectedAreas, publicHex] = await Promise.all([
        fetchSummary(deferredFilters),
        fetchLayer("departments", deferredFilters),
        fetchLayer("protected_areas", deferredFilters),
        fetchLayer("public_hex", deferredFilters)
      ]);

      setSummary(nextSummary);
      setLayers({
        departments,
        protected_areas: protectedAreas,
        public_hex: publicHex
      });
    })();
  }, [deferredFilters]);

  useEffect(() => {
    void (async () => {
      const nextPanel = await fetchPanel({
        filters: deferredFilters,
        page,
        scope: deferredSelection,
        sort: deferredSort
      });
      setPanel(nextPanel);
    })();
  }, [deferredFilters, deferredSelection, deferredSort, page]);

  const deckLayers = useMemo(() => {
    const selectedMatches = (feature: { properties?: Record<string, unknown> }) =>
      selection.scopeId === String(feature.properties?.id ?? "") &&
      selection.scopeType === String(feature.properties?.kind ?? "");

    const sharedStroke = {
      autoHighlight: true,
      filled: true,
      getLineWidth: (feature: { properties?: Record<string, unknown> }) =>
        selectedMatches(feature) ? 4 : 2,
      lineWidthMinPixels: 1,
      pickable: true,
      stroked: true
    };

    return [
      new GeoJsonLayer({
        id: "departments",
        data: layers.departments,
        visible: zoom < 7.15,
        getFillColor: (feature) =>
          selectedMatches(feature)
            ? [18, 78, 92, 200]
            : [36, 90, 96, 140],
        getLineColor: (feature) =>
          selectedMatches(feature)
            ? [245, 244, 235, 255]
            : [9, 35, 39, 220],
        ...sharedStroke
      }),
      new GeoJsonLayer({
        id: "protected-areas",
        data: layers.protected_areas,
        visible: zoom >= 6.5 && zoom < 8.9,
        getFillColor: (feature) =>
          selectedMatches(feature)
            ? [168, 112, 17, 215]
            : [219, 168, 72, 170],
        getLineColor: (feature) =>
          selectedMatches(feature)
            ? [255, 248, 233, 255]
            : [104, 65, 15, 230],
        ...sharedStroke
      }),
      new GeoJsonLayer({
        id: "public-hex",
        data: layers.public_hex,
        visible: zoom >= 8.2,
        getFillColor: (feature) => {
          const richness = Number(feature.properties?.speciesCount ?? 0);
          const selected = selectedMatches(feature);
          const intensity = Math.min(235, 92 + richness * 36);
          return selected
            ? [143, 57, 67, 235]
            : [intensity, 78, 84, 205];
        },
        getLineColor: (feature) =>
          selectedMatches(feature)
            ? [255, 244, 238, 255]
            : [96, 25, 34, 160],
        ...sharedStroke
      })
    ];
  }, [layers, selection, zoom]);

  const updateFilter = (key: keyof MapFilters, value: string | boolean) => {
    startTransition(() => {
      setPage(1);
      setFilters((current) => ({
        ...current,
        [key]: value
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

  const selectFeature = (info: PickingInfo) => {
    const featureId = info.object?.properties?.id;
    const featureKind = info.object?.properties?.kind;
    if (!featureId || !featureKind) {
      return;
    }

    setPage(1);
    setSelection({
      scopeType: featureKind as MapScopeType,
      scopeId: String(featureId)
    });
  };

  return (
    <div className="map-workbench">
      <section className="map-stage-shell">
        <div className="map-stage-head">
          <div className="map-stage-copy">
            <p className="eyebrow">Explorador público</p>
            <PretextTitle
              as="h2"
              className="map-stage-title"
              font='600 44px "Fraunces"'
              lineHeight={48}
              maxWidth={620}
              minWidth={260}
              text="Flora y fauna visibles por región"
            />
            <p>
              El mapa prioriza cobertura institucional y oficial: departamentos en
              la vista amplia, áreas protegidas en el zoom intermedio y celdas
              públicas al acercarse.
            </p>
          </div>

          <div className="map-metric-strip">
            <div>
              <strong>{summary?.metrics.visibleSpecies ?? "..."}</strong>
              <span>especies canónicas</span>
            </div>
            <div>
              <strong>{summary?.metrics.visibleOccurrences ?? "..."}</strong>
              <span>registros visibles</span>
            </div>
            <div>
              <strong>{summary?.metrics.activeSources ?? "..."}</strong>
              <span>fuentes activas</span>
            </div>
          </div>
        </div>

        <div className="map-controls-card">
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
            Región
            <select value={filters.region} onChange={(event) => updateRegion(event.target.value)}>
              <option value="all">all</option>
              {(summary?.filterOptions.regions ?? []).map((region) => (
                <option key={region.id} value={region.id}>
                  {region.label}
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

          <label className="checkbox-row">
            <input
              checked={filters.protectedOnly ?? false}
              onChange={(event) => updateFilter("protectedOnly", event.target.checked)}
              type="checkbox"
            />
            Solo cobertura protegida
          </label>
        </div>

        <div className="map-canvas-shell">
          <Map
            initialViewState={{ longitude: -90.4, latitude: 15.7, zoom }}
            mapStyle={
              process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
              "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
            }
            onMove={(event) => setZoom(event.viewState.zoom)}
          >
            <NavigationControl position="top-right" />
            <DeckGLOverlay
              getTooltip={({ object }: PickingInfo) => {
                if (!object) {
                  return null;
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
          </Map>

          <div className="map-legend">
            <span className="legend-item">
              <i className="legend-swatch legend-department" />
              Departamentos
            </span>
            <span className="legend-item">
              <i className="legend-swatch legend-protected" />
              Áreas protegidas
            </span>
            <span className="legend-item">
              <i className="legend-swatch legend-public" />
              Celdas públicas
            </span>
          </div>

          {hoveredLabel ? <div className="map-hover-badge">{hoveredLabel}</div> : null}
        </div>
      </section>

      <aside className="map-panel">
        <div className="map-panel-head">
          <p className="eyebrow">Selección actual</p>
          <PretextTitle
            as="h3"
            className="map-panel-title"
            font='600 36px "Fraunces"'
            lineHeight={40}
            maxWidth={420}
            minWidth={220}
            text={panel?.selection.title ?? "Cargando selección"}
          />
          <p>{panel?.selection.subtitle ?? "Preparando resumen territorial..."}</p>

          <div className="map-panel-metrics">
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
        </div>

        <div className="map-panel-toolbar">
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
            panel.species.map((species) => <MapSpeciesCard key={species.speciesId} species={species} />)
          ) : (
            <div className="empty-state">
              No hay especies visibles con los filtros y la selección actual.
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
      </aside>
    </div>
  );
}
