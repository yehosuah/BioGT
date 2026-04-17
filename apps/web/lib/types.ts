import type { Feature, FeatureCollection, Polygon } from "geojson";

export type SourceTier = "official" | "institutional" | "community";
export const roleValues = ["member", "contributor", "moderator", "admin"] as const;
export type Role = (typeof roleValues)[number];

export type AreaKind =
  | "country"
  | "department"
  | "municipality"
  | "protected_area"
  | "public_hex";
export type Visibility = "summary_only" | "generalized_public" | "internal_exact";
export type MapScopeType = Exclude<AreaKind, "municipality">;
export const defaultTaxonomicGroups = [
  "aves",
  "mamiferos",
  "anfibios",
  "reptiles",
  "peces",
  "insectos",
  "aracnidos",
  "moluscos",
  "otros-invertebrados",
  "flora",
  "hongos",
  "fauna"
] as const;
export type KnownTaxonomicGroup = (typeof defaultTaxonomicGroups)[number];
export type TaxonomicGroup = KnownTaxonomicGroup | (string & {});
export type TaxonScope = "all" | "flora" | "fauna";
export type MapViewMode = "coverage" | "species";
export const mapSpeciesSortValues = ["presence", "recent", "name"] as const;
export type MapSpeciesSort = (typeof mapSpeciesSortValues)[number];
export const mapMarkerModeValues = ["coverage_preview", "species_presence"] as const;
export type MapMarkerMode = (typeof mapMarkerModeValues)[number];

export const submissionTypeValues = [
  "observation_create",
  "data_correction",
  "species_editorial",
  "area_editorial"
] as const;
export type SubmissionType = (typeof submissionTypeValues)[number];

export const submissionStatusValues = [
  "draft",
  "submitted",
  "changes_requested",
  "approved",
  "rejected"
] as const;
export type SubmissionStatus = (typeof submissionStatusValues)[number];

export const moderationDecisionValues = ["approve", "reject", "request_changes"] as const;
export type ModerationDecision = (typeof moderationDecisionValues)[number];

export const uploadStatusValues = [
  "pending",
  "presigned",
  "uploaded",
  "finalized",
  "rejected"
] as const;
export type UploadStatus = (typeof uploadStatusValues)[number];

export const targetEntityTypeValues = ["observation", "species", "area", "source", "dataset"] as const;
export type TargetEntityType = (typeof targetEntityTypeValues)[number];

export type SourceRecord = {
  id: string;
  slug: string;
  name: string;
  tier: SourceTier;
  license: string;
  freshness: string;
  homepage: string;
  citation: string;
  description: string;
};

export type CitationRecord = {
  id: string;
  entityType: "area" | "species" | "source" | "story";
  entityId: string;
  title: string;
  text: string;
  href: string;
};

export type StoryModule = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  accent: string;
  href?: string;
};

export type SpeciesRecord = {
  id: string;
  slug: string;
  commonName: string;
  scientificName: string;
  group: TaxonomicGroup;
  status: string;
  endemism: string;
  summary: string;
  presenceAreaIds: string[];
  sourceIds: string[];
  sourceTiers?: SourceTier[];
  heroMetric: string;
};

export type AreaMetrics = {
  speciesCount: number;
  protectedCount: number;
  endemicCount: number;
  storyLabel: string;
};

export type AreaRecord = {
  id: string;
  slug: string;
  name: string;
  kind: Exclude<AreaKind, "public_hex">;
  department?: string;
  summary: string;
  metrics: AreaMetrics;
  featuredSpeciesIds: string[];
  sourceIds: string[];
  sourceTiers?: SourceTier[];
  visibility: Visibility;
  geometryId: string;
};

export type InternalOccurrence = {
  id: string;
  speciesId: string;
  areaId: string;
  departmentSlug: string;
  sourceId: string;
  visibility: Visibility;
  lat: number;
  lng: number;
  elevationBand: "baja" | "media" | "alta";
  observedAt: string;
  protectedArea: boolean;
};

export type SearchResult = {
  id: string;
  slug: string;
  type: "species" | "area" | "source";
  title: string;
  subtitle: string;
  href: string;
};

export type QuickFact = {
  label: string;
  value: string;
};

export type SpeciesVisual = {
  kind: "photo" | "fallback";
  src: string | null;
  alt: string;
  attribution: string | null;
  license: string | null;
  sourceName: string | null;
  accent: string;
  fallbackLabel: string;
};

export type AtlasSourceMeta = {
  canonicalLabel: string;
  optionalOverlayLabel: string;
  freshnessLabel: string;
  confidenceLabel: string;
};

export type MapSelectionSummary = {
  scopeType: MapScopeType;
  scopeId: string;
  title: string;
  subtitle: string;
  metrics: {
    visibleSpecies: number;
    visibleOccurrences: number;
    activeSources: number;
  };
  sourceMeta: AtlasSourceMeta;
};

