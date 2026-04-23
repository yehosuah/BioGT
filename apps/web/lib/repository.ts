import { cache } from "react";

import { ensureAtlasBootstrap } from "@/lib/atlas-bootstrap";
import {
  areaGeometry,
  areas as demoAreas,
  buildPublicHexId,
  buildPublicHexCollection,
  citations as demoCitations,
  internalOccurrences,
  searchIndex as buildDemoSearchIndex,
  sources as demoSources,
  species as demoSpecies,
  storyModules as demoStoryModules
} from "@/lib/demo-data";
import { isDatabaseConfigured, maybeOne, query } from "@/lib/db";
import { defaultTaxonomicGroups, mapSpeciesSortValues } from "@/lib/types";
import type {
  AreaRecord,
  AtlasSourceMeta,
  CitationRecord,
  FeatureProperties,
  InternalOccurrence,
  MapMarkerMode,
  MapMarkerResponse,
  MapPanelResponse,
  MapFeatureCollection,
  MapScopeType,
  MapSelectionSummary,
  MapSpeciesCard,
  MapSpeciesMarker,
  MapSpeciesPanelResponse,
  MapSpeciesPresenceArea,
  MapSpeciesSort,
  MapSummaryResponse,
  MapViewMode,
  QuickFact,
  SearchResult,
  SourceRecord,
  SourceTier,
  SpeciesVisual,
  SpeciesRecord,
  StoryModule,
  TaxonScope,
  TaxonomicGroup
} from "@/lib/types";

export type MapFilters = {
  viewMode?: MapViewMode;
  taxonScope?: TaxonScope;
  group?: TaxonomicGroup | "all";
  sourceTier?: SourceTier | "all";
  protectedOnly?: boolean;
  region?: string;
  elevationBand?: "baja" | "media" | "alta" | "all";
  dateRange?: "30d" | "12m" | "all";
  taxonSlug?: string;
};

type AreaRow = {
  id: string;
  slug: string;
  name: string;
  kind: AreaRecord["kind"];
  department: string | null;
  summary: string | null;
  species_count: number;
  endemic_count: number;
  protected_count: number;
  story_label: string | null;
  geometry_id: string;
  source_ids: string[];
  source_tiers: SourceTier[];
};

type SpeciesRow = {
  id: string;
  slug: string;
  common_name: string;
  scientific_name: string;
  taxonomic_group: TaxonomicGroup;
  status: string | null;
  endemism: string | null;
  summary: string | null;
  hero_metric: string | null;
  presence_area_ids: string[];
  source_ids: string[];
  source_tiers: SourceTier[];
  media_url: string | null;
  media_alt_text: string | null;
  media_attribution: string | null;
  media_license: string | null;
  media_source_name: string | null;
};

type MapSpeciesRow = {
  species_id: string;
  slug: string;
  common_name: string;
  scientific_name: string;
  taxonomic_group: TaxonomicGroup;
  status: string | null;
  endemism: string | null;
  summary: string | null;
  hero_metric: string | null;
  presence_count: number;
  latest_observed_at: string | null;
  source_tiers: SourceTier[];
  media_url: string | null;
  media_alt_text: string | null;
  media_attribution: string | null;
  media_license: string | null;
  media_source_name: string | null;
};

type SpeciesPresenceAreaRow = {
  scope_type: Exclude<MapScopeType, "country">;
  scope_id: string;
  title: string;
  subtitle: string | null;
  occurrence_count: number;
  latest_observed_at: string | null;
};

type MarkerRow = {
  marker_id: string;
  scope_id: string;
  species_id: string;
  slug: string;
  common_name: string;
  scientific_name: string;
  taxonomic_group: TaxonomicGroup;
  occurrence_count: number;
  longitude: number;
  latitude: number;
  media_url: string | null;
  media_alt_text: string | null;
  media_attribution: string | null;
  media_license: string | null;
  media_source_name: string | null;
  total_count?: number;
};

type NationalSummary = {
  title: string;
  subtitle: string;
  metrics: {
    speciesCount: number;
    protectedAreas: number;
    featuredDepartments: number;
    sources: number;
  };
  storyModules: StoryModule[];
  featuredAreas: AreaRecord[];
  featuredSpecies: SpeciesRecord[];
  sources: SourceRecord[];
};

type MapPanelArgs = {
  scopeType?: MapScopeType;
  scopeId?: string;
  filters?: MapFilters;
  sort?: MapSpeciesSort;
  page?: number;
  pageSize?: number;
};

type MapSpeciesPanelArgs = {
  taxonSlug?: string;
  filters?: MapFilters;
};

type LayerBBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

type LayerOptions = {
  bbox?: LayerBBox;
  taxonSlug?: string;
};

type AtlasLayer = "departments" | "protected_areas" | "public_hex" | "species_presence";

const canonicalSourceTiers: SourceTier[] = ["official", "institutional"];
const floraGroup: TaxonomicGroup = "flora";

const atlasSourceMeta: AtlasSourceMeta = {
  canonicalLabel: "Cobertura canónica institucional y oficial",
  optionalOverlayLabel: "Capa comunitaria opcional y rotulada",
  freshnessLabel: "Ritmo de actualización según colección y archivo público",
  confidenceLabel: "La presencia pública se generaliza para proteger coordenadas sensibles"
};

const toMapScopeType = (kind: AreaRecord["kind"]): MapScopeType | null => {
  if (kind === "country" || kind === "department" || kind === "protected_area") {
    return kind;
  }

  return null;
};

const mapAreaRow = (row: AreaRow): AreaRecord => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  kind: row.kind,
  department: row.department ?? undefined,
  summary: row.summary ?? "",
  metrics: {
    speciesCount: Number(row.species_count ?? 0),
    endemicCount: Number(row.endemic_count ?? 0),
    protectedCount: Number(row.protected_count ?? 0),
    storyLabel: row.story_label ?? ""
  },
  featuredSpeciesIds: [],
  sourceIds: row.source_ids ?? [],
  sourceTiers: row.source_tiers ?? [],
  visibility: row.kind === "protected_area" ? "generalized_public" : "summary_only",
  geometryId: row.geometry_id
});

const mapSpeciesRow = (row: SpeciesRow): SpeciesRecord => ({
  id: row.id,
  slug: row.slug,
  commonName: row.common_name,
  scientificName: row.scientific_name,
  group: row.taxonomic_group,
  status: row.status ?? "",
  endemism: row.endemism ?? "",
  summary: row.summary ?? "",
  presenceAreaIds: row.presence_area_ids ?? [],
  sourceIds: row.source_ids ?? [],
  sourceTiers: row.source_tiers ?? [],
  heroMetric: row.hero_metric ?? "",
  visual: buildVisual({
    alt: row.media_alt_text,
    commonName: row.common_name,
    group: row.taxonomic_group,
    license: row.media_license,
    sourceName: row.media_source_name,
    src: row.media_url,
    attribution: row.media_attribution
  })
});

const areaBaseQuery = `
  from (
    select
      slug,
      slug as id,
      name,
      kind::text as kind,
      department,
      summary,
      geometry_id,
      featured_rank
    from areas_admin
    union all
    select
      slug,
      slug as id,
      name,
      'protected_area'::text as kind,
      department,
      summary,
      geometry_id,
      featured_rank
    from areas_protected
  ) area
  left join area_metrics metrics
    on metrics.area_ref = area.slug
   and metrics.area_kind::text = area.kind
  left join area_geometries geom on geom.id = area.geometry_id
  left join entity_source_links esl
    on esl.entity_type = 'area'
   and esl.entity_ref = area.slug
  left join sources src on src.id = esl.source_id
`;

const speciesBaseQuery = `
  from taxa taxon
  left join occurrences_normalized occ on occ.taxon_id = taxon.id
  left join areas_protected pa on pa.id = occ.area_protected_id
  left join lateral (
    select url, alt_text, attribution, license, source_id
    from taxon_media media
    where media.taxon_id = taxon.id
    order by media.is_primary desc, media.sort_order asc, media.created_at asc
    limit 1
  ) media on true
  left join sources media_source on media_source.id = media.source_id
  left join entity_source_links esl
    on esl.entity_type = 'species'
   and esl.entity_ref = taxon.slug
  left join sources src on src.id = esl.source_id
`;

const groupAccents: Record<string, string> = {
  aves: "linear-gradient(135deg, #1d5f73, #58a8b7)",
  mamiferos: "linear-gradient(135deg, #405336, #93a66f)",
  anfibios: "linear-gradient(135deg, #2f7c55, #8dcf8f)",
  reptiles: "linear-gradient(135deg, #6c7336, #b2bb73)",
  peces: "linear-gradient(135deg, #0d5b77, #6fc2d0)",
  flora: "linear-gradient(135deg, #336b4f, #8dbb73)",
  insectos: "linear-gradient(135deg, #8b5a17, #d8b450)",
  aracnidos: "linear-gradient(135deg, #6e4a3c, #c18f77)",
  moluscos: "linear-gradient(135deg, #6f607a, #b5a7c3)",
  "otros-invertebrados": "linear-gradient(135deg, #8b6f4b, #d0b890)",
  hongos: "linear-gradient(135deg, #77543c, #c69d75)",
  fauna: "linear-gradient(135deg, #51655b, #96ae9f)"
};

const defaultGroupAccent = "linear-gradient(135deg, #3f5b61, #8aa3a9)";

const isFaunaGroup = (group: TaxonomicGroup) => group !== floraGroup;

const matchesTaxonScope = (
  group: TaxonomicGroup,
  taxonScope: TaxonScope | undefined
) => {
  if (!taxonScope || taxonScope === "all") {
    return true;
  }

  return taxonScope === "flora" ? group === floraGroup : isFaunaGroup(group);
};

const buildTaxonScopeSql = (alias: string, taxonScope: TaxonScope | undefined) => {
  if (!taxonScope || taxonScope === "all") {
    return null;
  }

  return taxonScope === "flora"
    ? `${alias}.taxonomic_group = 'flora'`
    : `${alias}.taxonomic_group <> 'flora'`;
};

const mapFeatureBiodiversityLabel = (speciesCount: number) => {
  if (speciesCount >= 320) {
    return "Pulso biodiverso muy alto";
  }

  if (speciesCount >= 180) {
    return "Pulso biodiverso alto";
  }

  if (speciesCount >= 80) {
    return "Pulso biodiverso medio";
  }

  return "Pulso biodiverso emergente";
};

const getEffectiveSourceTiers = (filters: MapFilters = {}): SourceTier[] =>
  filters.sourceTier && filters.sourceTier !== "all"
    ? [filters.sourceTier]
    : canonicalSourceTiers;

