import { UNGROUPED_PROPERTY_KEY } from "@/features/map/data/geo/constants";
import type { BaseMapProperties, MapFeature, MapFeatureCollection } from "@/features/map/data/geo/types";

export function filterFeatureCollection(
  collection: MapFeatureCollection,
  predicate: (feature: MapFeature, index: number) => boolean
): MapFeatureCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.filter(predicate)
  };
}

export function groupFeaturesByProperty(
  collection: MapFeatureCollection,
  propertyName: keyof BaseMapProperties | string
): Record<string, MapFeature[]> {
  return collection.features.reduce<Record<string, MapFeature[]>>((groups, feature) => {
    const rawValue = feature.properties[propertyName];
    const groupKey =
      typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean"
        ? String(rawValue)
        : UNGROUPED_PROPERTY_KEY;

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }

    groups[groupKey].push(feature);
    return groups;
  }, {});
}
