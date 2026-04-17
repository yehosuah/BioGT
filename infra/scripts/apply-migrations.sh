#!/bin/sh
set -eu

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-biogt}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD:-postgres}"

export PGPASSWORD="${DB_PASSWORD}"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

until pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; do
  sleep 2
done

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
SQL

for file in /migrations/*.sql; do
  version="$(basename "${file}")"
  applied="$(psql "${DATABASE_URL}" -tAc "select 1 from schema_migrations where version = '${version}' limit 1")"

  if [ "${applied}" = "1" ]; then
    echo "Skipping ${version}"
    continue
  fi

  echo "Applying ${version}"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${file}"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c "insert into schema_migrations (version) values ('${version}') on conflict do nothing"
done
