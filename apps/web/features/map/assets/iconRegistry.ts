import { iconMetadata } from "@/features/map/assets/iconMetadata";
import type { MapIconFeatureLike, MapIconId, MapIconMetadata } from "@/features/map/assets/iconTypes";

const categoryMap: Record<string, MapIconId> = {
  restaurant: "restaurant",
  food: "restaurant",
  dining: "restaurant",
  cafe: "restaurant",
  service: "service",
  poi: "service",
  "point-of-interest": "service",
  amenity: "service",
  department: "department-mask",
  "protected_area": "protected-area",
  "protected-area": "protected-area",
  public_hex: "public-cell",
  "public-cell": "public-cell",
  species_presence: "species-presence",
  "species-presence": "species-presence"
};

const alertStates = new Set(["alert", "danger", "error", "critical"]);

const normalize = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "-") : undefined;

const readFeatureValue = (feature: MapIconFeatureLike, key: string) => {
  if ("properties" in feature) {
    return feature.properties?.[key];
  }
  return feature[key as keyof typeof feature];
};

const readBoolean = (feature: MapIconFeatureLike, key: string) => readFeatureValue(feature, key) === true;

const readText = (feature: MapIconFeatureLike, ...keys: string[]) => {
  for (const key of keys) {
    const value = normalize(readFeatureValue(feature, key));
    if (value) {
      return value;
    }
  }
  return undefined;
};

export const getMapIcon = (iconId: string | null | undefined): MapIconMetadata => {
  if (!iconId) {
    return iconMetadata["default-place"];
  }

  return iconMetadata[iconId as MapIconId] ?? iconMetadata["default-place"];
};

export const getIconMetadata = getMapIcon;

export const getIconForCategory = (category: string | null | undefined): MapIconMetadata => {
  const normalized = normalize(category);
  if (!normalized) {
    return iconMetadata["default-place"];
  }

  return getMapIcon(categoryMap[normalized] ?? "default-place");
};

export const getIconForFeature = (feature: MapIconFeatureLike): MapIconMetadata => {
  const explicit = readText(feature, "iconId");
  if (explicit && explicit in iconMetadata) {
    return getMapIcon(explicit);
  }

  if (readBoolean(feature, "selected")) {
    return iconMetadata["selected-place"];
  }

  if (readBoolean(feature, "isUserLocation")) {
    return iconMetadata["user-location"];
  }

  if (readBoolean(feature, "isCluster")) {
    return iconMetadata.cluster;
  }

  if (readBoolean(feature, "isRouteStart") || readText(feature, "type", "kind") === "route-start") {
    return iconMetadata["route-start"];
  }

  if (readBoolean(feature, "isRouteEnd") || readText(feature, "type", "kind") === "route-end") {
    return iconMetadata["route-end"];
  }

  const status = readText(feature, "status");
  const priority = readText(feature, "priority");
  if ((status && alertStates.has(status)) || priority === "high") {
    return iconMetadata.alert;
  }

  const mode = readText(feature, "mode");
  if (mode === "coverage_preview") {
    return iconMetadata["search-result"];
  }

  const type = readText(feature, "type", "kind");
  if (type && type in categoryMap) {
    return getMapIcon(categoryMap[type]);
  }

  const category = readText(feature, "category");
  if (category) {
    return getIconForCategory(category);
  }

  return iconMetadata["default-place"];
};
