from __future__ import annotations

from pathlib import Path

import biomap_gt_etl.media_backfill as media_backfill
from biomap_gt_etl.connectors.biodiversidad_gt import (
    MediaSearchResult,
    OccurrenceMediaDetail,
    parse_media_search_results,
    parse_occurrence_media_detail,
)


FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _target(
    scientific_name: str,
    *,
    common_name: str | None = None,
    group: str = "fauna",
) -> media_backfill.TaxonBackfillTarget:
    return media_backfill.TaxonBackfillTarget(
        id=f"id-{scientific_name}",
        scientific_name=scientific_name,
        common_name=common_name or scientific_name,
        group=group,
    )


def test_parse_biodiversidad_media_search_fixture():
    page_html = (FIXTURES_DIR / "biodiversidad_media_search.html").read_text(encoding="utf-8")

    results = parse_media_search_results(page_html)

    assert [entry.scientific_name for entry in results] == [
        "Apis mellifera",
        "Basiliscus vittatus",
    ]
    assert results[0].occurrence_id == "281000"
    assert results[1].thumbnail_url.endswith("/543463354/small.jpg")


def test_parse_biodiversidad_occurrence_detail_fixture():
    page_html = (FIXTURES_DIR / "biodiversidad_occurrence_detail.html").read_text(
        encoding="utf-8"
    )

    detail = parse_occurrence_media_detail(page_html)

    assert detail.scientific_name == "Apis mellifera"
    assert detail.image_url == "https://inaturalist-open-data.s3.amazonaws.com/photos/165656014/medium.jpg"
    assert detail.creator == "flagellan"
    assert detail.license == "http://creativecommons.org/licenses/by-nc/4.0/"


def test_resolve_biodiversidad_media_accepts_exact_match(monkeypatch):
    monkeypatch.setattr(
        media_backfill,
        "search_taxon_media",
        lambda scientific_name, **kwargs: [
            MediaSearchResult(
                occurrence_id="281000",
                scientific_name=scientific_name,
                thumbnail_url="https://example.com/thumb.jpg",
            )
        ],
    )
    monkeypatch.setattr(
        media_backfill,
        "fetch_occurrence_media_detail",
        lambda occurrence_id, **kwargs: OccurrenceMediaDetail(
            scientific_name="Apis mellifera",
            image_url="https://example.com/apis-medium.jpg",
            creator="flagellan",
            license="https://creativecommons.org/licenses/by/4.0/",
        ),
    )

    outcome = media_backfill.resolve_biodiversidad_media(
        _target("Apis mellifera", common_name="Abeja", group="insectos")
    )

    assert outcome.status == "resolved"
    assert outcome.media is not None
    assert outcome.media.source_id == "biodiversidad-gt"
    assert outcome.media.url == "https://example.com/apis-medium.jpg"
    assert outcome.media.alt_text == "Abeja"


def test_resolve_biodiversidad_media_rejects_missing_license(monkeypatch):
    monkeypatch.setattr(
        media_backfill,
        "search_taxon_media",
        lambda scientific_name, **kwargs: [
            MediaSearchResult(
                occurrence_id="281000",
                scientific_name=scientific_name,
                thumbnail_url="https://example.com/thumb.jpg",
            )
        ],
    )
    monkeypatch.setattr(
        media_backfill,
        "fetch_occurrence_media_detail",
        lambda occurrence_id, **kwargs: OccurrenceMediaDetail(
            scientific_name="Apis mellifera",
            image_url="https://example.com/apis-medium.jpg",
            creator="flagellan",
            license=None,
        ),
    )

    outcome = media_backfill.resolve_biodiversidad_media(_target("Apis mellifera"))

    assert outcome.status == "unsafe_skip"
    assert "license" in (outcome.reason or "").lower()


def test_resolve_taxon_media_uses_gbif_for_species_level_fallback(monkeypatch):
    monkeypatch.setattr(
        media_backfill,
        "search_taxon_media",
        lambda scientific_name, **kwargs: [],
    )
    monkeypatch.setattr(
        media_backfill,
        "match_species",
        lambda scientific_name, **kwargs: {
            "usageKey": 5219426,
            "canonicalName": scientific_name,
            "rank": "SPECIES",
            "status": "ACCEPTED",
            "confidence": 100,
        },
    )
    monkeypatch.setattr(
        media_backfill,
        "search_occurrences_with_media",
        lambda **kwargs: [
            {
                "species": "Panthera onca",
                "media": [
                    {
                        "type": "StillImage",
                        "format": "image/jpeg",
                        "creator": "Camera Trap",
                        "license": "https://creativecommons.org/licenses/by/4.0/",
                        "identifier": "https://example.com/panthera-onca.jpg",
                    }
                ],
            }
        ],
    )

    outcome = media_backfill.resolve_taxon_media(
        _target("Panthera onca", common_name="Jaguar", group="mamiferos")
    )

    assert outcome.status == "resolved"
    assert outcome.media is not None
    assert outcome.media.source_id == "gbif"
    assert outcome.media.attribution == "Camera Trap"


def test_resolve_taxon_media_does_not_call_gbif_for_higher_taxa(monkeypatch):
    gbif_called = False

    def _match_species(*args, **kwargs):
        nonlocal gbif_called
        gbif_called = True
        return {}

    monkeypatch.setattr(
        media_backfill,
        "search_taxon_media",
        lambda scientific_name, **kwargs: [],
    )
    monkeypatch.setattr(media_backfill, "match_species", _match_species)

    outcome = media_backfill.resolve_taxon_media(_target("Chironomidae", group="insectos"))

    assert outcome.status == "unsafe_skip"
    assert gbif_called is False


def test_resolve_gbif_media_rejects_higher_taxa():
    outcome = media_backfill.resolve_gbif_media(_target("Chironomidae", group="insectos"))

    assert outcome.status == "unsafe_skip"
    assert "binomial" in (outcome.reason or "").lower()
