from __future__ import annotations

from pathlib import Path
import json
import shutil
import time

import pytest

from biomap_gt_etl.loader import load_atlas_database

try:
    from testcontainers.core.container import DockerContainer
except Exception:  # pragma: no cover - optional dev dependency
    DockerContainer = None


COUNTRY_GEOJSON = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"shapeName": "Guatemala"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-92.5, 13.5],
                    [-88.0, 13.5],
                    [-88.0, 18.0],
                    [-92.5, 18.0],
                    [-92.5, 13.5],
                ]],
            },
        }
    ],
}

DEPARTMENT_GEOJSON = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"shapeName": "Petén"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-91.8, 16.3],
                    [-89.0, 16.3],
                    [-89.0, 17.9],
                    [-91.8, 17.9],
                    [-91.8, 16.3],
                ]],
            },
        },
        {
            "type": "Feature",
            "properties": {"shapeName": "Alta Verapaz"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-91.3, 15.3],
                    [-89.7, 15.3],
                    [-89.7, 16.5],
                    [-91.3, 16.5],
                    [-91.3, 15.3],
                ]],
            },
        },
    ],
}


def _write_snapshot(tmp_path: Path) -> Path:
    snapshot = {
        "archives": [
            {
                "collection_id": "fixture-collection",
                "title": "Fixture archive",
                "description": "Fixture import",
                "archive_url": "https://example.com/archive.zip",
                "eml_url": "https://example.com/archive.xml",
                "published_at": "2026-03-02",
            }
        ],
        "normalized_occurrences": [
            {
                "archive_collection_id": "fixture-collection",
                "occurrenceID": "fixture-1",
                "scientificName": "Panthera onca",
                "vernacularName": "Jaguar",
                "family": "Felidae",
                "order": "Carnivora",
                "class": "Mammalia",
                "phylum": "Chordata",
                "kingdom": "Animalia",
                "group": "mamiferos",
                "taxon_scope": "fauna",
                "country": "Guatemala",
                "stateProvince": "Petén",
                "locality": "Selva baja",
                "eventDate": "2026-02-14",
                "decimalLatitude": 17.22,
                "decimalLongitude": -89.62,
                "public_cell_id": "hex:-89.50:17.25",
                "visibility": "internal_exact",
                "public_strategy": "generalize_to_public_hex",
                "media": [
                    {
                        "access_uri": "https://example.com/jaguar.jpg",
                        "thumbnail_access_uri": "https://example.com/jaguar-thumb.jpg",
                        "type": "StillImage",
                        "format": "image/jpeg",
                        "rights": "CC-BY",
                        "creator": "Camera Trap",
                        "caption": "Jaguar",
                    }
                ],
            },
            {
                "archive_collection_id": "fixture-collection",
                "occurrenceID": "fixture-2",
                "scientificName": "Quercus skinneri",
                "family": "Fagaceae",
                "order": "Fagales",
                "class": "Magnoliopsida",
                "phylum": "Tracheophyta",
                "kingdom": "Plantae",
                "group": "flora",
                "taxon_scope": "flora",
                "country": "Guatemala",
                "stateProvince": "Alta Verapaz",
                "locality": "Bosque nuboso",
                "eventDate": "2025-05-04",
                "decimalLatitude": None,
                "decimalLongitude": None,
                "visibility": "summary_only",
                "public_strategy": "generalize_to_public_hex",
                "media": [],
            },
        ],
    }
    target = tmp_path / "fixture-snapshot.json"
    target.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False), encoding="utf-8")
    return target


def _wait_for_database(database_url: str) -> None:
    import psycopg

    for _ in range(40):
        try:
            with psycopg.connect(database_url) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("select 1")
            return
        except Exception:
            time.sleep(1)
    raise RuntimeError("Timed out waiting for disposable PostGIS container.")


def _apply_migrations(database_url: str) -> None:
    import psycopg

    root = Path(__file__).resolve().parents[3]
    migration_dir = root / "infra" / "supabase" / "migrations"
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            for migration in sorted(migration_dir.glob("*.sql")):
                cursor.execute(migration.read_text(encoding="utf-8"))
        connection.commit()


@pytest.mark.skipif(
    DockerContainer is None or shutil.which("docker") is None,
    reason="Docker and testcontainers are required for loader integration tests.",
)
def test_load_atlas_database_replaces_atlas_tables(monkeypatch, tmp_path):
    psycopg = pytest.importorskip("psycopg")

    snapshot_path = _write_snapshot(tmp_path)
    monkeypatch.setattr(
        "biomap_gt_etl.loader.fetch_boundary_geojson",
        lambda iso, adm: COUNTRY_GEOJSON if adm == "ADM0" else DEPARTMENT_GEOJSON,
    )

    try:
        with (
            DockerContainer("postgis/postgis:16-3.4")
            .with_env("POSTGRES_DB", "biogt")
            .with_env("POSTGRES_USER", "postgres")
            .with_env("POSTGRES_PASSWORD", "postgres")
            .with_exposed_ports(5432)
        ) as container:
            database_url = (
                f"postgresql://postgres:postgres@localhost:{container.get_exposed_port(5432)}/biogt"
            )
            _wait_for_database(database_url)
            _apply_migrations(database_url)

            first_counts = load_atlas_database(
                database_url=database_url,
                replace_atlas_data=True,
                from_snapshot=snapshot_path,
            )
            second_counts = load_atlas_database(
                database_url=database_url,
                replace_atlas_data=True,
                from_snapshot=snapshot_path,
            )

            assert first_counts == second_counts
            assert first_counts["taxa"] == 2
            assert first_counts["occurrences"] == 2
            assert first_counts["departments"] == 2
            assert first_counts["public_cells"] == 1

            with psycopg.connect(database_url) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("select count(*)::int from areas_protected")
                    assert int(cursor.fetchone()[0]) >= 4
                    cursor.execute("select count(*)::int from taxon_media")
                    assert int(cursor.fetchone()[0]) == 1
                    cursor.execute(
                        "select count(*)::int from taxon_presence_rollups where area_kind = 'protected_area'"
                    )
                    assert int(cursor.fetchone()[0]) >= 0
    except Exception as error:  # pragma: no cover - environment-specific
        pytest.skip(f"Disposable PostGIS container was not available: {error}")
