create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('member', 'contributor', 'moderator', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'submission_type_enum') then
    create type submission_type_enum as enum (
      'observation_create',
      'data_correction',
      'species_editorial',
      'area_editorial'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'submission_status_enum') then
    create type submission_status_enum as enum (
      'draft',
      'submitted',
      'changes_requested',
      'approved',
      'rejected'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'moderation_decision_enum') then
    create type moderation_decision_enum as enum ('approve', 'reject', 'request_changes');
  end if;

  if not exists (select 1 from pg_type where typname = 'upload_status_enum') then
    create type upload_status_enum as enum ('pending', 'presigned', 'uploaded', 'finalized', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'overlay_status_enum') then
    create type overlay_status_enum as enum ('approved', 'superseded');
  end if;
end $$;

create or replace function set_row_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

alter table taxa
  add column if not exists hero_metric text,
  add column if not exists featured_rank integer not null default 0;

alter table areas_admin
  add column if not exists featured_rank integer not null default 0,
  add column if not exists department text;

alter table areas_protected
  add column if not exists featured_rank integer not null default 0,
  add column if not exists department text;

alter table story_modules
  add column if not exists sort_order integer not null default 0;

create table if not exists entity_source_links (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_ref text not null,
  source_id text not null references sources(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_ref, source_id)
);

alter table accounts
  add column if not exists slug text unique,
  add column if not exists email text,
  add column if not exists bio text,
  add column if not exists affiliation text,
  add column if not exists avatar_url text,
  add column if not exists trust_score integer not null default 0,
  add column if not exists trust_flags jsonb not null default '[]'::jsonb,
  add column if not exists contribution_count integer not null default 0,
  add column if not exists approved_contribution_count integer not null default 0,
  add column if not exists rejected_contribution_count integer not null default 0,
  add column if not exists suspended_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table accounts
  alter column display_name set default 'Colaborador BioGT';

alter table accounts
  alter column role drop default;

alter table accounts
  alter column role type app_role
  using case
    when role in ('member', 'contributor', 'moderator', 'admin') then role::app_role
    else 'member'::app_role
  end;

alter table accounts
  alter column role set default 'member';

drop trigger if exists accounts_set_updated_at on accounts;
create trigger accounts_set_updated_at
before update on accounts
for each row execute function set_row_updated_at();

create table if not exists "user" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists "session" (
  id uuid primary key default gen_random_uuid(),
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  user_id uuid not null references "user"(id) on delete cascade
);

create table if not exists "account" (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  provider_id text not null,
  user_id uuid not null references "user"(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, account_id)
);