const getActiveViewMode = (filters: MapFilters = {}): MapViewMode =>
  filters.viewMode === "species" ? "species" : "coverage";

const sortTaxonomicGroups = (groups: TaxonomicGroup[]) => {
  const preferredOrder = new Map<string, number>(
    defaultTaxonomicGroups.map((group, index) => [group, index] as const)
  );

  return [...groups].sort((left, right) => {
    const leftRank = preferredOrder.get(left);
    const rightRank = preferredOrder.get(right);

    if (leftRank !== undefined || rightRank !== undefined) {
      return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER);
    }

    return left.localeCompare(right, "es");
  });
};

const buildFilterOptions = (
  areas: AreaRecord[],
  groups: TaxonomicGroup[]
): MapSummaryResponse["filterOptions"] => ({
  taxonScopes: ["all", "flora", "fauna"],
  groups: ["all", ...sortTaxonomicGroups(groups)],
  sourceTiers: ["all", "official", "institutional", "community"],
  regions: areas.flatMap((area) => {
    const scopeType = toMapScopeType(area.kind);
    return scopeType && scopeType !== "country"
      ? [{ id: area.slug, label: area.name, scopeType }]
      : [];
  }),
  elevationBands: ["all", "baja", "media", "alta"],
  dateRanges: ["all", "30d", "12m"]
});

const buildOccurrenceFilters = (filters: MapFilters) => {
  const params: unknown[] = [];
  const where: string[] = [];

  const taxonScopeSql = buildTaxonScopeSql("taxon", filters.taxonScope);
  if (taxonScopeSql) {
    where.push(taxonScopeSql);
  }

  if (filters.group && filters.group !== "all") {
    params.push(filters.group);
    where.push(`taxon.taxonomic_group = $${params.length}`);
  }

  params.push(getEffectiveSourceTiers(filters));
  where.push(`src.tier::text = any($${params.length}::text[])`);

  if (filters.protectedOnly) {
    where.push(`pa.slug is not null`);
  }

  if (filters.region && filters.region !== "all") {
    params.push(filters.region);
    where.push(`(dept.slug = $${params.length} or pa.slug = $${params.length})`);
  }

  if (filters.elevationBand && filters.elevationBand !== "all") {
    params.push(filters.elevationBand);
    where.push(`occ.elevation_band = $${params.length}`);
  }

  if (filters.dateRange && filters.dateRange !== "all") {
    if (filters.dateRange === "30d") {
      where.push(`occ.observed_at >= current_date - interval '30 days'`);
    } else if (filters.dateRange === "12m") {
      where.push(`occ.observed_at >= current_date - interval '365 days'`);
    }
  }

  return {
    params,
    whereSql: where.length > 0 ? `where ${where.join(" and ")}` : ""
  };
};

const prependWhereClause = (whereSql: string, clause: string) =>
  whereSql ? whereSql.replace(/^where\s+/i, `where ${clause} and `) : `where ${clause}`;

const ensureData = async () => {
  if (!isDatabaseConfigured()) {
    return;
  }

  await ensureAtlasBootstrap();
};

const getSourceTierById = () =>
  new Map<string, SourceTier>(demoSources.map((source) => [source.id, source.tier]));

const withSourceTiers = <T extends { sourceIds: string[]; sourceTiers?: SourceTier[] }>(entry: T): T => {
  if (entry.sourceTiers && entry.sourceTiers.length > 0) {
    return entry;
  }

  const tiers = Array.from(
    new Set(
      entry.sourceIds
        .map((sourceId) => getSourceTierById().get(sourceId))
        .filter((tier): tier is SourceTier => Boolean(tier))
    )
  );

  return {
    ...entry,
    sourceTiers: tiers
  };
};

const listDemoAreas = (): AreaRecord[] => demoAreas.map((area) => withSourceTiers(area));

const listDemoSpecies = (): SpeciesRecord[] =>
  demoSpecies.map((entry) => {
    const next = withSourceTiers(entry);
    return {
      ...next,
      visual:
        next.visual ??
        buildVisual({
          commonName: next.commonName,
          group: next.group
        })
    };
  });

const getDemoFilteredOccurrences = (filters: MapFilters = {}) => {
  const speciesById = new Map(listDemoSpecies().map((entry) => [entry.id, entry]));
  const sourceTierById = getSourceTierById();
  const now = new Date();
  const effectiveSourceTiers = new Set(getEffectiveSourceTiers(filters));

  return internalOccurrences.filter((occurrence) => {
    const species = speciesById.get(occurrence.speciesId);
    if (!species) {
      return false;
    }

    if (!matchesTaxonScope(species.group, filters.taxonScope)) {
      return false;
    }

    if (filters.group && filters.group !== "all" && species.group !== filters.group) {
      return false;
    }

    if (!effectiveSourceTiers.has(sourceTierById.get(occurrence.sourceId) ?? "community")) {
      return false;
    }

    if (filters.protectedOnly && !occurrence.protectedArea) {
      return false;
    }

    if (
      filters.region &&
      filters.region !== "all" &&
      occurrence.departmentSlug !== filters.region &&
      occurrence.areaId !== filters.region
    ) {
      return false;
    }

    if (
      filters.elevationBand &&
      filters.elevationBand !== "all" &&
      occurrence.elevationBand !== filters.elevationBand
    ) {
      return false;
    }

    if (filters.dateRange && filters.dateRange !== "all") {
      const observedAt = new Date(occurrence.observedAt);
      const days = filters.dateRange === "30d" ? 30 : 365;
      const threshold = new Date(now);
      threshold.setDate(threshold.getDate() - days);

      if (observedAt < threshold) {
        return false;
      }
    }

    return true;
  });
};

const mapDemoAreaFeature = (area: AreaRecord) => {
  const feature = areaGeometry[area.geometryId];
  return {
    ...feature,
    properties: {
      ...(feature.properties ?? {}),
      id: area.slug,
      label: area.name,
      kind: area.kind,
      speciesCount: area.metrics.speciesCount
    } satisfies FeatureProperties
  };
};

const normalizePanelScope = async (
  scopeType: MapScopeType | undefined,
  scopeId: string | undefined
): Promise<{ scopeType: MapScopeType; scopeId: string }> => {
  if (scopeType === "public_hex" && scopeId) {
    return {
      scopeType,
      scopeId
    };
  }

  if (!scopeId) {
    return {
      scopeType: "country",
      scopeId: "guatemala"
    };
  }

  if (scopeType === "country") {
    return { scopeType, scopeId };
  }

  const area = await getArea(scopeId);
  if (!area) {
    return {
      scopeType: "country",
      scopeId: "guatemala"
    };
  }

  const normalizedAreaScopeType = toMapScopeType(area.kind);
  if (!normalizedAreaScopeType) {
    return {
      scopeType: "country",
      scopeId: "guatemala"
    };
  }

  return {
    scopeType: normalizedAreaScopeType,
    scopeId: area.slug
  };
};

const clampPage = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;

const buildVisual = ({
  alt,
  commonName,
  group,
  license,
  sourceName,
  src,
  attribution
}: {
  alt?: string | null;
  commonName: string;
  group: TaxonomicGroup;
  license?: string | null;
  sourceName?: string | null;
  src?: string | null;
  attribution?: string | null;
}): SpeciesVisual => ({
  kind: src ? "photo" : "fallback",
  src: src ?? null,
  alt: alt ?? `Representación pública de ${commonName}`,
  attribution: attribution ?? null,
  license: license ?? null,
  sourceName: sourceName ?? null,
  accent: groupAccents[group] ?? defaultGroupAccent,
  fallbackLabel: commonName.slice(0, 1).toUpperCase()
});

const getPublicPointFromPolygon = (geometry: { coordinates: number[][][] }) => {
  const ring = geometry.coordinates[0] ?? [];
  if (ring.length === 0) {
    return {
      longitude: -90.25,
      latitude: 15.68
    };
  }

  const longitudes = ring.map(([longitude]) => longitude);
  const latitudes = ring.map(([, latitude]) => latitude);

  return {
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2
  };
};

const buildQuickFacts = ({
  endemism,
  latestObservedAt,
  presenceCount,
  status
}: {
  endemism: string;
  latestObservedAt: string | null;
  presenceCount: number;
  status: string;
}): QuickFact[] => [
  {
    label: "Estado",
    value: status || "Sin dato"
  },
  {
    label: "Endemismo",
    value: endemism || "Sin dato"
  },
  {
    label: "Presencias",
    value: `${presenceCount} visibles`
  },
  {
    label: "Último registro",
    value: latestObservedAt ? latestObservedAt.slice(0, 4) : "Sin fecha"
  }
];

const buildMapSpeciesCard = ({
  commonName,
  endemism,
  group,
  heroMetric,
  href,
  latestObservedAt,
  presenceCount,
  scientificName,
  slug,
  sourceTiers,
  speciesId,
  status,
  summary,
  visual
}: {
  commonName: string;
  endemism: string;
  group: TaxonomicGroup;
  heroMetric: string;
  href: string;
  latestObservedAt: string | null;
  presenceCount: number;
  scientificName: string;
  slug: string;
  sourceTiers: SourceTier[];
  speciesId: string;
  status: string;
  summary: string;
  visual: SpeciesVisual;
}): MapSpeciesCard => ({
  speciesId,
  slug,
  commonName,
  scientificName,
  group,
  status,
  endemism,
  summary,
  heroMetric,
  presenceCount,
  latestObservedAt,
  sourceTiers,
  quickFacts: buildQuickFacts({
    endemism,
    latestObservedAt,
    presenceCount,
    status
  }),
  visual,
  href
});

const buildMapSpeciesMarker = ({
  id,
  mode,
  occurrenceCount,
  point,
  scientificName,
  slug,
  group,
  speciesId,
  visual,
  label,
  scopeRef
}: {
  id: string;
  mode: MapMarkerMode;
  occurrenceCount: number;
  point: { longitude: number; latitude: number };
  scientificName: string;
  slug: string;
  group: TaxonomicGroup;
  speciesId: string;
  visual: SpeciesVisual;
  label: string;
  scopeRef: { scopeType: MapScopeType; scopeId: string };
}): MapSpeciesMarker => ({
  id,
  mode,
  speciesId,
  slug,
  label,
  scientificName,
  group,
  occurrenceCount,
  point,
  visual,
  scopeRef
});

