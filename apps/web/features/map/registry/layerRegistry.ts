import type {
  MapLayerConfig,
  MapLayerId,
  MapLayerRegistry,
  MapLayerResolverContext,
  MapLayerVisibility
} from "@/features/map/core/MapTypes";

export type LayerVisibilityState = Record<MapLayerId, boolean>;

type LayerCollectionContext = MapLayerResolverContext & {
  toggles?: Partial<LayerVisibilityState>;
};

const isCoverageMode = (context: MapLayerResolverContext) => context.viewMode !== "species";

const layerRegistryConfig = {
  departments: {
    id: "departments",
    mapStyleKey: "departments",
    label: "Departamentos",
    description: "Máscara territorial base para lectura pública.",
    sourceId: "departments-source",
    dataKey: "departments",
    dataSource: {
      kind: "atlas-api-layer",
      endpoint: "/api/map/layers/departments",
      dataShape: "geojson"
    },
    geometryType: "polygon",
    layerKind: "fill",
    renderMode: "geojson",
    visibleByDefault: true,
    toggleable: true,
    interactive: true,
    selectable: true,
    showInLayerToggle: true,
    minZoom: 4,
    order: 10,
    requiredProperties: ["id", "kind", "label", "speciesCount"],
    optionalProperties: ["biodiversityLabel"],
    validation: {
      allowedGeometryTypes: ["Polygon", "MultiPolygon"]
    },
    labels: {
      textByProperty: "label",
      minZoom: 6.5
    },
    states: {
      loading: { message: "Cargando departamentos..." },
      empty: { message: "No hay departamentos disponibles." },
      error: { message: "No se pudieron cargar los departamentos.", severity: "error" },
      hidden: { message: "Departamentos ocultos por configuración." },
      invalid: { message: "Datos de departamentos inválidos.", severity: "warning" },
      unsupportedGeometry: { message: "Geometría de departamentos no soportada.", severity: "warning" },
      missingRequiredProperty: { message: "Faltan propiedades requeridas en departamentos.", severity: "warning" }
    },
    interactions: {
      onClick: "select",
      onHover: "preview",
      cursor: "pointer",
      tooltip: ({ feature }) =>
        `${feature?.properties?.label}\n${feature?.properties?.speciesCount ?? 0} especies visibles`
    },
    metadata: {
      legendIconId: "department-mask"
    },
    type: "polygon"
  },
  protected_areas: {
    id: "protected_areas",
    mapStyleKey: "protected_areas",
    label: "Áreas protegidas",
    description: "Delimitación pública de territorios protegidos.",
    sourceId: "protected-areas-source",
    dataKey: "protected_areas",
    dataSource: {
      kind: "atlas-api-layer",
      endpoint: "/api/map/layers/protected_areas",
      dataShape: "geojson"
    },
    geometryType: "polygon",
    layerKind: "fill",
    renderMode: "geojson",
    visibleByDefault: true,
    toggleable: true,
    interactive: true,
    selectable: true,
    showInLayerToggle: true,
    minZoom: 4,
    order: 20,
    requiredProperties: ["id", "kind", "label", "speciesCount"],
    optionalProperties: ["biodiversityLabel"],
    validation: {
      allowedGeometryTypes: ["Polygon", "MultiPolygon"]
    },
    labels: {
      textByProperty: "label",
      minZoom: 7
    },
    states: {
      loading: { message: "Cargando áreas protegidas..." },
      empty: { message: "No hay áreas protegidas visibles." },
      error: { message: "No se pudieron cargar las áreas protegidas.", severity: "error" },
      hidden: { message: "Áreas protegidas ocultas por configuración." },
      invalid: { message: "Datos de áreas protegidas inválidos.", severity: "warning" },
      unsupportedGeometry: { message: "Geometría de áreas protegidas no soportada.", severity: "warning" },
      missingRequiredProperty: { message: "Faltan propiedades requeridas en áreas protegidas.", severity: "warning" }
    },
    interactions: {
      onClick: "select",
      onHover: "preview",
      cursor: "pointer",
      tooltip: ({ feature }) =>
        `${feature?.properties?.label}\n${feature?.properties?.speciesCount ?? 0} especies visibles`
    },
    metadata: {
      legendIconId: "protected-area"
    },
    type: "polygon"
  },
  public_hex: {
    id: "public_hex",
    mapStyleKey: "public_hex",
    label: "Celdas generalizadas",
    description: "Celdas públicas agregadas para lectura fina sin exponer coordenadas sensibles.",
    sourceId: "public-hex-source",
    dataKey: "public_hex",
    dataSource: {
      kind: "atlas-api-layer",
      endpoint: "/api/map/layers/public_hex",
      dataShape: "geojson",
      modes: ["coverage"]
    },
    geometryType: "polygon",
    layerKind: "fill",
    renderMode: "geojson",
    visibleByDefault: true,
    toggleable: true,
    interactive: true,
    selectable: true,
    showInLayerToggle: true,
    toggleInModes: ["coverage"],
    visibilityRule: (context) => isCoverageMode(context) && Boolean(context.showRichnessCells),
    minZoom: 7.15,
    order: 30,
    requiredProperties: ["id", "kind", "label", "speciesCount", "protectedCount", "sourceCount"],
    optionalProperties: ["biodiversityLabel", "visibility"],
    validation: {
      allowedGeometryTypes: ["Polygon", "MultiPolygon"]
    },
    labels: {
      textByProperty: "biodiversityLabel",
      minZoom: 8.5
    },
    states: {
      loading: { message: "Cargando celdas generalizadas..." },
      empty: { message: "No hay celdas públicas disponibles." },
      error: { message: "No se pudieron cargar las celdas públicas.", severity: "error" },
      hidden: { message: "Celdas públicas ocultas a esta escala." },
      invalid: { message: "Datos de celdas públicas inválidos.", severity: "warning" },
      unsupportedGeometry: { message: "Geometría de celdas públicas no soportada.", severity: "warning" },
      missingRequiredProperty: { message: "Faltan propiedades requeridas en celdas públicas.", severity: "warning" }
    },
    interactions: {
      onClick: "select",
      onHover: "preview",
      cursor: "pointer",
      tooltip: ({ feature }) =>
        `${feature?.properties?.label}\n${feature?.properties?.speciesCount ?? 0} especies visibles`
    },
    metadata: {
      legendIconId: "public-cell"
    },
    type: "polygon"
  },
  species_presence: {
    id: "species_presence",
    mapStyleKey: "species_presence",
    label: "Presencia pública",
    description: "Huella pública agregada de especie activa.",
    sourceId: "species-presence-source",
    dataKey: "species_presence",
    dataSource: {
      kind: "atlas-api-layer",
      endpoint: "/api/map/layers/species_presence",
      dataShape: "geojson",
      modes: ["species"]
    },
    geometryType: "polygon",
    layerKind: "fill",
    renderMode: "geojson",
    visibleByDefault: true,
    toggleable: true,
    interactive: true,
    selectable: false,
    showInLayerToggle: true,
    toggleInModes: ["species"],
    visibilityRule: (context) => context.viewMode === "species",
    minZoom: 6,
    order: 40,
    requiredProperties: ["id", "kind", "label", "occurrenceCount"],
    optionalProperties: ["speciesCount", "biodiversityLabel"],
    validation: {
      allowedGeometryTypes: ["Polygon", "MultiPolygon"]
    },
    labels: {
      textByProperty: "label",
      minZoom: 8
    },
    states: {
      loading: { message: "Cargando presencia pública..." },
      empty: { message: "No hay presencia pública para especie activa." },
      error: { message: "No se pudo cargar presencia pública.", severity: "error" },
      hidden: { message: "Presencia pública oculta por configuración." },
      invalid: { message: "Datos de presencia pública inválidos.", severity: "warning" },
      unsupportedGeometry: { message: "Geometría de presencia pública no soportada.", severity: "warning" },
      missingRequiredProperty: { message: "Faltan propiedades requeridas en presencia pública.", severity: "warning" }
    },
    interactions: {
      onClick: "open-detail-panel",
      onHover: "preview",
      cursor: "pointer",
      tooltip: ({ feature }) =>
        `${feature?.properties?.label}\n${feature?.properties?.occurrenceCount ?? 0} registros públicos`
    },
    metadata: {
      legendIconId: "species-presence"
    },
    type: "polygon"
  },
  species_markers: {
    id: "species_markers",
    mapStyleKey: "species_markers",
    label: ({ viewMode }) => (viewMode === "species" ? "Marcadores de especie" : "Especies destacadas"),
    description: ({ viewMode }) =>
      viewMode === "species"
        ? "Marcadores generalizados para navegación por especie."
        : "Marcadores destacados para abrir modo especie desde cobertura.",
    sourceId: "species-markers-source",
    dataKey: "markers",
    dataSource: {
      kind: "atlas-api-markers",
      endpoint: "/api/map/markers",
      dataShape: "marker-list"
    },
    geometryType: "point",
    layerKind: "symbol",
    renderMode: "marker-overlay",
    visibleByDefault: true,
    toggleable: true,
    interactive: true,
    selectable: true,
    showInLayerToggle: true,
    minZoom: 5,
    order: 50,
    requiredProperties: ["id", "slug", "label", "group", "mode", "point"],
    optionalProperties: ["occurrenceCount", "visual"],
    states: {
      loading: { message: "Cargando marcadores..." },
      empty: { message: "No hay marcadores para vista actual." },
      error: { message: "No se pudieron cargar los marcadores.", severity: "error" },
      hidden: { message: "Marcadores ocultos por configuración." },
      invalid: { message: "Datos de marcadores inválidos.", severity: "warning" },
      unsupportedGeometry: { message: "Marcadores no tienen geometría soportada.", severity: "warning" },
      missingRequiredProperty: { message: "Faltan propiedades requeridas en marcadores.", severity: "warning" }
    },
    icons: {
      iconId: ({ viewMode }) => (viewMode === "species" ? "default-place" : "search-result"),
      fallbackIcon: "default-place"
    },
    labels: {
      text: ({ viewMode }) =>
        viewMode === "species" ? "Marcadores de especie" : "Especies destacadas"
    },
    interactions: {
      onClick: "open-detail-panel",
      onHover: "preview",
      cursor: "pointer"
    },
    metadata: {
      legendIconId: "search-result"
    },
    type: "point"
  }
} satisfies MapLayerRegistry;

