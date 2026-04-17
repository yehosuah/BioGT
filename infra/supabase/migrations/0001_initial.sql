create extension if not exists postgis;

create type source_tier as enum ('official', 'institutional', 'community');
create type area_kind as enum ('country', 'department', 'municipality', 'protected_area', 'public_hex');
create type visibility as enum ('summary_only', 'generalized_public', 'internal_exact');

create table if not exists sources (
  id text primary key,
  slug text not null unique,
  name text not null,
  tier source_tier not null,
  license text not null,
  freshness text not null,
  homepage text not null,
  citation text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists datasets (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references sources(id) on delete cascade,
  external_key text,
  title text not null,
  description text,
  archive_url text,
  metadata_url text,
  refreshed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists taxa (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  common_name text not null,
  scientific_name text not null,
  taxonomic_group text not null,
  status text,
  endemism text,
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists taxon_synonyms (
  id uuid primary key default gen_random_uuid(),
  taxon_id uuid not null references taxa(id) on delete cascade,
  synonym text not null,
  source_id text references sources(id),
  created_at timestamptz not null default now()
);

create table if not exists area_geometries (
  id uuid primary key default gen_random_uuid(),
  external_key text unique,
  kind area_kind not null,
  label text not null,
  geom geometry(multipolygon, 4326) not null,
  created_at timestamptz not null default now()
);

create table if not exists areas_admin (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind area_kind not null check (kind in ('country', 'department', 'municipality')),
  summary text,
  geometry_id uuid not null references area_geometries(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists areas_protected (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  summary text,
  wdpa_id text,
  geometry_id uuid not null references area_geometries(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists occurrences_raw (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references datasets(id) on delete set null,
  source_id text not null references sources(id) on delete cascade,
  source_occurrence_id text not null,
  payload jsonb not null,
  ingested_at timestamptz not null default now()
);

create table if not exists occurrences_normalized (
  id uuid primary key default gen_random_uuid(),
  raw_occurrence_id uuid not null references occurrences_raw(id) on delete cascade,
  taxon_id uuid references taxa(id),
  source_id text not null references sources(id) on delete cascade,
  visibility visibility not null,
  area_admin_id uuid references areas_admin(id),
  area_protected_id uuid references areas_protected(id),
  observed_at date,
  elevation_band text,
  is_sensitive boolean not null default false,
  exact_geom geometry(point, 4326),
  public_geom geometry(polygon, 4326),
  created_at timestamptz not null default now()
);

create table if not exists occurrences_public (
  id uuid primary key default gen_random_uuid(),
  normalized_occurrence_id uuid not null references occurrences_normalized(id) on delete cascade,
  visibility visibility not null check (visibility in ('summary_only', 'generalized_public')),
  public_geom geometry(polygon, 4326),
  public_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists species_area_rollups (
  id uuid primary key default gen_random_uuid(),
  taxon_id uuid not null references taxa(id) on delete cascade,
  area_kind area_kind not null,
  area_ref text not null,
  source_tier source_tier not null,
  species_count integer not null default 0,
  occurrence_count integer not null default 0,
  citation_ids text[] not null default '{}',
  refreshed_at timestamptz not null default now()
);

create table if not exists area_metrics (
  id uuid primary key default gen_random_uuid(),
  area_kind area_kind not null,
  area_ref text not null,
  species_count integer not null default 0,
  endemic_count integer not null default 0,
  protected_count integer not null default 0,
  story_label text,
  refreshed_at timestamptz not null default now()
);

create table if not exists story_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  eyebrow text not null,
  title text not null,
  body text not null,
  accent text,
  target_href text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists citations (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_ref text not null,
  title text not null,
  citation_text text not null,
  href text not null,
  created_at timestamptz not null default now()
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  display_name text,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  submission_type text not null,
  status text not null default 'pending_review',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists submission_media (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  storage_path text not null,
  media_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists moderation_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  reviewer_id uuid not null references accounts(id) on delete cascade,
  decision text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_account_id uuid references accounts(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_ref text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