const scopeMatchesOccurrence = (
  occurrence: InternalOccurrence,
  scopeType: MapScopeType,
  scopeId: string
) => {
  if (scopeType === "country") {
    return true;
  }

  if (scopeType === "department") {
    return occurrence.departmentSlug === scopeId;
  }

  if (scopeType === "protected_area") {
    return occurrence.areaId === scopeId;
  }

  return buildPublicHexId(occurrence.lng, occurrence.lat) === scopeId;
};

const sortMapSpeciesCards = (items: MapSpeciesCard[], sort: MapSpeciesSort) => {
  const sorted = [...items];
  sorted.sort((left, right) => {
    if (sort === "name") {
      return left.commonName.localeCompare(right.commonName, "es");
    }

    if (sort === "recent") {
      return (
        (right.latestObservedAt ? Date.parse(right.latestObservedAt) : 0) -
        (left.latestObservedAt ? Date.parse(left.latestObservedAt) : 0)
      );
    }

    return (
      right.presenceCount - left.presenceCount ||
      left.commonName.localeCompare(right.commonName, "es")
    );
  });
  return sorted;
};

const paginateMapSpeciesCards = (
  species: MapSpeciesCard[],
  page: number,
  pageSize: number
) => {
  const total = species.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const nextPage = Math.min(page, totalPages);
  const start = (nextPage - 1) * pageSize;

  return {
    items: species.slice(start, start + pageSize),
    page: nextPage,
    pageSize,
    total,
    totalPages
  };
};

export const listSources = cache(async (): Promise<SourceRecord[]> => {
  await ensureData();

  if (!isDatabaseConfigured()) {
    return demoSources;
  }

  const result = await query<{
    id: string;
    slug: string;
    name: string;
    tier: SourceTier;
    license: string;
    freshness: string;
    homepage: string;
    citation: string;
    description: string;
  }>(
    `
      select id, slug, name, tier, license, freshness, homepage, citation, description
      from sources
      order by created_at asc
    `
  );

  return result.rows;
});

export const getSource = cache(async (slug: string): Promise<SourceRecord | undefined> => {
  await ensureData();

  if (!isDatabaseConfigured()) {
    return demoSources.find((source) => source.id === slug || source.slug === slug);
  }

  const row = await maybeOne<SourceRecord>(
    `
      select id, slug, name, tier, license, freshness, homepage, citation, description
      from sources
      where id = $1 or slug = $1
      limit 1
    `,
    [slug]
  );

  return row ?? undefined;
});

export const listAreas = cache(async (): Promise<AreaRecord[]> => {
  await ensureData();

  if (!isDatabaseConfigured()) {
    return listDemoAreas();
  }

  const result = await query<AreaRow>(
    `
      select
        area.id,
        area.slug,
        area.name,
        area.kind::text as kind,
        area.department,
        area.summary,
        coalesce(metrics.species_count, 0)::int as species_count,
        coalesce(metrics.endemic_count, 0)::int as endemic_count,
        coalesce(metrics.protected_count, 0)::int as protected_count,
        coalesce(metrics.story_label, '') as story_label,
        coalesce(geom.external_key, area.slug) as geometry_id,
        coalesce(array_agg(distinct esl.source_id) filter (where esl.source_id is not null), '{}') as source_ids,
        coalesce(array_agg(distinct src.tier::text) filter (where src.tier is not null), '{}') as source_tiers
        ${areaBaseQuery}
      group by
        area.id,
        area.slug,
        area.name,
        area.kind,
        area.department,
        area.summary,
        area.featured_rank,
        metrics.species_count,
        metrics.endemic_count,
        metrics.protected_count,
        metrics.story_label,
        geom.external_key
      order by area.featured_rank asc, area.name asc
    `
  );

  return result.rows.map(mapAreaRow);
});

export const listProtectedAreas = cache(async (): Promise<AreaRecord[]> =>
  (await listAreas()).filter((area) => area.kind === "protected_area")
);

export const getArea = cache(async (slug: string): Promise<AreaRecord | undefined> =>
  (await listAreas()).find((area) => area.id === slug || area.slug === slug)
);

export const listSpecies = cache(async (): Promise<SpeciesRecord[]> => {
  await ensureData();

  if (!isDatabaseConfigured()) {
    return listDemoSpecies();
  }

  const result = await query<SpeciesRow>(
    `
      select
        taxon.slug as id,
        taxon.slug,
        taxon.common_name,
        taxon.scientific_name,
        taxon.taxonomic_group,
        taxon.status,
        taxon.endemism,
        taxon.summary,
        taxon.hero_metric,
        coalesce(array_agg(distinct pa.slug) filter (where pa.slug is not null), '{}') as presence_area_ids,
        coalesce(array_agg(distinct esl.source_id) filter (where esl.source_id is not null), '{}') as source_ids,
        coalesce(array_agg(distinct src.tier::text) filter (where src.tier is not null), '{}') as source_tiers,
        media.url as media_url,
        media.alt_text as media_alt_text,
        media.attribution as media_attribution,
        media.license as media_license,
        media_source.name as media_source_name
        ${speciesBaseQuery}
      group by
        taxon.id,
        taxon.slug,
        taxon.common_name,
        taxon.scientific_name,
        taxon.taxonomic_group,
        taxon.status,
        taxon.endemism,
        taxon.summary,
        taxon.hero_metric,
        media.url,
        media.alt_text,
        media.attribution,
        media.license,
        media_source.name,
        taxon.featured_rank
      order by taxon.featured_rank asc, taxon.common_name asc
    `
  );

  return result.rows.map(mapSpeciesRow);
});

export const getSpecies = cache(async (slug: string): Promise<SpeciesRecord | undefined> =>
  (await listSpecies()).find((entry) => entry.id === slug || entry.slug === slug)
);

export const getAreaSpecies = cache(async (areaSlug: string): Promise<SpeciesRecord[]> => {
  const area = await getArea(areaSlug);
  if (!area) {
    return [];
  }

  await ensureData();

  if (!isDatabaseConfigured()) {
    const relatedOccurrences = getDemoFilteredOccurrences().filter((occurrence) =>
      area.kind === "country"
        ? true
        : area.kind === "department"
          ? occurrence.departmentSlug === area.slug
          : occurrence.areaId === area.slug
    );
    const visibleSpeciesIds = new Set(relatedOccurrences.map((occurrence) => occurrence.speciesId));
    return (await listSpecies()).filter((entry) => visibleSpeciesIds.has(entry.id));
  }

  const params: unknown[] = [area.slug];
  const filter =
    area.kind === "country"
      ? ""
      : area.kind === "department"
        ? `where dept.slug = $1`
        : `where pa.slug = $1`;

  const result = await query<SpeciesRow>(
    `
      select
        taxon.slug as id,
        taxon.slug,
        taxon.common_name,
        taxon.scientific_name,
        taxon.taxonomic_group,
        taxon.status,
        taxon.endemism,
        taxon.summary,
        taxon.hero_metric,
        coalesce(array_agg(distinct pa.slug) filter (where pa.slug is not null), '{}') as presence_area_ids,
        coalesce(array_agg(distinct esl.source_id) filter (where esl.source_id is not null), '{}') as source_ids,
        coalesce(array_agg(distinct src.tier::text) filter (where src.tier is not null), '{}') as source_tiers,
        media.url as media_url,
        media.alt_text as media_alt_text,
        media.attribution as media_attribution,
        media.license as media_license,
        media_source.name as media_source_name
      from taxa taxon
      join occurrences_normalized occ on occ.taxon_id = taxon.id
      left join areas_admin dept on dept.id = occ.area_admin_id
      left join areas_protected pa on pa.id = occ.area_protected_id
      left join lateral (
        select url, alt_text, attribution, license, source_id
        from taxon_media media
        where media.taxon_id = taxon.id
        order by media.is_primary desc, media.sort_order asc, media.created_at asc
        limit 1
      ) media on true
      left join sources media_source on media_source.id = media.source_id
      left join entity_source_links esl
        on esl.entity_type = 'species'
       and esl.entity_ref = taxon.slug
      left join sources src on src.id = esl.source_id
      ${filter}
      group by
        taxon.id,
        taxon.slug,
        taxon.common_name,
        taxon.scientific_name,
        taxon.taxonomic_group,
        taxon.status,
        taxon.endemism,
        taxon.summary,
        taxon.hero_metric,
        media.url,
        media.alt_text,
        media.attribution,
        media.license,
        media_source.name,
        taxon.featured_rank
      order by taxon.featured_rank asc, taxon.common_name asc
    `,
    params
  );

  return result.rows.map(mapSpeciesRow);
});

export const getSpeciesAreas = cache(async (speciesSlug: string): Promise<AreaRecord[]> => {
  await ensureData();

  if (!isDatabaseConfigured()) {
    const species = await getSpecies(speciesSlug);
    if (!species) {
      return [];
    }

    const areaIds = new Set(species.presenceAreaIds);
    return (await listProtectedAreas()).filter((area) => areaIds.has(area.id));
  }

  const result = await query<AreaRow>(
    `
      select
        pa.slug as id,
        pa.slug,
        pa.name,
        'protected_area'::text as kind,
        pa.department,
        pa.summary,
        coalesce(metrics.species_count, 0)::int as species_count,
        coalesce(metrics.endemic_count, 0)::int as endemic_count,
        coalesce(metrics.protected_count, 0)::int as protected_count,
        coalesce(metrics.story_label, '') as story_label,
        coalesce(geom.external_key, pa.slug) as geometry_id,
        coalesce(array_agg(distinct esl.source_id) filter (where esl.source_id is not null), '{}') as source_ids,
        coalesce(array_agg(distinct src.tier::text) filter (where src.tier is not null), '{}') as source_tiers
      from taxa taxon
      join occurrences_normalized occ on occ.taxon_id = taxon.id
      join areas_protected pa on pa.id = occ.area_protected_id
      left join area_metrics metrics
        on metrics.area_ref = pa.slug
       and metrics.area_kind = 'protected_area'
      left join area_geometries geom on geom.id = pa.geometry_id
      left join entity_source_links esl
        on esl.entity_type = 'area'
       and esl.entity_ref = pa.slug
      left join sources src on src.id = esl.source_id
      where taxon.slug = $1
      group by
        pa.slug,
        pa.name,
        pa.department,
        pa.summary,
        pa.featured_rank,
        metrics.species_count,
        metrics.endemic_count,
        metrics.protected_count,
        metrics.story_label,
        geom.external_key
      order by pa.featured_rank asc, pa.name asc
    `,
    [speciesSlug]
  );

  return result.rows.map(mapAreaRow);
});

