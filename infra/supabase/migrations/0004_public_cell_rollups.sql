create table if not exists public_cell_rollups (
  id uuid primary key default gen_random_uuid(),
  cell_ref text not null,
  source_tier source_tier not null,
  taxon_scope text not null default 'all',
  species_count integer not null default 0,
  occurrence_count integer not null default 0,
  latest_observed_at date,
  refreshed_at timestamptz not null default now(),
  unique (cell_ref, source_tier, taxon_scope)
);

create index if not exists public_cell_rollups_lookup_idx
  on public_cell_rollups(cell_ref, source_tier, taxon_scope, latest_observed_at desc);
