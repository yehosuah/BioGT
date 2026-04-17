from __future__ import annotations

from collections import defaultdict
import csv
import io
from typing import Any
import zipfile

from biomap_gt_etl.connectors.biodiversidad_gt import (
    ArchiveFeedItem,
    fetch_archive_bundle,
    fetch_archive_feed,
    fetch_occurrence_sample,
)
from biomap_gt_etl.normalization import (
    build_public_cell_id,
    coerce_date,
    coerce_elevation_band,
    coerce_float,
    normalize_taxonomic_group,
    normalize_whitespace,
    taxon_scope_for_group,
)


PUBLIC_SOURCE = {
    "id": "biodiversidad-gt",
    "name": "Portal de Biodiversidad de Guatemala",
    "homepage": "https://biodiversidad.gt/portal/index.php",
    "rss_url": "https://biodiversidad.gt/portal/content/dwca/rss.xml",
    "canonical_source_policy": "institutional_default_with_labeled_enrichment",
}


def _read_archive_rows(
    archive_bytes: bytes,
    filename: str,
    limit: int | None = None,
) -> list[dict[str, str]]:
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        if filename not in archive.namelist():
            return []
        with archive.open(filename) as file_handle:
            reader = csv.DictReader(io.TextIOWrapper(file_handle, encoding="utf-8"))
            rows: list[dict[str, str]] = []
            for row in reader:
                rows.append({key: value for key, value in row.items() if key is not None})
                if limit is not None and len(rows) >= limit:
                    break
            return rows


def _index_multimedia_rows(
    archive_bytes: bytes,
) -> dict[str, list[dict[str, str | None]]]:
    media_rows = _read_archive_rows(archive_bytes, "multimedia.csv")
    indexed: dict[str, list[dict[str, str | None]]] = defaultdict(list)

    for row in media_rows:
        core_id = row.get("coreid")
        if not core_id:
            continue

        indexed[core_id].append(
            {
                "access_uri": normalize_whitespace(row.get("accessURI")) or None,
                "thumbnail_access_uri": normalize_whitespace(row.get("thumbnailAccessURI")) or None,
                "type": normalize_whitespace(row.get("type")) or None,
                "format": normalize_whitespace(row.get("format")) or None,
                "rights": normalize_whitespace(row.get("rights")) or None,
                "creator": normalize_whitespace(row.get("creator")) or None,
                "caption": normalize_whitespace(row.get("caption")) or None,
            }
        )

    return indexed


def _normalize_archive_occurrence(
    archive: ArchiveFeedItem,
    row: dict[str, str],
    media_by_core_id: dict[str, list[dict[str, str | None]]],
) -> dict[str, Any] | None:
    scientific_name = normalize_whitespace(row.get("scientificName"))
    if not scientific_name:
        return None

    latitude = coerce_float(row.get("decimalLatitude"))
    longitude = coerce_float(row.get("decimalLongitude"))
    media = media_by_core_id.get(row.get("id", ""), [])
    group = normalize_taxonomic_group(row)

    return {
        "archive_collection_id": archive.collection_id,
        "archive_title": archive.title,
        "occurrenceID": normalize_whitespace(row.get("occurrenceID")) or normalize_whitespace(row.get("id")),
        "scientificName": scientific_name,
        "vernacularName": normalize_whitespace(row.get("vernacularName")) or None,
        "family": normalize_whitespace(row.get("family")) or None,
        "order": normalize_whitespace(row.get("order")) or None,
        "class": normalize_whitespace(row.get("class")) or None,
        "phylum": normalize_whitespace(row.get("phylum")) or None,
        "kingdom": normalize_whitespace(row.get("kingdom")) or None,
        "group": group,
        "taxon_scope": taxon_scope_for_group(group),
        "country": normalize_whitespace(row.get("country")) or None,
        "stateProvince": normalize_whitespace(row.get("stateProvince")) or None,
        "municipality": normalize_whitespace(row.get("municipality")) or None,
        "locality": normalize_whitespace(row.get("locality")) or None,
        "eventDate": coerce_date(row.get("eventDate") or row.get("dateIdentified")),
        "decimalLatitude": latitude,
        "decimalLongitude": longitude,
        "elevationBand": coerce_elevation_band(row),
        "public_cell_id": build_public_cell_id(latitude, longitude),
        "visibility": "internal_exact" if latitude is not None and longitude is not None else "summary_only",
        "public_strategy": "generalize_to_public_hex",
        "media": media[:3],
        "primary_media": media[0] if media else None,
    }