export const getEntityCitations = cache(async (entityId: string): Promise<CitationRecord[]> => {
  await ensureData();

  if (!isDatabaseConfigured()) {
    return demoCitations.filter((citation) => citation.entityId === entityId);
  }

  const result = await query<{
    id: string;
    entity_type: CitationRecord["entityType"];
    entity_ref: string;
    title: string;
    citation_text: string;
    href: string;
  }>(
    `
      select id, entity_type, entity_ref, title, citation_text, href
      from citations
      where entity_ref = $1
      order by created_at asc
    `,
    [entityId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_ref,
    title: row.title,
    text: row.citation_text,
    href: row.href
  }));
});

export const getNationalSummary = cache(async (): Promise<NationalSummary> => {
  if (!isDatabaseConfigured()) {
    const [allSources, protectedAreas, featuredSpecies, nationalArea, allAreas] = await Promise.all([
      listSources(),
      listProtectedAreas(),
      listSpecies(),
      getArea("guatemala"),
      listAreas()
    ]);

    return {
      title: "BioMap Guatemala",
      subtitle:
        "Un atlas público para explorar biodiversidad, áreas protegidas y especies destacadas con geoprivacidad activa.",
      metrics: {
        speciesCount: nationalArea?.metrics.speciesCount ?? featuredSpecies.length,
        protectedAreas: protectedAreas.length,
        featuredDepartments: allAreas.filter((area) => area.kind === "department").length,
        sources: allSources.length
      },
      storyModules: demoStoryModules,
      featuredAreas: protectedAreas.slice(0, 3),
      featuredSpecies: featuredSpecies.slice(0, 4),
      sources: allSources
    };
  }

  const [allSources, protectedAreas, featuredSpecies, stories, nationalArea] = await Promise.all([
    listSources(),
    listProtectedAreas(),
    listSpecies(),
    query<{
      id: string;
      eyebrow: string;
      title: string;
      body: string;
      accent: string | null;
      target_href: string | null;
    }>(
      `
        select id, eyebrow, title, body, accent, target_href
        from story_modules
        where published = true
        order by sort_order asc, created_at asc
      `
    ),
    getArea("guatemala")
  ]);

  return {
    title: "BioMap Guatemala",
    subtitle:
      "Un atlas público para explorar biodiversidad, áreas protegidas y especies destacadas con geoprivacidad activa.",
    metrics: {
      speciesCount: nationalArea?.metrics.speciesCount ?? featuredSpecies.length,
      protectedAreas: protectedAreas.length,
      featuredDepartments: (await listAreas()).filter((area) => area.kind === "department").length,
      sources: allSources.length
    },
    storyModules: stories.rows.map((row) => ({
      id: row.id,
      eyebrow: row.eyebrow,
      title: row.title,
      body: row.body,
      accent: row.accent ?? "",
      href: row.target_href ?? undefined
    })),
    featuredAreas: protectedAreas.slice(0, 3),
    featuredSpecies: featuredSpecies.slice(0, 4),
    sources: allSources
  };
});

export const searchEntities = cache(async (search: string): Promise<SearchResult[]> => {
  await ensureData();

  const normalized = search.trim().toLowerCase();

  if (!isDatabaseConfigured()) {
    return buildDemoSearchIndex()
      .filter((entry) => {
        if (normalized.length === 0) {
          return true;
        }

        return (
          entry.title.toLowerCase().includes(normalized) ||
          entry.subtitle.toLowerCase().includes(normalized)
        );
      })
      .slice(0, normalized.length === 0 ? 8 : 24);
  }

  const params = [`%${normalized}%`];
  const where =
    normalized.length === 0
      ? ""
      : `
        where lower(title) like $1
           or lower(subtitle) like $1
      `;

  const result = await query<{
    id: string;
    slug: string;
    type: SearchResult["type"];
    title: string;
    subtitle: string;
    href: string;
  }>(
    `
      select *
      from (
        select
          area.slug as id,
          area.slug,
          'area'::text as type,
          area.name as title,
          coalesce(area.summary, '') as subtitle,
          '/areas/' || area.slug as href
        from (
          select slug, name, summary from areas_admin
          union all
          select slug, name, summary from areas_protected
        ) area
        union all
        select
          taxon.slug as id,
          taxon.slug,
          'species'::text as type,
          taxon.common_name as title,
          taxon.scientific_name as subtitle,
          '/species/' || taxon.slug as href
        from taxa taxon
        union all
        select
          src.id,
          src.slug,
          'source'::text as type,
          src.name as title,
          src.description as subtitle,
          '/sources' as href
        from sources src
      ) search_index
      ${where}
      order by type asc, title asc
      limit ${normalized.length === 0 ? 8 : 24}
    `,
    normalized.length === 0 ? [] : params
  );

  return result.rows;
});

const buildSelectionSummary = async ({
  activeSources,
  scopeId,
  scopeType,
  visibleOccurrences,
  visibleSpecies
}: {
  activeSources: number;
  scopeId: string;
  scopeType: MapScopeType;
  visibleOccurrences: number;
  visibleSpecies: number;
}): Promise<MapSelectionSummary> => {
  if (scopeType === "public_hex") {
    return {
      scopeType,
      scopeId,
      title: "Celda pública",
      subtitle: "Cobertura generalizada sin coordenadas exactas para preservar geoprivacidad.",
      metrics: {
        visibleSpecies,
        visibleOccurrences,
        activeSources
      },
      sourceMeta: atlasSourceMeta
    };
  }

  const area = await getArea(scopeId);
  return {
    scopeType,
    scopeId,
    title: area?.name ?? "Guatemala",
    subtitle:
      area?.summary ??
      "Vista nacional para explorar cobertura pública de flora y fauna por región.",
    metrics: {
      visibleSpecies,
      visibleOccurrences,
      activeSources
    },
    sourceMeta: atlasSourceMeta
  };
};

const buildScopedOccurrenceFilters = (
  scopeType: MapScopeType,
  scopeId: string,
  filters: MapFilters = {}
) => {
  const params: unknown[] = [];
  const where: string[] = [];

  if (scopeType === "department") {
    params.push(scopeId);
    where.push(`dept.slug = $${params.length}`);
  } else if (scopeType === "protected_area") {
    params.push(scopeId);
    where.push(`pa.slug = $${params.length}`);
  } else if (scopeType === "public_hex") {
    params.push(scopeId);
    where.push(`'hex:' || md5(st_asgeojson(pub.public_geom)) = $${params.length}`);
  }

  const taxonScopeSql = buildTaxonScopeSql("taxon", filters.taxonScope);
  if (taxonScopeSql) {
    where.push(taxonScopeSql);
  }

  if (filters.group && filters.group !== "all") {
    params.push(filters.group);
    where.push(`taxon.taxonomic_group = $${params.length}`);
  }

  params.push(getEffectiveSourceTiers(filters));
  where.push(`src.tier::text = any($${params.length}::text[])`);

  if (filters.protectedOnly) {
    where.push(`pa.slug is not null`);
  }

  if (filters.elevationBand && filters.elevationBand !== "all") {
    params.push(filters.elevationBand);
    where.push(`occ.elevation_band = $${params.length}`);
  }

  if (filters.dateRange && filters.dateRange !== "all") {
    if (filters.dateRange === "30d") {
      where.push(`occ.observed_at >= current_date - interval '30 days'`);
    } else if (filters.dateRange === "12m") {
      where.push(`occ.observed_at >= current_date - interval '365 days'`);
    }
  }

  return {
    params,
    whereSql: where.length > 0 ? `where ${where.join(" and ")}` : ""
  };
};

const buildRollupFilters = (
  scopeType: MapScopeType,
  scopeId: string,
  filters: MapFilters = {}
) => {
  const params: unknown[] = [scopeType, scopeId];
  const where = [`rollup.area_kind::text = $1`, `rollup.area_ref = $2`];

  const taxonScopeSql = buildTaxonScopeSql("taxon", filters.taxonScope);
  if (taxonScopeSql) {
    where.push(taxonScopeSql);
  }

  if (filters.group && filters.group !== "all") {
    params.push(filters.group);
    where.push(`taxon.taxonomic_group = $${params.length}`);
  }

  params.push(getEffectiveSourceTiers(filters));
  where.push(`rollup.source_tier::text = any($${params.length}::text[])`);

  if (filters.protectedOnly && scopeType !== "protected_area") {
    where.push(`rollup.protected_occurrence_count > 0`);
  }

  if (filters.elevationBand && filters.elevationBand !== "all") {
    params.push(filters.elevationBand);
    where.push(`$${params.length} = any(rollup.elevation_bands)`);
  }

  if (filters.dateRange && filters.dateRange !== "all") {
    if (filters.dateRange === "30d") {
      where.push(`rollup.latest_observed_at >= current_date - interval '30 days'`);
    } else if (filters.dateRange === "12m") {
      where.push(`rollup.latest_observed_at >= current_date - interval '365 days'`);
    }
  }

  return {
    params,
    whereSql: `where ${where.join(" and ")}`
  };
};

const getDemoMapPanel = async ({
  filters = {},
  page = 1,
  pageSize = 8,
  scopeId,
  scopeType = "country",
  sort = "presence"
}: Required<MapPanelArgs>): Promise<MapPanelResponse> => {
  const scope = await normalizePanelScope(scopeType, scopeId);
  const occurrences = getDemoFilteredOccurrences(filters).filter((occurrence) =>
    scopeMatchesOccurrence(occurrence, scope.scopeType, scope.scopeId)
  );
  const speciesById = new Map(listDemoSpecies().map((entry) => [entry.id, entry]));
  const sourceTierById = getSourceTierById();
  const buckets = new Map<
    string,
    {
      count: number;
      latestObservedAt: string | null;
      sourceTiers: Set<SourceTier>;
    }
  >();

  for (const occurrence of occurrences) {
    const bucket = buckets.get(occurrence.speciesId) ?? {
      count: 0,
      latestObservedAt: null,
      sourceTiers: new Set<SourceTier>()
    };
    bucket.count += 1;
    if (!bucket.latestObservedAt || occurrence.observedAt > bucket.latestObservedAt) {
      bucket.latestObservedAt = occurrence.observedAt;
    }
    const tier = sourceTierById.get(occurrence.sourceId);
    if (tier) {
      bucket.sourceTiers.add(tier);
    }
    buckets.set(occurrence.speciesId, bucket);
  }

  const cards = Array.from(buckets.entries())
    .map(([speciesId, bucket]) => {
      const species = speciesById.get(speciesId);
      if (!species) {
        return null;
      }

      return buildMapSpeciesCard({
        speciesId,
        slug: species.slug,
        commonName: species.commonName,
        scientificName: species.scientificName,
        group: species.group,
        status: species.status,
        endemism: species.endemism,
        summary: species.summary,
        heroMetric: species.heroMetric,
        presenceCount: bucket.count,
        latestObservedAt: bucket.latestObservedAt,
        sourceTiers: Array.from(bucket.sourceTiers),
        visual: buildVisual({
          commonName: species.commonName,
          group: species.group
        }),
        href: `/species/${species.slug}`
      });
    })
    .filter((entry): entry is MapSpeciesCard => Boolean(entry));

  const sorted = sortMapSpeciesCards(cards, sort);
  const pagination = paginateMapSpeciesCards(sorted, page, pageSize);
  const sourceIds = new Set(occurrences.map((occurrence) => occurrence.sourceId));

  return {
    selection: await buildSelectionSummary({
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      visibleSpecies: buckets.size,
      visibleOccurrences: occurrences.length,
      activeSources: sourceIds.size
    }),
    species: pagination.items,
    availableSorts: [...mapSpeciesSortValues],
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages
    },
    taxonScope: filters.taxonScope ?? "all",
    viewMode: "coverage"
  };
};

