import { iconDefinitions } from "@/features/map/assets/iconDefinitions";
import type { MapIconId, MapIconMetadata } from "@/features/map/assets/iconTypes";
import { mapTokens } from "@/features/map/styles/mapTokens";

const assetPath = (name: string) => `apps/web/assets/map-icons/optimized/${name}.svg`;

export const iconMetadata: Record<MapIconId, MapIconMetadata> = {
  "default-place": {
    id: "default-place",
    label: "Lugar",
    role: "marker",
    defaultSize: mapTokens.sizes.marker.sm + 4,
    colorMode: "currentColor",
    accessibilityLabel: "Lugar en mapa",
    assetPath: assetPath("default-place"),
    definition: iconDefinitions["default-place"],
    providerHints: { anchor: "bottom", prefersDomMarker: true }
  },
  "selected-place": {
    id: "selected-place",
    label: "Lugar seleccionado",
    role: "marker",
    defaultSize: mapTokens.sizes.marker.md,
    colorMode: "currentColor",
    accessibilityLabel: "Lugar seleccionado en mapa",
    assetPath: assetPath("selected-place"),
    definition: iconDefinitions["selected-place"],
    providerHints: { anchor: "bottom", prefersDomMarker: true }
  },
  "route-start": {
    id: "route-start",
    label: "Inicio de ruta",
    role: "route",
    defaultSize: mapTokens.sizes.marker.sm + 2,
    colorMode: "currentColor",
    accessibilityLabel: "Inicio de ruta",
    assetPath: assetPath("route-start"),
    definition: iconDefinitions["route-start"],
    providerHints: { anchor: "center" }
  },
  "route-end": {
    id: "route-end",
    label: "Fin de ruta",
    role: "route",
    defaultSize: mapTokens.sizes.marker.sm + 2,
    colorMode: "currentColor",
    accessibilityLabel: "Fin de ruta",
    assetPath: assetPath("route-end"),
    definition: iconDefinitions["route-end"],
    providerHints: { anchor: "center" }
  },
  alert: {
    id: "alert",
    label: "Alerta",
    role: "status",
    defaultSize: mapTokens.sizes.marker.sm + 2,
    colorMode: "currentColor",
    accessibilityLabel: "Alerta",
    assetPath: assetPath("alert"),
    definition: iconDefinitions.alert,
    providerHints: { anchor: "center" }
  },
  "search-result": {
    id: "search-result",
    label: "Resultado",
    role: "marker",
    defaultSize: mapTokens.sizes.marker.sm + 4,
    colorMode: "currentColor",
    accessibilityLabel: "Resultado de búsqueda en mapa",
    assetPath: assetPath("search-result"),
    definition: iconDefinitions["search-result"],
    providerHints: { anchor: "bottom", prefersDomMarker: true }
  },
  "user-location": {
    id: "user-location",
    label: "Ubicación",
    role: "control",
    defaultSize: mapTokens.sizes.marker.sm + 2,
    colorMode: "currentColor",
    accessibilityLabel: "Ubicación de usuario",
    assetPath: assetPath("user-location"),
    definition: iconDefinitions["user-location"],
    providerHints: { anchor: "center" }
  },
  cluster: {
    id: "cluster",
    label: "Grupo",
    role: "marker",
    defaultSize: mapTokens.sizes.marker.sm + 2,
    colorMode: "currentColor",
    accessibilityLabel: "Grupo de marcadores",
    assetPath: assetPath("cluster"),
    definition: iconDefinitions.cluster,
    providerHints: { anchor: "center", prefersDomMarker: true }
  },
  restaurant: {
    id: "restaurant",
    label: "Restaurante",
    role: "marker",
    defaultSize: mapTokens.sizes.marker.sm + 2,
    colorMode: "currentColor",
    accessibilityLabel: "Restaurante",
    assetPath: assetPath("restaurant"),
    definition: iconDefinitions.restaurant,
    providerHints: { anchor: "bottom", prefersDomMarker: true }
  },
  service: {
    id: "service",
    label: "Servicio",
    role: "marker",
    defaultSize: mapTokens.sizes.marker.sm + 2,
    colorMode: "currentColor",
    accessibilityLabel: "Servicio o punto de interés",
    assetPath: assetPath("service"),
    definition: iconDefinitions.service,
    providerHints: { anchor: "bottom", prefersDomMarker: true }
  },
  "department-mask": {
    id: "department-mask",
    label: "Máscara departamental",
    role: "legend",
    defaultSize: 12,
    colorMode: "fixed",
    accessibilityLabel: "Máscara departamental",
    legendSwatch: {
      type: "fill",
      fill: "rgba(94, 133, 122, 0.85)",
      stroke: "rgba(95, 118, 111, 0.7)"
    }
  },
  "protected-area": {
    id: "protected-area",
    label: "Áreas protegidas",
    role: "legend",
    defaultSize: 12,
    colorMode: "fixed",
    accessibilityLabel: "Áreas protegidas",
    legendSwatch: {
      type: "fill",
      fill: "rgba(200, 183, 132, 0.9)",
      stroke: "rgba(145, 122, 72, 0.7)"
    }
  },
  "public-cell": {
    id: "public-cell",
    label: "Celdas generalizadas",
    role: "legend",
    defaultSize: 12,
    colorMode: "fixed",
    accessibilityLabel: "Celdas generalizadas",
    legendSwatch: {
      type: "fill",
      fill: "rgba(100, 138, 111, 0.92)",
      stroke: "rgba(91, 116, 99, 0.72)"
    }
  },
  "species-presence": {
    id: "species-presence",
    label: "Presencia generalizada",
    role: "legend",
    defaultSize: 12,
    colorMode: "fixed",
    accessibilityLabel: "Presencia generalizada",
    legendSwatch: {
      type: "fill",
      fill: "rgba(50, 122, 90, 0.9)",
      stroke: "rgba(22, 82, 60, 0.72)"
    }
  }
};