export const layerRegistry = layerRegistryConfig;

const registryValues = (registry: MapLayerRegistry = layerRegistry) => Object.values(registry);

const matchesLayerMode = (layer: MapLayerConfig, viewMode?: string) =>
  !viewMode || !layer.toggleInModes?.length || layer.toggleInModes.includes(viewMode);

export const getLayerConfig = (
  layerId: string,
  registry: MapLayerRegistry = layerRegistry
): MapLayerConfig | null => registry[layerId] ?? null;

export const getOrderedLayers = (registry: MapLayerRegistry = layerRegistry): MapLayerConfig[] =>
  registryValues(registry).sort((left, right) => left.order - right.order);

export const getRenderableGeoJsonLayers = (
  registry: MapLayerRegistry = layerRegistry
): MapLayerConfig[] => getOrderedLayers(registry).filter((layer) => layer.renderMode === "geojson");

export const getSourceManagedLayers = (
  registry: MapLayerRegistry = layerRegistry,
  viewMode?: string
): MapLayerConfig[] =>
  getOrderedLayers(registry).filter((layer) => {
    if (!layer.dataSource.endpoint) {
      return false;
    }

    if (!viewMode || !layer.dataSource.modes?.length) {
      return true;
    }

    return layer.dataSource.modes.includes(viewMode);
  });