export const getMapPanel = async ({
  filters = {},
  page,
  pageSize,
  scopeId,
  scopeType = "country",
  sort = "presence"
}: MapPanelArgs = {}): Promise<MapPanelResponse> => {
  await ensureData();

  const normalizedSort = mapSpeciesSortValues.includes(sort ?? "presence")
    ? (sort ?? "presence")
    : "presence";
  const normalizedPage = clampPage(page, 1);
  const normalizedPageSize = Math.min(24, clampPage(pageSize, 8));

  if (!isDatabaseConfigured()) {
    return getDemoMapPanel({
      filters,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      scopeId: scopeId ?? "guatemala",
      scopeType,
      sort: normalizedSort
    });
  }

  const scope = await normalizePanelScope(scopeType, scopeId);
  const selectionFilters = buildScopedOccurrenceFilters(scope.scopeType, scope.scopeId, filters);
  const rollupFilters = buildRollupFilters(scope.scopeType, scope.scopeId, filters);
  const summary = await query<{
    active_sources: number;
    visible_occurrences: number;
    visible_species: number;
  }>(
    `
      select
        count(distinct taxon.slug)::int as visible_species,
        count(*)::int as visible_occurrences,
        count(distinct src.id)::int as active_sources
      from occurrences_normalized occ
      left join occurrences_public pub on pub.normalized_occurrence_id = occ.id
      left join taxa taxon on taxon.id = occ.taxon_id
      left join sources src on src.id = occ.source_id
      left join areas_admin dept on dept.id = occ.area_admin_id
      left join areas_protected pa on pa.id = occ.area_protected_id
      ${selectionFilters.whereSql}
    `,
    selectionFilters.params
  );

  const orderBy =
    normalizedSort === "name"
      ? `common_name asc`
      : normalizedSort === "recent"
        ? `latest_observed_at desc nulls last, common_name asc`
        : `presence_count desc, common_name asc`;
  const result = await query<MapSpeciesRow & { total_count: number }>(
    `
      with species_rows as (
        select
          taxon.slug as species_id,
          taxon.slug,
          taxon.common_name,
          taxon.scientific_name,
          taxon.taxonomic_group,
          taxon.status,
          taxon.endemism,
          taxon.summary,
          taxon.hero_metric,
          sum(rollup.occurrence_count)::int as presence_count,
          max(rollup.latest_observed_at)::text as latest_observed_at,
          coalesce(array_agg(distinct rollup.source_tier::text), '{}') as source_tiers,
          media.url as media_url,
          media.alt_text as media_alt_text,
          media.attribution as media_attribution,
          media.license as media_license,
          media_source.name as media_source_name
        from taxon_presence_rollups rollup
        join taxa taxon on taxon.id = rollup.taxon_id
        left join lateral (
          select url, alt_text, attribution, license, source_id
          from taxon_media media
          where media.taxon_id = taxon.id
          order by media.is_primary desc, media.sort_order asc, media.created_at asc
          limit 1
        ) media on true
        left join sources media_source on media_source.id = media.source_id
        ${rollupFilters.whereSql}
        group by
          taxon.id,
          taxon.slug,
          taxon.common_name,
          taxon.scientific_name,
          taxon.taxonomic_group,
          taxon.status,
          taxon.endemism,
          taxon.summary,
          taxon.hero_metric,
          media.url,
          media.alt_text,
          media.attribution,
          media.license,
          media_source.name
      )
      select
        species_rows.*,
        count(*) over()::int as total_count
      from species_rows
      order by ${orderBy}
      limit $${rollupFilters.params.length + 1}
      offset $${rollupFilters.params.length + 2}
    `,
    [
      ...rollupFilters.params,
      normalizedPageSize,
      (normalizedPage - 1) * normalizedPageSize
    ]
  );

  const total = result.rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / normalizedPageSize));

  return {
    selection: await buildSelectionSummary({
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      visibleSpecies: Number(summary.rows[0]?.visible_species ?? 0),
      visibleOccurrences: Number(summary.rows[0]?.visible_occurrences ?? 0),
      activeSources: Number(summary.rows[0]?.active_sources ?? 0)
    }),
    species: result.rows.map((row) =>
      buildMapSpeciesCard({
        speciesId: row.species_id,
        slug: row.slug,
        commonName: row.common_name,
        scientificName: row.scientific_name,
        group: row.taxonomic_group,
        status: row.status ?? "",
        endemism: row.endemism ?? "",
        summary: row.summary ?? "",
        heroMetric: row.hero_metric ?? "",
        presenceCount: Number(row.presence_count ?? 0),
        latestObservedAt: row.latest_observed_at,
        sourceTiers: row.source_tiers ?? [],
        visual: buildVisual({
          alt: row.media_alt_text,
          commonName: row.common_name,
          group: row.taxonomic_group,
          license: row.media_license,
          sourceName: row.media_source_name,
          src: row.media_url,
          attribution: row.media_attribution
        }),
        href: `/species/${row.slug}`
      })
    ),
    availableSorts: [...mapSpeciesSortValues],
    pagination: {
      page: Math.min(normalizedPage, totalPages),
      pageSize: normalizedPageSize,
      total,
      totalPages
    },
    taxonScope: filters.taxonScope ?? "all",
    viewMode: "coverage"
  };
};

const buildSpeciesPresencePlacesDemo = async (
  occurrences: InternalOccurrence[]
): Promise<MapSpeciesPresenceArea[]> => {
  const areaMap = new Map((await listAreas()).map((area) => [area.slug, area]));
  const places = new Map<string, MapSpeciesPresenceArea>();

  for (const occurrence of occurrences) {
    const department = areaMap.get(occurrence.departmentSlug);
    if (department) {
      const key = `department:${department.slug}`;
      const existing = places.get(key);
      places.set(key, {
        scopeType: "department",
        scopeId: department.slug,
        title: department.name,
        subtitle: department.summary,
        occurrenceCount: (existing?.occurrenceCount ?? 0) + 1,
        latestObservedAt:
          !existing?.latestObservedAt || occurrence.observedAt > existing.latestObservedAt
            ? occurrence.observedAt
            : existing.latestObservedAt
      });
    }

    const protectedArea = areaMap.get(occurrence.areaId);
    if (protectedArea?.kind === "protected_area") {
      const key = `protected_area:${protectedArea.slug}`;
      const existing = places.get(key);
      places.set(key, {
        scopeType: "protected_area",
        scopeId: protectedArea.slug,
        title: protectedArea.name,
        subtitle: protectedArea.summary,
        occurrenceCount: (existing?.occurrenceCount ?? 0) + 1,
        latestObservedAt:
          !existing?.latestObservedAt || occurrence.observedAt > existing.latestObservedAt
            ? occurrence.observedAt
            : existing.latestObservedAt
      });
    }
  }

  return Array.from(places.values()).sort(
    (left, right) =>
      right.occurrenceCount - left.occurrenceCount ||
      (right.latestObservedAt ? Date.parse(right.latestObservedAt) : 0) -
        (left.latestObservedAt ? Date.parse(left.latestObservedAt) : 0) ||
      left.title.localeCompare(right.title, "es")
  );
};

