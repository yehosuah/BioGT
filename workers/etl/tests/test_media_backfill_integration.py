from __future__ import annotations

from pathlib import Path
import shutil
import time

import pytest

import biomap_gt_etl.media_backfill as media_backfill
from biomap_gt_etl.media_backfill import ResolutionOutcome, ResolvedMediaRecord, backfill_taxon_media

try:
    from testcontainers.core.container import DockerContainer
except Exception:  # pragma: no cover - optional dev dependency
    DockerContainer = None


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


def _seed_media_backfill_fixture(database_url: str) -> None:
    import psycopg

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                insert into sources (
                  id,
                  slug,
                  name,
                  tier,
                  license,
                  freshness,
                  homepage,
                  citation,
                  description
                )
                values (
                  'biodiversidad-gt',
                  'biodiversidad-gt',
                  'Portal de Biodiversidad de Guatemala',
                  'institutional',
                  'CC0 / según colección',
                  'Actualización continua',
                  'https://biodiversidad.gt/portal/index.php',
                  'Fixture citation',
                  'Fixture source'
                )
                """
            )
            cursor.execute(
                """
                insert into taxa (id, slug, common_name, scientific_name, taxonomic_group)
                values
                  ('11111111-1111-1111-1111-111111111111', 'quercus-skinneri', 'Quercus skinneri', 'Quercus skinneri', 'flora'),
                  ('22222222-2222-2222-2222-222222222222', 'panthera-onca', 'Jaguar', 'Panthera onca', 'mamiferos'),
                  ('33333333-3333-3333-3333-333333333333', 'chironomidae', 'Chironomidae', 'Chironomidae', 'insectos')
                """
            )
            cursor.execute(
                """
                insert into taxon_media (
                  id,
                  taxon_id,
                  source_id,
                  media_kind,
                  url,
                  alt_text,
                  attribution,
                  license,
                  is_primary,
                  sort_order
                )
                values (
                  '44444444-4444-4444-4444-444444444444',
                  '11111111-1111-1111-1111-111111111111',
                  'biodiversidad-gt',
                  'photo',
                  'https://example.com/quercus.jpg',
                  'Quercus skinneri',
                  'Herbario',
                  'https://creativecommons.org/licenses/by/4.0/',
                  true,
                  0
                )
                """
            )
        connection.commit()


@pytest.mark.skipif(
    DockerContainer is None or shutil.which("docker") is None,
    reason="Docker and testcontainers are required for media backfill integration tests.",
)
def test_backfill_taxon_media_dry_run_write_and_idempotency(monkeypatch):
    psycopg = pytest.importorskip("psycopg")

    def _fake_resolver(target: media_backfill.TaxonBackfillTarget) -> ResolutionOutcome:
        if target.scientific_name == "Panthera onca":
            return ResolutionOutcome(
                status="resolved",
                media=ResolvedMediaRecord(
                    source_id="gbif",
                    url="https://example.com/panthera-onca.jpg",
                    alt_text="Jaguar",
                    attribution="Camera Trap",
                    license="https://creativecommons.org/licenses/by/4.0/",
                ),
            )
        return ResolutionOutcome(status="miss", reason="No fixture candidate.")

    monkeypatch.setattr(media_backfill, "resolve_taxon_media", _fake_resolver)

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
            _seed_media_backfill_fixture(database_url)

            dry_run_summary = backfill_taxon_media(
                database_url=database_url,
                dry_run=True,
            )
            first_write_summary = backfill_taxon_media(
                database_url=database_url,
                dry_run=False,
            )
            second_write_summary = backfill_taxon_media(
                database_url=database_url,
                dry_run=False,
            )

            assert dry_run_summary["inserted"] == 1
            assert dry_run_summary["media_coverage_before"]["species_with_media"] == 1
            assert dry_run_summary["media_coverage_after"]["species_with_media"] == 1

            assert first_write_summary["inserted"] == 1
            assert first_write_summary["inserted_by_source"] == {"gbif": 1}
            assert first_write_summary["media_coverage_after"]["species_with_media"] == 2
            assert first_write_summary["media_coverage_after"]["species_missing_media"] == 1

            assert second_write_summary["inserted"] == 0
            assert second_write_summary["media_coverage_before"]["species_with_media"] == 2
            assert second_write_summary["media_coverage_after"]["species_with_media"] == 2

            with psycopg.connect(database_url) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("select count(*)::int from taxon_media")
                    assert int(cursor.fetchone()[0]) == 2

                    cursor.execute(
                        """
                        select media.url, media.attribution, media.license
                        from taxa taxon
                        left join lateral (
                          select url, attribution, license
                          from taxon_media media
                          where media.taxon_id = taxon.id
                          order by media.is_primary desc, media.sort_order asc, media.created_at asc
                          limit 1
                        ) media on true
                        where taxon.slug = 'panthera-onca'
                        """
                    )
                    assert cursor.fetchone() == (
                        "https://example.com/panthera-onca.jpg",
                        "Camera Trap",
                        "https://creativecommons.org/licenses/by/4.0/",
                    )

                    cursor.execute("select count(*)::int from sources where id = 'gbif'")
                    assert int(cursor.fetchone()[0]) == 1
    except Exception as error:  # pragma: no cover - environment-specific
        pytest.skip(f"Disposable PostGIS container was not available: {error}")