def _normalize_api_sample(sample: dict[str, Any]) -> dict[str, Any]:
    latitude = (
        coerce_float(str(sample.get("decimalLatitude") or ""))
        if sample.get("decimalLatitude") is not None
        else None
    )
    longitude = (
        coerce_float(str(sample.get("decimalLongitude") or ""))
        if sample.get("decimalLongitude") is not None
        else None
    )

    group = normalize_taxonomic_group(
        {
            "kingdom": sample.get("kingdom"),
            "class": sample.get("class"),
            "phylum": sample.get("phylum"),
        }
    )

    return {
        "occurrenceID": sample.get("occurrenceID"),
        "scientificName": normalize_whitespace(sample.get("sciname") or sample.get("scientificName")),
        "vernacularName": normalize_whitespace(sample.get("vernacularName")) or None,
        "family": normalize_whitespace(sample.get("family")) or None,
        "order": normalize_whitespace(sample.get("order")) or None,
        "class": normalize_whitespace(sample.get("class")) or None,
        "kingdom": normalize_whitespace(sample.get("kingdom")) or None,
        "group": group,
        "taxon_scope": taxon_scope_for_group(group),
        "country": normalize_whitespace(sample.get("country")) or None,
        "stateProvince": normalize_whitespace(sample.get("stateProvince")) or None,
        "locality": normalize_whitespace(sample.get("locality")) or None,
        "eventDate": coerce_date(sample.get("eventDate") or sample.get("dateIdentified")),
        "decimalLatitude": latitude,
        "decimalLongitude": longitude,
        "public_cell_id": build_public_cell_id(latitude, longitude),
        "visibility": "internal_exact" if latitude is not None and longitude is not None else "summary_only",
        "public_strategy": "generalize_to_public_hex",
    }


