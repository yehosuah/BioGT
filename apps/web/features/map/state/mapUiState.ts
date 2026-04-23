import type { MapFeatureId } from "@/features/map/core/MapTypes";
import type { MapScopeType, SearchResult } from "@/lib/types";

export type FeatureMetadataRow = {
  label: string;
  value: string;
};

type SelectedFeatureBase = {
  key: string;
  featureId: MapFeatureId | null;
  layerId?: string | null;
  title: string;
  subtitle?: string | null;
  summary?: string | null;
  category?: string | null;
  status?: string | null;
  metadata: FeatureMetadataRow[];
};

export type SelectedAreaFeature = SelectedFeatureBase & {
  kind: "area";
  scopeType: MapScopeType;
  scopeId: string;
};

export type SelectedSpeciesFeature = SelectedFeatureBase & {
  kind: "species";
  slug: string;
  scientificName?: string | null;
};

export type SelectedMapFeature = SelectedAreaFeature | SelectedSpeciesFeature;

const isPresentValue = (value: unknown) =>
  value !== null && value !== undefined && !(typeof value === "string" && value.trim().length === 0);

const toMetadataValue = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
};

export const toMetadataRows = (values: Record<string, unknown>): FeatureMetadataRow[] =>
  Object.entries(values).flatMap(([label, rawValue]) => {
    const value = toMetadataValue(rawValue);
    return value && isPresentValue(value) ? [{ label, value }] : [];
  });

export const mergeMetadataRows = (
  existing: FeatureMetadataRow[],
  extra: Record<string, unknown>
): FeatureMetadataRow[] => {
  const merged = new Map(existing.map((entry) => [entry.label, entry.value]));
  toMetadataRows(extra).forEach((entry) => {
    merged.set(entry.label, entry.value);
  });

  return Array.from(merged.entries()).map(([label, value]) => ({
    label,
    value
  }));
};

export const selectFeature = (
  _current: SelectedMapFeature | null,
  next: SelectedMapFeature
): SelectedMapFeature => next;

export const clearSelectedFeature = (_current: SelectedMapFeature | null) => null;

export const buildAreaSelectedFeature = ({
  featureId,
  layerId,
  scopeType,
  scopeId,
  title,
  subtitle,
  summary,
  category,
  status,
  properties
}: {
  featureId: MapFeatureId | null;
  layerId?: string | null;
  scopeType: MapScopeType;
  scopeId: string;
  title: string;
  subtitle?: string | null;
  summary?: string | null;
  category?: string | null;
  status?: string | null;
  properties: Record<string, unknown>;
}): SelectedAreaFeature => ({
  kind: "area",
  key: `area:${scopeType}:${scopeId}`,
  featureId,
  layerId: layerId ?? null,
  scopeType,
  scopeId,
  title,
  subtitle: subtitle ?? null,
  summary: summary ?? null,
  category: category ?? null,
  status: status ?? null,
  metadata: toMetadataRows(properties)
});

export const buildSpeciesSelectedFeature = ({
  featureId,
  layerId,
  slug,
  title,
  scientificName,
  subtitle,
  summary,
  category,
  status,
  metadata
}: {
  featureId: MapFeatureId | null;
  layerId?: string | null;
  slug: string;
  title: string;
  scientificName?: string | null;
  subtitle?: string | null;
  summary?: string | null;
  category?: string | null;
  status?: string | null;
  metadata: Record<string, unknown>;
}): SelectedSpeciesFeature => ({
  kind: "species",
  key: `species:${slug}`,
  featureId,
  layerId: layerId ?? null,
  slug,
  title,
  scientificName: scientificName ?? null,
  subtitle: subtitle ?? null,
  summary: summary ?? null,
  category: category ?? null,
  status: status ?? null,
  metadata: toMetadataRows(metadata)
});

export const buildSearchSelectedFeature = (result: SearchResult): SelectedMapFeature | null => {
  if (result.type === "area") {
    return buildAreaSelectedFeature({
      featureId: result.slug,
      scopeType: "department",
      scopeId: result.slug,
      title: result.title,
      subtitle: result.subtitle,
      category: "Área",
      status: null,
      properties: {}
    });
  }

  if (result.type === "species") {
    return buildSpeciesSelectedFeature({
      featureId: result.slug,
      slug: result.slug,
      title: result.title,
      scientificName: result.subtitle,
      category: "Especie",
      status: null,
      summary: result.subtitle,
      metadata: {}
    });
  }

  return null;
};