export const getMapSpeciesPanel = async ({
  taxonSlug,
  filters = {}
}: MapSpeciesPanelArgs = {}): Promise<MapSpeciesPanelResponse> => {
  await ensureData();

  const allSpecies = await listSpecies();
  const activeSpecies =
    allSpecies.find((entry) => entry.slug === (taxonSlug ?? filters.taxonSlug)) ?? allSpecies[0];

  if (!activeSpecies) {
    throw new Error("No species available for atlas species mode.");
  }

  if (!isDatabaseConfigured()) {
    const occurrences = getDemoFilteredOccurrences({
      ...filters,
      taxonScope: matchesTaxonScope(activeSpecies.group, filters.taxonScope)
        ? filters.taxonScope
        : activeSpecies.group === floraGroup
          ? "flora"
          : "fauna"
    }).filter((occurrence) => occurrence.speciesId === activeSpecies.id);

    const sourceTierById = getSourceTierById();
    const sourceTiers = Array.from(
      new Set(
        occurrences
          .map((occurrence) => sourceTierById.get(occurrence.sourceId))
          .filter((tier): tier is SourceTier => Boolean(tier))
      )
    );
    const focusSpecies = buildMapSpeciesCard({
      speciesId: activeSpecies.id,
      slug: activeSpecies.slug,
      commonName: activeSpecies.commonName,
      scientificName: activeSpecies.scientificName,
      group: activeSpecies.group,
      status: activeSpecies.status,
      endemism: activeSpecies.endemism,
      summary: activeSpecies.summary,
      heroMetric: activeSpecies.heroMetric,
      presenceCount: occurrences.length,
      latestObservedAt: occurrences
        .map((occurrence) => occurrence.observedAt)
        .sort()
        .at(-1) ?? null,
      sourceTiers,
      visual: buildVisual({
        commonName: activeSpecies.commonName,
        group: activeSpecies.group
      }),
      href: `/species/${activeSpecies.slug}`
    });

    return {
      focusSpecies,
      metrics: {
        visibleDepartments: new Set(occurrences.map((occurrence) => occurrence.departmentSlug)).size,
        visibleProtectedAreas: new Set(occurrences.map((occurrence) => occurrence.areaId)).size,
        visibleCells: new Set(
          occurrences.map((occurrence) => buildPublicHexId(occurrence.lng, occurrence.lat))
        ).size,
        activeSources: new Set(occurrences.map((occurrence) => occurrence.sourceId)).size
      },
      sourceMeta: atlasSourceMeta,
      places: await buildSpeciesPresencePlacesDemo(occurrences),
      taxonScope: filters.taxonScope ?? "all",
      viewMode: "species"
    };
  }

  const occurrenceFilters = buildOccurrenceFilters(filters);
  const filteredWhereSql = prependWhereClause(occurrenceFilters.whereSql, `taxon.slug = $1`);
  const filteredParams = [activeSpecies.slug, ...occurrenceFilters.params];

  const focusResult = await query<
    MapSpeciesRow & {
      occurrence_total: number;
      visible_departments: number;
      visible_protected_areas: number;
      visible_cells: number;
      active_sources: number;
    }
  >(
    `
      select
        taxon.slug as species_id,
        taxon.slug,
        taxon.common_name,
        taxon.scientific_name,
        taxon.taxonomic_group,
        taxon.status,
        taxon.endemism,
        taxon.summary,
        taxon.hero_metric,
        count(*)::int as presence_count,
        max(occ.observed_at)::text as latest_observed_at,
        coalesce(array_agg(distinct src.tier::text) filter (where src.tier is not null), '{}') as source_tiers,
        media.url as media_url,
        media.alt_text as media_alt_text,
        media.attribution as media_attribution,
        media.license as media_license,
        media_source.name as media_source_name,
        count(*)::int as occurrence_total,
        count(distinct dept.slug) filter (where dept.slug is not null)::int as visible_departments,
        count(distinct pa.slug) filter (where pa.slug is not null)::int as visible_protected_areas,
        count(distinct 'hex:' || md5(st_asgeojson(pub.public_geom)))::int as visible_cells,
        count(distinct src.id)::int as active_sources
      from occurrences_normalized occ
      join occurrences_public pub on pub.normalized_occurrence_id = occ.id
      join taxa taxon on taxon.id = occ.taxon_id
      left join sources src on src.id = occ.source_id
      left join areas_admin dept on dept.id = occ.area_admin_id
      left join areas_protected pa on pa.id = occ.area_protected_id
      left join lateral (
        select url, alt_text, attribution, license, source_id
        from taxon_media media
        where media.taxon_id = taxon.id
        order by media.is_primary desc, media.sort_order asc, media.created_at asc
        limit 1
      ) media on true
      left join sources media_source on media_source.id = media.source_id
      ${filteredWhereSql}
      group by
        taxon.id,
        taxon.slug,
        taxon.common_name,
        taxon.scientific_name,
        taxon.taxonomic_group,
        taxon.status,
        taxon.endemism,
        taxon.summary,
        taxon.hero_metric,
        media.url,
        media.alt_text,
        media.attribution,
        media.license,
        media_source.name
    `,
    filteredParams
  );

  const focus = focusResult.rows[0];
  if (!focus) {
    return {
      focusSpecies: buildMapSpeciesCard({
        speciesId: activeSpecies.id,
        slug: activeSpecies.slug,
        commonName: activeSpecies.commonName,
        scientificName: activeSpecies.scientificName,
        group: activeSpecies.group,
        status: activeSpecies.status,
        endemism: activeSpecies.endemism,
        summary: activeSpecies.summary,
        heroMetric: activeSpecies.heroMetric,
        presenceCount: 0,
        latestObservedAt: null,
        sourceTiers: activeSpecies.sourceTiers ?? [],
        visual: buildVisual({
          commonName: activeSpecies.commonName,
          group: activeSpecies.group
        }),
        href: `/species/${activeSpecies.slug}`
      }),
      metrics: {
        visibleDepartments: 0,
        visibleProtectedAreas: 0,
        visibleCells: 0,
        activeSources: 0
      },
      sourceMeta: atlasSourceMeta,
      places: [],
      taxonScope: filters.taxonScope ?? "all",
      viewMode: "species"
    };
  }

  const places = await query<SpeciesPresenceAreaRow>(
    `
      select
        scope_type,
        scope_id,
        title,
        subtitle,
        count(*)::int as occurrence_count,
        max(observed_at)::text as latest_observed_at
      from (
        select
          'department'::text as scope_type,
          dept.slug as scope_id,
          dept.name as title,
          dept.summary as subtitle,
          occ.observed_at
        from occurrences_normalized occ
        join taxa taxon on taxon.id = occ.taxon_id
        left join sources src on src.id = occ.source_id
        join areas_admin dept on dept.id = occ.area_admin_id
        left join areas_protected pa on pa.id = occ.area_protected_id
        ${filteredWhereSql}

        union all

        select
          'protected_area'::text as scope_type,
          pa.slug as scope_id,
          pa.name as title,
          pa.summary as subtitle,
          occ.observed_at
        from occurrences_normalized occ
        join taxa taxon on taxon.id = occ.taxon_id
        left join sources src on src.id = occ.source_id
        left join areas_admin dept on dept.id = occ.area_admin_id
        join areas_protected pa on pa.id = occ.area_protected_id
        ${filteredWhereSql}
      ) place_rows
      group by scope_type, scope_id, title, subtitle
      order by occurrence_count desc, latest_observed_at desc nulls last, title asc
    `,
    filteredParams
  );

  return {
    focusSpecies: buildMapSpeciesCard({
      speciesId: focus.species_id,
      slug: focus.slug,
      commonName: focus.common_name,
      scientificName: focus.scientific_name,
      group: focus.taxonomic_group,
      status: focus.status ?? "",
      endemism: focus.endemism ?? "",
      summary: focus.summary ?? "",
      heroMetric: focus.hero_metric ?? "",
      presenceCount: Number(focus.occurrence_total ?? focus.presence_count ?? 0),
      latestObservedAt: focus.latest_observed_at,
      sourceTiers: focus.source_tiers ?? [],
      visual: buildVisual({
        alt: focus.media_alt_text,
        commonName: focus.common_name,
        group: focus.taxonomic_group,
        license: focus.media_license,
        sourceName: focus.media_source_name,
        src: focus.media_url,
        attribution: focus.media_attribution
      }),
      href: `/species/${focus.slug}`
    }),
    metrics: {
      visibleDepartments: Number(focus.visible_departments ?? 0),
      visibleProtectedAreas: Number(focus.visible_protected_areas ?? 0),
      visibleCells: Number(focus.visible_cells ?? 0),
      activeSources: Number(focus.active_sources ?? 0)
    },
    sourceMeta: atlasSourceMeta,
    places: places.rows.map((row) => ({
      scopeType: row.scope_type,
      scopeId: row.scope_id,
      title: row.title,
      subtitle: row.subtitle ?? "",
      occurrenceCount: Number(row.occurrence_count ?? 0),
      latestObservedAt: row.latest_observed_at
    })),
    taxonScope: filters.taxonScope ?? "all",
    viewMode: "species"
  };
};

export const getMapSummary = cache(async (filters: MapFilters = {}): Promise<MapSummaryResponse> => {
  await ensureData();

  if (!isDatabaseConfigured()) {
    const occurrences = getDemoFilteredOccurrences(filters);
    const speciesIds = new Set(occurrences.map((occurrence) => occurrence.speciesId));
    const sourceIds = new Set(occurrences.map((occurrence) => occurrence.sourceId));
    const allAreas = await listAreas();
    const groups = Array.from(new Set(listDemoSpecies().map((species) => species.group)));

    return {
      title: "BioGT / Atlas vivo de Guatemala",
      subtitle:
        "Mapa interactivo para recorrer flora y fauna por departamentos, áreas protegidas y celdas públicas sin saturar la vista.",
      metrics: {
        visibleSpecies: speciesIds.size,
        visibleOccurrences: occurrences.length,
        activeSources: sourceIds.size
      },
      filterOptions: buildFilterOptions(allAreas, groups),
      featuredAreas: allAreas.filter((area) => area.kind === "protected_area").slice(0, 3),
      sourceMeta: atlasSourceMeta,
      activeMode: getActiveViewMode(filters)
    };
  }

  const { params, whereSql } = buildOccurrenceFilters(filters);
  const summary = await query<{
    visible_species: number;
    visible_occurrences: number;
    active_sources: number;
  }>(
    `
      select
        count(distinct taxon.slug)::int as visible_species,
        count(*)::int as visible_occurrences,
        count(distinct src.id)::int as active_sources
      from occurrences_normalized occ
      left join taxa taxon on taxon.id = occ.taxon_id
      left join sources src on src.id = occ.source_id
      left join areas_admin dept on dept.id = occ.area_admin_id
      left join areas_protected pa on pa.id = occ.area_protected_id
      ${whereSql}
    `,
    params
  );

  const [allAreas, allSpecies] = await Promise.all([listAreas(), listSpecies()]);
  const groups = Array.from(new Set(allSpecies.map((species) => species.group)));

  return {
    title: "BioGT / Atlas vivo de Guatemala",
    subtitle:
      "Mapa interactivo para recorrer flora y fauna por departamentos, áreas protegidas y celdas públicas sin saturar la vista.",
    metrics: {
      visibleSpecies: Number(summary.rows[0]?.visible_species ?? 0),
      visibleOccurrences: Number(summary.rows[0]?.visible_occurrences ?? 0),
      activeSources: Number(summary.rows[0]?.active_sources ?? 0)
    },
    filterOptions: buildFilterOptions(allAreas, groups),
    featuredAreas: allAreas.filter((area) => area.kind === "protected_area").slice(0, 3),
    sourceMeta: atlasSourceMeta,
    activeMode: getActiveViewMode(filters)
  };
});

const toFeatureCollection = (
  rows: Array<{
    feature_id: string;
    label: string;
    kind: string;
    species_count: number;
    geometry: string;
  }>
): MapFeatureCollection => ({
  type: "FeatureCollection",
  features: rows.map((row) => ({
    type: "Feature",
    id: row.feature_id,
    properties: {
      id: row.feature_id,
      label: row.label,
      kind: row.kind,
      speciesCount: Number(row.species_count ?? 0),
      biodiversityLabel: mapFeatureBiodiversityLabel(Number(row.species_count ?? 0))
    } satisfies FeatureProperties,
    geometry: JSON.parse(row.geometry)
  }))
});

const featureIntersectsBBox = (
  feature: { geometry: { coordinates: number[][][] } },
  bbox: LayerBBox
) => {
  const coordinates = feature.geometry.coordinates[0] ?? [];
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);

  return !(
    east < bbox.west ||
    west > bbox.east ||
    north < bbox.south ||
    south > bbox.north
  );
};