def _summarize_taxa(normalized_occurrences: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rollups: dict[str, dict[str, Any]] = {}

    for occurrence in normalized_occurrences:
        scientific_name = occurrence.get("scientificName")
        if not scientific_name:
            continue
        current = rollups.setdefault(
            scientific_name,
            {
                "scientific_name": scientific_name,
                "common_name": occurrence.get("vernacularName") or scientific_name,
                "family": occurrence.get("family"),
                "kingdom": occurrence.get("kingdom"),
                "group": occurrence.get("group"),
                "occurrence_count": 0,
                "latest_event_date": None,
                "state_provinces": set(),
                "primary_media": occurrence.get("primary_media"),
            },
        )
        if occurrence.get("vernacularName") and current["common_name"] == scientific_name:
            current["common_name"] = occurrence["vernacularName"]
        current["occurrence_count"] += 1
        if occurrence.get("eventDate") and (
            current["latest_event_date"] is None
            or occurrence["eventDate"] > current["latest_event_date"]
        ):
            current["latest_event_date"] = occurrence["eventDate"]
        if occurrence.get("stateProvince"):
            current["state_provinces"].add(occurrence["stateProvince"])
        if current["primary_media"] is None and occurrence.get("primary_media") is not None:
            current["primary_media"] = occurrence["primary_media"]

    taxa = []
    for item in rollups.values():
        taxa.append(
            {
                **item,
                "state_provinces": sorted(item["state_provinces"]),
            }
        )
    taxa.sort(key=lambda item: (-item["occurrence_count"], item["scientific_name"]))
    return taxa


def _summarize_regions(normalized_occurrences: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rollups: dict[str, dict[str, Any]] = {}

    for occurrence in normalized_occurrences:
        region = occurrence.get("stateProvince") or "Sin departamento"
        current = rollups.setdefault(
            region,
            {
                "region": region,
                "visible_species": set(),
                "occurrence_count": 0,
                "with_media_count": 0,
            },
        )
        if occurrence.get("scientificName"):
            current["visible_species"].add(occurrence["scientificName"])
        current["occurrence_count"] += 1
        if occurrence.get("primary_media") is not None:
            current["with_media_count"] += 1

    regions = []
    for item in rollups.values():
        regions.append(
            {
                "region": item["region"],
                "visible_species": len(item["visible_species"]),
                "occurrence_count": item["occurrence_count"],
                "with_media_count": item["with_media_count"],
            }
        )
    regions.sort(key=lambda item: (-item["visible_species"], item["region"]))
    return regions


def _summarize_taxon_scopes(normalized_occurrences: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rollups: dict[str, dict[str, Any]] = {}

    for occurrence in normalized_occurrences:
        scope = occurrence.get("taxon_scope") or taxon_scope_for_group(str(occurrence.get("group")))
        current = rollups.setdefault(
            scope,
            {
                "scope": scope,
                "visible_species": set(),
                "occurrence_count": 0,
                "with_media_count": 0,
            },
        )
        if occurrence.get("scientificName"):
            current["visible_species"].add(occurrence["scientificName"])
        current["occurrence_count"] += 1
        if occurrence.get("primary_media") is not None:
            current["with_media_count"] += 1

    summary = []
    for item in rollups.values():
        summary.append(
            {
                "scope": item["scope"],
                "visible_species": len(item["visible_species"]),
                "occurrence_count": item["occurrence_count"],
                "with_media_count": item["with_media_count"],
            }
        )

    summary.sort(key=lambda item: item["scope"])
    return summary


def _summarize_public_cells(normalized_occurrences: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rollups: dict[str, dict[str, Any]] = {}

    for occurrence in normalized_occurrences:
        public_cell_id = occurrence.get("public_cell_id")
        if not public_cell_id:
            continue

        current = rollups.setdefault(
            public_cell_id,
            {
                "public_cell_id": public_cell_id,
                "visible_species": set(),
                "flora_species": set(),
                "fauna_species": set(),
                "occurrence_count": 0,
                "with_media_count": 0,
            },
        )
        scientific_name = occurrence.get("scientificName")
        if scientific_name:
            current["visible_species"].add(scientific_name)
            current[f"{occurrence.get('taxon_scope', 'fauna')}_species"].add(scientific_name)
        current["occurrence_count"] += 1
        if occurrence.get("primary_media") is not None:
            current["with_media_count"] += 1

    cells = []
    for item in rollups.values():
        cells.append(
            {
                "public_cell_id": item["public_cell_id"],
                "visible_species": len(item["visible_species"]),
                "flora_species": len(item["flora_species"]),
                "fauna_species": len(item["fauna_species"]),
                "occurrence_count": item["occurrence_count"],
                "with_media_count": item["with_media_count"],
            }
        )

    cells.sort(key=lambda item: (-item["visible_species"], item["public_cell_id"]))
    return cells


def collect_public_source_payload(
    archive_limit: int | None = None,
    occurrence_limit_per_archive: int | None = None,
) -> dict[str, Any]:
    feed = fetch_archive_feed(limit=archive_limit)
    normalized_occurrences: list[dict[str, Any]] = []

    for archive in feed:
        archive_bytes = fetch_archive_bundle(archive.archive_url)
        media_by_core_id = _index_multimedia_rows(archive_bytes)
        occurrence_rows = _read_archive_rows(
            archive_bytes,
            "occurrences.csv",
            limit=occurrence_limit_per_archive,
        )
        normalized_occurrences.extend(
            occurrence
            for occurrence in (
                _normalize_archive_occurrence(archive, row, media_by_core_id)
                for row in occurrence_rows
            )
            if occurrence is not None
        )

    sample = fetch_occurrence_sample()

    return {
        "source": PUBLIC_SOURCE,
        "ingestion": {
            "archive_count": len(feed),
            "occurrence_limit_per_archive": occurrence_limit_per_archive,
            "normalized_occurrence_count": len(normalized_occurrences),
        },
        "archives": [
            {
                "collection_id": item.collection_id,
                "title": item.title,
                "description": item.description,
                "archive_url": item.archive_url,
                "eml_url": item.eml_url,
                "published_at": item.published_at,
            }
            for item in feed
        ],
        "sample_occurrence": _normalize_api_sample(sample),
        "normalized_occurrences": normalized_occurrences,
    }


def build_public_source_snapshot(
    archive_limit: int | None = 4,
    occurrence_limit_per_archive: int | None = 40,
    preview_limit: int = 12,
) -> dict[str, Any]:
    payload = collect_public_source_payload(
        archive_limit=archive_limit,
        occurrence_limit_per_archive=occurrence_limit_per_archive,
    )
    normalized_occurrences = payload["normalized_occurrences"]

    return {
        **payload,
        "sample_occurrences": normalized_occurrences[:preview_limit],
        "regional_rollups": _summarize_regions(normalized_occurrences),
        "taxon_scope_rollups": _summarize_taxon_scopes(normalized_occurrences),
        "public_cell_rollups": _summarize_public_cells(normalized_occurrences),
        "taxa": _summarize_taxa(normalized_occurrences)[:preview_limit],
    }