export type MapSpeciesCard = {
  speciesId: string;
  slug: string;
  commonName: string;
  scientificName: string;
  group: TaxonomicGroup;
  status: string;
  endemism: string;
  summary: string;
  heroMetric: string;
  presenceCount: number;
  latestObservedAt: string | null;
  sourceTiers: SourceTier[];
  quickFacts: QuickFact[];
  visual: SpeciesVisual;
  href: string;
};

export type PublicMapPoint = {
  longitude: number;
  latitude: number;
};

export type MapMarkerScopeRef = {
  scopeType: MapScopeType;
  scopeId: string;
};

export type MapSpeciesMarker = {
  id: string;
  mode: MapMarkerMode;
  speciesId: string;
  slug: string;
  label: string;
  scientificName: string;
  group: TaxonomicGroup;
  occurrenceCount: number;
  point: PublicMapPoint;
  visual: SpeciesVisual;
  scopeRef: MapMarkerScopeRef;
};

export type MapMarkerResponse = {
  mode: MapMarkerMode;
  markers: MapSpeciesMarker[];
};

export type MapPanelResponse = {
  selection: MapSelectionSummary;
  species: MapSpeciesCard[];
  availableSorts: MapSpeciesSort[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  taxonScope: TaxonScope;
  viewMode: MapViewMode;
};

export type MapSpeciesPresenceArea = {
  scopeType: Exclude<MapScopeType, "country">;
  scopeId: string;
  title: string;
  subtitle: string;
  occurrenceCount: number;
  latestObservedAt: string | null;
};

export type MapSpeciesPanelResponse = {
  focusSpecies: MapSpeciesCard;
  metrics: {
    visibleDepartments: number;
    visibleProtectedAreas: number;
    visibleCells: number;
    activeSources: number;
  };
  sourceMeta: AtlasSourceMeta;
  places: MapSpeciesPresenceArea[];
  taxonScope: TaxonScope;
  viewMode: MapViewMode;
};

export type MapSummaryResponse = {
  title: string;
  subtitle: string;
  metrics: {
    visibleSpecies: number;
    visibleOccurrences: number;
    activeSources: number;
  };
  filterOptions: {
    taxonScopes: TaxonScope[];
    groups: Array<TaxonomicGroup | "all">;
    sourceTiers: Array<SourceTier | "all">;
    regions: Array<{ id: string; label: string; scopeType: MapScopeType }>;
    elevationBands: Array<"baja" | "media" | "alta" | "all">;
    dateRanges: Array<"30d" | "12m" | "all">;
  };
  featuredAreas: AreaRecord[];
  sourceMeta: AtlasSourceMeta;
  activeMode: MapViewMode;
};

export type FeatureProperties = Record<string, number | string | boolean | null>;

export type MapFeatureCollection = FeatureCollection<Polygon, FeatureProperties>;
export type MapFeature = Feature<Polygon, FeatureProperties>;

export type PublicProfileRecord = {
  id: string;
  slug: string;
  displayName: string;
  bio: string | null;
  affiliation: string | null;
  avatarUrl: string | null;
  role: Role;
  contributionCount: number;
  approvedContributionCount: number;
  joinedAt: string;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  slug: string | null;
  emailVerified: boolean;
};

export type SubmissionMediaRecord = {
  id: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  bucket: string;
  objectKey: string;
  uploadStatus: UploadStatus;
  uploadedAt: string | null;
  finalizedAt: string | null;
  metadata: Record<string, unknown>;
};

export type SubmissionRecord = {
  id: string;
  title: string;
  accountId: string;
  accountSlug: string | null;
  accountDisplayName: string | null;
  submissionType: SubmissionType;
  status: SubmissionStatus;
  schemaVersion: number;
  targetEntityType: TargetEntityType | null;
  targetEntityRef: string | null;
  payload: Record<string, unknown>;
  reviewerNotes: string | null;
  conflictSummary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  media: SubmissionMediaRecord[];
};

export type ModerationQueueItem = {
  id: string;
  title: string;
  submissionType: SubmissionType;
  status: SubmissionStatus;
  accountDisplayName: string | null;
  accountSlug: string | null;
  contributorRole: Role;
  contributorTrustScore: number;
  sourceTier: SourceTier | null;
  hasConflict: boolean;
  targetEntityType: TargetEntityType | null;
  targetEntityRef: string | null;
  createdAt: string;
  submittedAt: string | null;
};

export type ModerationReviewRecord = {
  id: string;
  submissionId: string;
  reviewerId: string;
  reviewerName: string | null;
  decision: ModerationDecision;
  notes: string | null;
  diff: Record<string, unknown>;
  reviewRound: number;
  createdAt: string;
};

export type AuditLogRecord = {
  id: string;
  actorAccountId: string | null;
  eventType: string;
  entityType: string;
  entityRef: string;
  beforePayload: Record<string, unknown>;
  afterPayload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
};
