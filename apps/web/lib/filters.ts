import type { MapFilters } from "@/lib/repository";
import {
  mapMarkerModeValues,
  mapSpeciesSortValues,
  type MapMarkerMode,
  type MapScopeType,
  type MapSpeciesSort
} from "@/lib/types";

const read = (
  source: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string
): string | undefined => {
  if (source instanceof URLSearchParams) {
    return source.get(key) ?? undefined;
  }
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
};

export const coerceMapFilters = (
  source: URLSearchParams | Record<string, string | string[] | undefined>
): MapFilters => ({
  viewMode: read(source, "viewMode") === "species" ? "species" : "coverage",
  taxonScope:
    read(source, "taxonScope") === "flora" ||
    read(source, "taxonScope") === "fauna"
      ? (read(source, "taxonScope") as MapFilters["taxonScope"])
      : "all",
  group: (read(source, "group") as MapFilters["group"]) ?? "all",
  sourceTier: (read(source, "sourceTier") as MapFilters["sourceTier"]) ?? "all",
  protectedOnly: read(source, "protectedOnly") === "true",
  region: read(source, "region") ?? "all",
  elevationBand:
    (read(source, "elevationBand") as MapFilters["elevationBand"]) ?? "all",
  dateRange: (read(source, "dateRange") as MapFilters["dateRange"]) ?? "all",
  taxonSlug: read(source, "taxonSlug") ?? undefined
});

export const filtersToQueryString = (filters: MapFilters): string => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (
      !(key === "viewMode" && value === "coverage") &&
      value !== undefined &&
      value !== null &&
      value !== "all" &&
      value !== false &&
      value !== ""
    ) {
      params.set(key, String(value));
    }
  }

  return params.toString();
};

export const coerceMapScopeType = (value: string | undefined): MapScopeType =>
  value === "department" ||
  value === "protected_area" ||
  value === "public_hex" ||
  value === "country"
    ? value
    : "country";

export const coerceMapSpeciesSort = (value: string | undefined): MapSpeciesSort =>
  value && mapSpeciesSortValues.includes(value as MapSpeciesSort)
    ? (value as MapSpeciesSort)
    : "presence";

export const coerceMapMarkerMode = (value: string | undefined): MapMarkerMode =>
  value && mapMarkerModeValues.includes(value as MapMarkerMode)
    ? (value as MapMarkerMode)
    : "coverage_preview";

export const coercePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};