const withOptionalDemoBBox = (collection: MapFeatureCollection, bbox?: LayerBBox) =>
  bbox
    ? {
        ...collection,
        features: collection.features.filter((feature) => featureIntersectsBBox(feature, bbox))
      }
    : collection;

const buildEnvelopeParams = (
  bbox: LayerBBox | undefined,
  params: unknown[],
  geometrySql: string
) => {
  if (!bbox) {
    return {
      params,
      whereSql: ""
    };
  }

  const nextParams = [
    ...params,
    bbox.west,
    bbox.south,
    bbox.east,
    bbox.north
  ];
  const offset = params.length;

  return {
    params: nextParams,
    whereSql: ` and st_intersects(${geometrySql}, st_makeenvelope($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, 4326))`
  };
};

export const getLayerCollection = cache(
  async (
    layer: AtlasLayer,
    filters: MapFilters = {},
    options: LayerOptions = {}
  ): Promise<MapFeatureCollection> => {
    await ensureData();

    if (!isDatabaseConfigured()) {
      if (layer === "departments") {
        return withOptionalDemoBBox(
          {
            type: "FeatureCollection",
            features: (await listAreas())
              .filter((area) => area.kind === "department")
              .map((area) => mapDemoAreaFeature(area))
          },
          options.bbox
        );
      }

      if (layer === "protected_areas") {
        return withOptionalDemoBBox(
          {
            type: "FeatureCollection",
            features: (await listAreas())
              .filter((area) => area.kind === "protected_area")
              .map((area) => mapDemoAreaFeature(area))
          },
          options.bbox
        );
      }

      if (layer === "species_presence") {
        const activeSpecies = await getSpecies(options.taxonSlug ?? filters.taxonSlug ?? "");
        if (!activeSpecies) {
          return {
            type: "FeatureCollection",
            features: []
          };
        }

        const collection = buildPublicHexCollection(
          getDemoFilteredOccurrences(filters).filter(
            (occurrence) => occurrence.speciesId === activeSpecies.id
          )
        );

        return withOptionalDemoBBox(
          {
            ...collection,
            features: collection.features.map((feature) => ({
              ...feature,
              properties: {
                ...(feature.properties ?? {}),
                kind: "species_presence",
                label: activeSpecies.commonName,
                occurrenceCount: Number(feature.properties?.occurrenceCount ?? 0)
              }
            }))
          },
          options.bbox
        );
      }

      return withOptionalDemoBBox(buildPublicHexCollection(getDemoFilteredOccurrences(filters)), options.bbox);
    }

    if (layer === "departments") {
      const envelope = buildEnvelopeParams(options.bbox, [], "geom.geom");
      const result = await query<{
        feature_id: string;
        label: string;
        kind: string;
        species_count: number;
        geometry: string;
      }>(
        `
          select
            area.slug as feature_id,
            area.name as label,
            area.kind::text as kind,
            coalesce(metrics.species_count, 0)::int as species_count,
            st_asgeojson(geom.geom) as geometry
          from areas_admin area
          join area_geometries geom on geom.id = area.geometry_id
          left join area_metrics metrics
            on metrics.area_ref = area.slug
           and metrics.area_kind = area.kind
          where area.kind = 'department'${envelope.whereSql}
          order by area.featured_rank asc, area.name asc
        `,
        envelope.params
      );

      return toFeatureCollection(result.rows);
    }

    if (layer === "protected_areas") {
      const envelope = buildEnvelopeParams(options.bbox, [], "geom.geom");
      const result = await query<{
        feature_id: string;
        label: string;
        kind: string;
        species_count: number;
        geometry: string;
      }>(
        `
          select
            area.slug as feature_id,
            area.name as label,
            'protected_area'::text as kind,
            coalesce(metrics.species_count, 0)::int as species_count,
            st_asgeojson(geom.geom) as geometry
          from areas_protected area
          join area_geometries geom on geom.id = area.geometry_id
          left join area_metrics metrics
            on metrics.area_ref = area.slug
           and metrics.area_kind = 'protected_area'
          where true${envelope.whereSql}
          order by area.featured_rank asc, area.name asc
        `,
        envelope.params
      );

      return toFeatureCollection(result.rows);
    }

    if (layer === "species_presence") {
      const activeSpecies = await getSpecies(options.taxonSlug ?? filters.taxonSlug ?? "");
      if (!activeSpecies) {
        return {
          type: "FeatureCollection",
          features: []
        };
      }

      const occurrenceFilters = buildOccurrenceFilters(filters);
      const whereSql = prependWhereClause(occurrenceFilters.whereSql, `taxon.slug = $1`);
      const envelope = buildEnvelopeParams(options.bbox, [activeSpecies.slug, ...occurrenceFilters.params], "pub.public_geom");
      const result = await query<{
        feature_id: string;
        label: string;
        kind: string;
        species_count: number;
        occurrence_count: number;
        geometry: string;
      }>(
        `
          select
            'hex:' || md5(st_asgeojson(pub.public_geom)) as feature_id,
            taxon.common_name as label,
            'species_presence'::text as kind,
            1::int as species_count,
            count(*)::int as occurrence_count,
            st_asgeojson(pub.public_geom) as geometry
          from occurrences_public pub
          join occurrences_normalized occ on occ.id = pub.normalized_occurrence_id
          join taxa taxon on taxon.id = occ.taxon_id
          left join sources src on src.id = occ.source_id
          left join areas_admin dept on dept.id = occ.area_admin_id
          left join areas_protected pa on pa.id = occ.area_protected_id
          ${whereSql}${envelope.whereSql}
          group by st_asgeojson(pub.public_geom), pub.public_geom, taxon.common_name
          order by occurrence_count desc, feature_id asc
        `
        ,
        envelope.params
      );

      return {
        type: "FeatureCollection",
        features: result.rows.map((row) => ({
          type: "Feature",
          id: row.feature_id,
          properties: {
            id: row.feature_id,
            kind: "species_presence",
            label: row.label,
            speciesCount: Number(row.species_count ?? 1),
            occurrenceCount: Number(row.occurrence_count ?? 0),
            biodiversityLabel: "Presencia pública generalizada"
          },
          geometry: JSON.parse(row.geometry)
        }))
      };
    }

    const { params, whereSql } = buildOccurrenceFilters(filters);
    const envelope = buildEnvelopeParams(options.bbox, params, "pub.public_geom");
    const result = await query<{
      feature_id: string;
      label: string;
      species_count: number;
      protected_count: number;
      source_count: number;
      geometry: string;
    }>(
      `
        select
          'hex:' || md5(st_asgeojson(pub.public_geom)) as feature_id,
          'Celda pública' as label,
          count(distinct taxon.slug)::int as species_count,
          count(*) filter (where occ.area_protected_id is not null)::int as protected_count,
          count(distinct src.id)::int as source_count,
          st_asgeojson(pub.public_geom) as geometry
        from occurrences_public pub
        join occurrences_normalized occ on occ.id = pub.normalized_occurrence_id
        left join taxa taxon on taxon.id = occ.taxon_id
        left join sources src on src.id = occ.source_id
        left join areas_admin dept on dept.id = occ.area_admin_id
        left join areas_protected pa on pa.id = occ.area_protected_id
        ${whereSql ? `${whereSql}${envelope.whereSql}` : `where true${envelope.whereSql}`}
        group by st_asgeojson(pub.public_geom), pub.public_geom
        order by feature_id asc
      `,
      envelope.params
    );

    return {
      type: "FeatureCollection",
      features: result.rows.map((row) => ({
        type: "Feature",
        id: row.feature_id,
        properties: {
          id: row.feature_id,
          kind: "public_hex",
          label: row.label,
          speciesCount: Number(row.species_count ?? 0),
          protectedCount: Number(row.protected_count ?? 0),
          visibility: "generalized_public",
          sourceCount: Number(row.source_count ?? 0),
          biodiversityLabel: mapFeatureBiodiversityLabel(Number(row.species_count ?? 0))
        },
        geometry: JSON.parse(row.geometry)
      }))
    };
  }
);

type MapMarkerArgs = {
  mode?: MapMarkerMode;
  scopeType?: MapScopeType;
  scopeId?: string;
  filters?: MapFilters;
  bbox?: LayerBBox;
};

const getDemoCoveragePreviewMarkers = async ({
  filters = {},
  scopeId,
  scopeType = "country"
}: Required<Pick<MapMarkerArgs, "filters" | "scopeId" | "scopeType">>) => {
  const scope = await normalizePanelScope(scopeType, scopeId);
  const occurrences = getDemoFilteredOccurrences(filters).filter((occurrence) =>
    scopeMatchesOccurrence(occurrence, scope.scopeType, scope.scopeId)
  );
  const speciesById = new Map(listDemoSpecies().map((entry) => [entry.id, entry]));
  const cellCollection = buildPublicHexCollection(occurrences);
  const featureById = new Map(
    cellCollection.features.map((feature) => [
      String(feature.properties?.id ?? ""),
      feature
    ])
  );
  const speciesBuckets = new Map<
    string,
    {
      totalCount: number;
      perHexCounts: Map<string, number>;
      bestHexId: string | null;
      bestHexCount: number;
    }
  >();

  for (const occurrence of occurrences) {
    const hexId = buildPublicHexId(occurrence.lng, occurrence.lat);
    const bucket = speciesBuckets.get(occurrence.speciesId) ?? {
      totalCount: 0,
      perHexCounts: new Map<string, number>(),
      bestHexId: null,
      bestHexCount: 0
    };
    bucket.totalCount += 1;
    const nextHexCount = (bucket.perHexCounts.get(hexId) ?? 0) + 1;
    bucket.perHexCounts.set(hexId, nextHexCount);
    if (nextHexCount >= bucket.bestHexCount) {
      bucket.bestHexId = hexId;
      bucket.bestHexCount = nextHexCount;
    }
    speciesBuckets.set(occurrence.speciesId, bucket);
  }

  return Array.from(speciesBuckets.entries())
    .map(([speciesId, bucket]) => {
      const species = speciesById.get(speciesId);
      const feature = bucket.bestHexId ? featureById.get(bucket.bestHexId) : undefined;
      if (!species || !feature || !bucket.bestHexId) {
        return null;
      }

      const point =
        typeof feature.properties?.centerLng === "number" &&
        typeof feature.properties?.centerLat === "number"
          ? {
              longitude: Number(feature.properties.centerLng),
              latitude: Number(feature.properties.centerLat)
            }
          : getPublicPointFromPolygon(feature.geometry);

      return buildMapSpeciesMarker({
        id: `coverage:${species.slug}:${bucket.bestHexId}`,
        mode: "coverage_preview",
        occurrenceCount: bucket.totalCount,
        point,
        scientificName: species.scientificName,
        slug: species.slug,
        group: species.group,
        speciesId,
        visual: buildVisual({
          commonName: species.commonName,
          group: species.group
        }),
        label: species.commonName,
        scopeRef: {
          scopeType: "public_hex",
          scopeId: bucket.bestHexId
        }
      });
    })
    .filter((marker): marker is MapSpeciesMarker => Boolean(marker))
    .sort(
      (left, right) =>
        right.occurrenceCount - left.occurrenceCount || left.label.localeCompare(right.label, "es")
    )
    .slice(0, 3);
};

