# BioMap Guatemala ETL

This package holds the ingestion and normalization scaffolding for BioMap Guatemala.

From the repo root, the supported shortcut is `bash ./scripts/run-etl-python.sh`, which creates `.etl-venv` on demand and installs the ETL package there automatically.

## Current connectors

- `biodiversidad_gt.py`: reads public Darwin Core RSS metadata, archive bundles, and one public occurrence endpoint
- `geoboundaries.py`: fetches Guatemala ADM0 and ADM1 GeoJSON metadata and download links from geoBoundaries
- `pipeline.py`: normalizes archive occurrence rows, multimedia candidates, and regional rollups into a compact public snapshot
- `loader.py`: builds a repeatable DB-ready atlas bundle and loads PostGIS-backed atlas tables

## Example

```bash
cd workers/etl
bash ../../scripts/run-etl-python.sh -m biomap_gt_etl.cli snapshot --output ../../tmp/biodiversidad-snapshot.json
```

Direct invocation from inside `workers/etl` still works after the package has been installed into a virtualenv:

```bash
cd workers/etl
python3 -m biomap_gt_etl.cli snapshot --output ../../tmp/biodiversidad-snapshot.json
```

Load the atlas database from live sources:

```bash
bash ../../scripts/run-etl-python.sh -m biomap_gt_etl.cli load \
  --database-url postgresql://postgres:postgres@localhost:55432/biogt \
  --replace-atlas-data
```

Backfill missing taxon media without touching existing `taxon_media` rows:

```bash
bash ../../scripts/run-etl-python.sh -m biomap_gt_etl.cli backfill-media \
  --database-url postgresql://postgres:postgres@localhost:55432/biogt
```

Preview a bounded run first:

```bash
bash ../../scripts/run-etl-python.sh -m biomap_gt_etl.cli backfill-media \
  --database-url postgresql://postgres:postgres@localhost:55432/biogt \
  --dry-run \
  --limit 25
```

Deterministic fixture loads are also supported:

```bash
bash ../../scripts/run-etl-python.sh -m biomap_gt_etl.cli load \
  --database-url postgresql://postgres:postgres@localhost:55432/biogt \
  --replace-atlas-data \
  --from-snapshot ../../tmp/biodiversidad-snapshot.json
```

The loader currently does the following:

- Imports all published Biodiversidad.gt DwC-A archives unless `--archive-limit` is provided.
- Reloads Guatemala country + department geometry from geoBoundaries.
- Preserves and upserts the current protected-area subset used by the public atlas.
- Rebuilds `taxon_presence_rollups`, `public_cell_rollups`, and `area_metrics`.
- Keeps exact coordinates internal while publishing only generalized public geometry.
- Can backfill one safe primary image per taxon from exact Biodiversidad.gt media hits, with GBIF as a species-only fallback when license metadata is explicit.
- The default local compose stack publishes Postgres on `localhost:55432` so it does not collide with an existing host Postgres on `localhost:5432`.