export const createLayerVisibilityState = (
  registry: MapLayerRegistry = layerRegistry
): LayerVisibilityState =>
  getOrderedLayers(registry).reduce<LayerVisibilityState>((accumulator, layer) => {
    if (layer.toggleable) {
      accumulator[layer.id] = layer.visibleByDefault;
    }
    return accumulator;
  }, {});

export const isLayerVisibleAtZoom = (layer: MapLayerConfig, zoom?: number) => {
  if (typeof zoom !== "number") {
    return true;
  }

  if (typeof layer.minZoom === "number" && zoom < layer.minZoom) {
    return false;
  }

  if (typeof layer.maxZoom === "number" && zoom > layer.maxZoom) {
    return false;
  }

  return true;
};

export const getToggleableLayers = (
  registry: MapLayerRegistry = layerRegistry,
  context: MapLayerResolverContext = {}
): MapLayerConfig[] =>
  getOrderedLayers(registry).filter(
    (layer) =>
      layer.toggleable &&
      layer.showInLayerToggle !== false &&
      matchesLayerMode(layer, context.viewMode)
  );

export const getInteractiveLayers = (
  registry: MapLayerRegistry = layerRegistry,
  context: MapLayerResolverContext = {}
): MapLayerConfig[] =>
  getOrderedLayers(registry).filter(
    (layer) => layer.interactive && matchesLayerMode(layer, context.viewMode)
  );

export const getVisibleLayers = (
  registry: MapLayerRegistry = layerRegistry,
  context: LayerCollectionContext = {}
): MapLayerConfig[] =>
  getOrderedLayers(registry).filter((layer) => {
    const toggleVisible = context.toggles?.[layer.id] ?? layer.visibleByDefault;
    if (!toggleVisible) {
      return false;
    }

    if (!matchesLayerMode(layer, context.viewMode)) {
      return false;
    }

    if (!isLayerVisibleAtZoom(layer, context.zoom)) {
      return false;
    }

    if (layer.visibilityRule && !layer.visibilityRule(context)) {
      return false;
    }

    return true;
  });

export const toMapLayerVisibility = (visible: boolean): MapLayerVisibility =>
  visible ? "visible" : "hidden";

export const layerRegistryList = getOrderedLayers(layerRegistry);