const getDemoSpeciesPresenceMarkers = async ({
  bbox,
  filters = {}
}: {
  bbox: LayerBBox | undefined;
  filters: MapFilters;
}) => {
  const activeSpecies = await getSpecies(filters.taxonSlug ?? "");
  if (!activeSpecies) {
    return [];
  }

  const collection = buildPublicHexCollection(
    getDemoFilteredOccurrences(filters).filter((occurrence) => occurrence.speciesId === activeSpecies.id)
  );
  const features = bbox
    ? collection.features.filter((feature) => featureIntersectsBBox(feature, bbox))
    : collection.features;

  return features
    .map((feature) => {
      const scopeId = String(feature.properties?.id ?? "");
      return buildMapSpeciesMarker({
        id: `species:${activeSpecies.slug}:${scopeId}`,
        mode: "species_presence",
        occurrenceCount: Number(feature.properties?.occurrenceCount ?? 0),
        point:
          typeof feature.properties?.centerLng === "number" &&
          typeof feature.properties?.centerLat === "number"
            ? {
                longitude: Number(feature.properties.centerLng),
                latitude: Number(feature.properties.centerLat)
              }
            : getPublicPointFromPolygon(feature.geometry),
        scientificName: activeSpecies.scientificName,
        slug: activeSpecies.slug,
        group: activeSpecies.group,
        speciesId: activeSpecies.id,
        visual: buildVisual({
          commonName: activeSpecies.commonName,
          group: activeSpecies.group
        }),
        label: activeSpecies.commonName,
        scopeRef: {
          scopeType: "public_hex",
          scopeId
        }
      });
    })
    .sort(
      (left, right) =>
        right.occurrenceCount - left.occurrenceCount || left.scopeRef.scopeId.localeCompare(right.scopeRef.scopeId, "es")
    )
    .slice(0, 64);
};

export const getMapMarkers = async ({
  mode = "coverage_preview",
  scopeType = "country",
  scopeId = "guatemala",
  filters = {},
  bbox
}: MapMarkerArgs = {}): Promise<MapMarkerResponse> => {
  await ensureData();

  if (!isDatabaseConfigured()) {
    const markers =
      mode === "species_presence"
        ? await getDemoSpeciesPresenceMarkers({
            bbox,
            filters
          })
        : await getDemoCoveragePreviewMarkers({
            filters,
            scopeId,
            scopeType
          });

    return {
      mode,
      markers,
      meta: {
        totalCount: markers.length,
        returnedCount: markers.length,
        clustered: false,
        truncated: false
      }
    };
  }

  if (mode === "coverage_preview") {
    const scope = await normalizePanelScope(scopeType, scopeId);
    const selectionFilters = buildScopedOccurrenceFilters(scope.scopeType, scope.scopeId, filters);
    const envelope = buildEnvelopeParams(
      bbox,
      selectionFilters.params,
      "pub.public_geom"
    );
    const rows = await query<MarkerRow>(
      `
        with species_hex as (
          select
            taxon.slug as species_id,
            taxon.slug,
            taxon.common_name,
            taxon.scientific_name,
            taxon.taxonomic_group,
            'hex:' || md5(st_asgeojson(pub.public_geom)) as hex_id,
            count(*)::int as hex_occurrence_count,
            st_x(st_pointonsurface(pub.public_geom))::float as longitude,
            st_y(st_pointonsurface(pub.public_geom))::float as latitude,
            media.url as media_url,
            media.alt_text as media_alt_text,
            media.attribution as media_attribution,
            media.license as media_license,
            media_source.name as media_source_name
          from occurrences_normalized occ
          join occurrences_public pub on pub.normalized_occurrence_id = occ.id
          join taxa taxon on taxon.id = occ.taxon_id
          left join sources src on src.id = occ.source_id
          left join areas_admin dept on dept.id = occ.area_admin_id
          left join areas_protected pa on pa.id = occ.area_protected_id
          left join lateral (
            select url, alt_text, attribution, license, source_id
            from taxon_media media
            where media.taxon_id = taxon.id
            order by media.is_primary desc, media.sort_order asc, media.created_at asc
            limit 1
          ) media on true
          left join sources media_source on media_source.id = media.source_id
          ${selectionFilters.whereSql}${envelope.whereSql}
          group by
            taxon.id,
            taxon.slug,
            taxon.common_name,
            taxon.scientific_name,
            taxon.taxonomic_group,
            pub.public_geom,
            media.url,
            media.alt_text,
            media.attribution,
            media.license,
            media_source.name
        ),
        ranked_hex as (
          select
            *,
            sum(hex_occurrence_count) over (partition by species_id)::int as occurrence_count,
            row_number() over (
              partition by species_id
              order by hex_occurrence_count desc, hex_id asc
            ) as hex_rank
          from species_hex
        )
        select
          'coverage:' || slug || ':' || hex_id as marker_id,
          hex_id as scope_id,
          species_id,
          slug,
          common_name,
          scientific_name,
          taxonomic_group,
          occurrence_count,
          longitude,
          latitude,
          media_url,
          media_alt_text,
          media_attribution,
          media_license,
          media_source_name,
          count(*) over()::int as total_count
        from ranked_hex
        where hex_rank = 1
        order by occurrence_count desc, common_name asc
        limit 3
      `,
      envelope.params
    );

    return {
      mode,
      markers: rows.rows.map((row) =>
        buildMapSpeciesMarker({
          id: row.marker_id,
          mode,
          occurrenceCount: Number(row.occurrence_count ?? 0),
          point: {
            longitude: Number(row.longitude),
            latitude: Number(row.latitude)
          },
          scientificName: row.scientific_name,
          slug: row.slug,
          group: row.taxonomic_group,
          speciesId: row.species_id,
          visual: buildVisual({
            alt: row.media_alt_text,
            commonName: row.common_name,
            group: row.taxonomic_group,
            license: row.media_license,
            sourceName: row.media_source_name,
            src: row.media_url,
            attribution: row.media_attribution
          }),
          label: row.common_name,
          scopeRef: {
            scopeType: "public_hex",
            scopeId: row.scope_id
          }
        })
      ),
      meta: {
        totalCount: Number(rows.rows[0]?.total_count ?? rows.rows.length),
        returnedCount: rows.rows.length,
        clustered: false,
        truncated: Number(rows.rows[0]?.total_count ?? rows.rows.length) > rows.rows.length
      }
    };
  }

  const activeSpecies = await getSpecies(filters.taxonSlug ?? "");
  if (!activeSpecies) {
    return {
      mode,
      markers: [],
      meta: {
        totalCount: 0,
        returnedCount: 0,
        clustered: false,
        truncated: false
      }
    };
  }

  const occurrenceFilters = buildOccurrenceFilters(filters);
  const whereSql = prependWhereClause(occurrenceFilters.whereSql, `taxon.slug = $1`);
  const envelope = buildEnvelopeParams(
    bbox,
    [activeSpecies.slug, ...occurrenceFilters.params],
    "pub.public_geom"
  );
  const rows = await query<MarkerRow>(
    `
      select
        'species:' || taxon.slug || ':' || 'hex:' || md5(st_asgeojson(pub.public_geom)) as marker_id,
        'hex:' || md5(st_asgeojson(pub.public_geom)) as scope_id,
        taxon.slug as species_id,
        taxon.slug,
        taxon.common_name,
        taxon.scientific_name,
        taxon.taxonomic_group,
        count(*)::int as occurrence_count,
        st_x(st_pointonsurface(pub.public_geom))::float as longitude,
        st_y(st_pointonsurface(pub.public_geom))::float as latitude,
        media.url as media_url,
        media.alt_text as media_alt_text,
        media.attribution as media_attribution,
        media.license as media_license,
        media_source.name as media_source_name,
        count(*) over()::int as total_count
      from occurrences_public pub
      join occurrences_normalized occ on occ.id = pub.normalized_occurrence_id
      join taxa taxon on taxon.id = occ.taxon_id
      left join sources src on src.id = occ.source_id
      left join areas_admin dept on dept.id = occ.area_admin_id
      left join areas_protected pa on pa.id = occ.area_protected_id
      left join lateral (
        select url, alt_text, attribution, license, source_id
        from taxon_media media
        where media.taxon_id = taxon.id
        order by media.is_primary desc, media.sort_order asc, media.created_at asc
        limit 1
      ) media on true
      left join sources media_source on media_source.id = media.source_id
      ${whereSql}${envelope.whereSql}
      group by
        taxon.id,
        taxon.slug,
        taxon.common_name,
        taxon.scientific_name,
        taxon.taxonomic_group,
        pub.public_geom,
        media.url,
        media.alt_text,
        media.attribution,
        media.license,
        media_source.name
      order by occurrence_count desc, marker_id asc
      limit 64
    `,
    envelope.params
  );

  return {
    mode,
    markers: rows.rows.map((row) =>
      buildMapSpeciesMarker({
        id: row.marker_id,
        mode,
        occurrenceCount: Number(row.occurrence_count ?? 0),
        point: {
          longitude: Number(row.longitude),
          latitude: Number(row.latitude)
        },
        scientificName: row.scientific_name,
        slug: row.slug,
        group: row.taxonomic_group,
        speciesId: row.species_id,
        visual: buildVisual({
          alt: row.media_alt_text,
          commonName: row.common_name,
          group: row.taxonomic_group,
          license: row.media_license,
          sourceName: row.media_source_name,
          src: row.media_url,
          attribution: row.media_attribution
        }),
        label: row.common_name,
        scopeRef: {
          scopeType: "public_hex",
          scopeId: row.scope_id
        }
      })
    ),
    meta: {
      totalCount: Number(rows.rows[0]?.total_count ?? rows.rows.length),
      returnedCount: rows.rows.length,
      clustered: false,
      truncated: Number(rows.rows[0]?.total_count ?? rows.rows.length) > rows.rows.length
    }
  };
};
