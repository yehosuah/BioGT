create table if not exists taxon_presence_rollups (
  id uuid primary key default gen_random_uuid(),
  taxon_id uuid not null references taxa(id) on delete cascade,
  area_kind area_kind not null check (area_kind in ('country', 'department', 'protected_area', 'public_hex')),
  area_ref text not null,
  source_tier source_tier not null,
  occurrence_count integer not null default 0,
  protected_occurrence_count integer not null default 0,
  latest_observed_at date,
  elevation_bands text[] not null default '{}',
  refreshed_at timestamptz not null default now(),
  unique (taxon_id, area_kind, area_ref, source_tier)
);

create index if not exists taxon_presence_rollups_area_idx
  on taxon_presence_rollups(area_kind, area_ref, source_tier, latest_observed_at desc);

create index if not exists taxon_presence_rollups_taxon_idx
  on taxon_presence_rollups(taxon_id, area_kind, area_ref);

create table if not exists taxon_media (
  id uuid primary key default gen_random_uuid(),
  taxon_id uuid not null references taxa(id) on delete cascade,
  source_id text references sources(id) on delete set null,
  media_kind text not null default 'photo',
  url text not null,
  alt_text text,
  attribution text,
  license text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists taxon_media_taxon_idx
  on taxon_media(taxon_id, is_primary desc, sort_order asc, created_at asc);

create unique index if not exists taxon_media_primary_idx
  on taxon_media(taxon_id)
  where is_primary = true;