create table if not exists verification (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists session_user_id_idx on "session"(user_id);
create index if not exists verification_identifier_idx on verification(identifier);

drop trigger if exists user_set_updated_at on "user";
create trigger user_set_updated_at
before update on "user"
for each row execute function set_row_updated_at();

drop trigger if exists session_set_updated_at on "session";
create trigger session_set_updated_at
before update on "session"
for each row execute function set_row_updated_at();

drop trigger if exists account_set_updated_at on "account";
create trigger account_set_updated_at
before update on "account"
for each row execute function set_row_updated_at();

drop trigger if exists verification_set_updated_at on verification;
create trigger verification_set_updated_at
before update on verification
for each row execute function set_row_updated_at();

alter table submissions
  add column if not exists title text not null default 'Borrador sin título',
  add column if not exists schema_version integer not null default 1,
  add column if not exists target_entity_type text,
  add column if not exists target_entity_ref text,
  add column if not exists reviewer_notes text,
  add column if not exists conflict_summary jsonb not null default '{}'::jsonb,
  add column if not exists submitted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table submissions
  alter column status drop default;

alter table submissions
  alter column submission_type type submission_type_enum
  using case
    when submission_type in ('observation_create', 'data_correction', 'species_editorial', 'area_editorial') then submission_type::submission_type_enum
    else 'data_correction'::submission_type_enum
  end;

alter table submissions
  alter column status type submission_status_enum
  using case
    when status = 'pending_review' then 'submitted'::submission_status_enum
    when status in ('draft', 'submitted', 'changes_requested', 'approved', 'rejected') then status::submission_status_enum
    else 'draft'::submission_status_enum
  end;

alter table submissions
  alter column status set default 'draft';

drop trigger if exists submissions_set_updated_at on submissions;
create trigger submissions_set_updated_at
before update on submissions
for each row execute function set_row_updated_at();

alter table submission_media
  add column if not exists bucket text,
  add column if not exists object_key text,
  add column if not exists file_name text,
  add column if not exists content_type text,
  add column if not exists byte_size integer,
  add column if not exists checksum_sha256 text,
  add column if not exists upload_status upload_status_enum not null default 'pending',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists uploaded_at timestamptz,
  add column if not exists finalized_at timestamptz,
  add column if not exists visibility text not null default 'moderator_only';

alter table moderation_reviews
  add column if not exists structured_diff jsonb not null default '{}'::jsonb,
  add column if not exists review_round integer not null default 1;

alter table moderation_reviews
  alter column decision type moderation_decision_enum
  using case
    when decision in ('approve', 'reject', 'request_changes') then decision::moderation_decision_enum
    when decision = 'request_changes' then 'request_changes'::moderation_decision_enum
    else 'approve'::moderation_decision_enum
  end;

alter table audit_log
  add column if not exists before_payload jsonb not null default '{}'::jsonb,
  add column if not exists after_payload jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update audit_log
set after_payload = payload
where payload is not null
  and after_payload = '{}'::jsonb;

create table if not exists curated_overlays (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_ref text not null,
  field_path text not null,
  value jsonb not null,
  source_tier source_tier,
  base_source_id text references sources(id) on delete set null,
  submission_id uuid references submissions(id) on delete set null,
  review_id uuid references moderation_reviews(id) on delete set null,
  status overlay_status_enum not null default 'approved',
  superseded_by uuid references curated_overlays(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists curated_overlays_active_field_idx
  on curated_overlays(entity_type, entity_ref, field_path)
  where superseded_by is null and status = 'approved';

create table if not exists source_conflicts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade,
  entity_type text not null,
  entity_ref text not null,
  field_path text not null,
  left_source_id text references sources(id) on delete cascade,
  right_source_id text references sources(id) on delete cascade,
  left_value jsonb not null default '{}'::jsonb,
  right_value jsonb not null default '{}'::jsonb,
  resolution text,
  created_at timestamptz not null default now()
);

create index if not exists submissions_account_status_idx on submissions(account_id, status);
create index if not exists submissions_type_status_idx on submissions(submission_type, status);
create index if not exists moderation_reviews_submission_idx on moderation_reviews(submission_id, created_at desc);
create index if not exists entity_source_links_lookup_idx on entity_source_links(entity_type, entity_ref);
create index if not exists curated_overlays_entity_idx on curated_overlays(entity_type, entity_ref, published_at desc);
create index if not exists source_conflicts_entity_idx on source_conflicts(entity_type, entity_ref, created_at desc);

create or replace view contributor_profiles as
select
  a.id,
  a.slug,
  coalesce(a.display_name, u.name, 'Colaborador BioGT') as display_name,
  a.bio,
  a.affiliation,
  a.avatar_url,
  a.role,
  a.contribution_count,
  a.approved_contribution_count,
  a.created_at as joined_at
from accounts a
left join "user" u on u.id = a.auth_user_id
where a.slug is not null;

create or replace view moderation_queue as
select
  s.id,
  s.title,
  s.submission_type,
  s.status,
  s.target_entity_type,
  s.target_entity_ref,
  s.created_at,
  s.submitted_at,
  a.display_name as account_display_name,
  a.slug as account_slug,
  a.role as contributor_role,
  a.trust_score as contributor_trust_score,
  (
    select min(src.tier)
    from entity_source_links esl
    join sources src on src.id = esl.source_id
    where esl.entity_ref = s.target_entity_ref
      and esl.entity_type = s.target_entity_type
  ) as source_tier,
  exists (
    select 1
    from source_conflicts sc
    where sc.submission_id = s.id
  ) as has_conflict
from submissions s
join accounts a on a.id = s.account_id;
