from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Any, Literal
from uuid import uuid4
import re

from biomap_gt_etl.connectors.biodiversidad_gt import (
    OccurrenceMediaDetail,
    fetch_occurrence_media_detail,
    search_taxon_media,
)
from biomap_gt_etl.connectors.gbif import match_species, search_occurrences_with_media
from biomap_gt_etl.normalization import normalize_text, normalize_whitespace


BIODIVERSIDAD_REQUEST_INTERVAL_SECONDS = 0.2
GBIF_REQUEST_INTERVAL_SECONDS = 0.05
GBIF_OCCURRENCE_LIMIT = 10
SPECIES_LIKE_BINOMIAL_PATTERN = re.compile(r"^[A-Z][A-Za-z-]+ [a-z-]+$")

GBIF_SOURCE: dict[str, str] = {
    "id": "gbif",
    "slug": "gbif",
    "name": "GBIF",
    "tier": "institutional",
    "license": "Según licencia del medio publicado por el proveedor en GBIF",
    "freshness": "Consulta puntual de respaldo para completar medios faltantes",
    "homepage": "https://www.gbif.org",
    "citation": "GBIF.org. 2026. Species API y Occurrence API consultadas para completar medios faltantes.",
    "description": (
        "Respaldo institucional para medios taxonómicos cuando Biodiversidad.gt no "
        "expone una coincidencia exacta reutilizable."
    ),
}


@dataclass(slots=True)
class TaxonBackfillTarget:
    id: str
    scientific_name: str
    common_name: str
    group: str


@dataclass(slots=True)
class ResolvedMediaRecord:
    source_id: str
    url: str
    alt_text: str
    attribution: str | None
    license: str


@dataclass(slots=True)
class ResolutionOutcome:
    status: Literal["resolved", "miss", "parse_failure", "unsafe_skip"]
    media: ResolvedMediaRecord | None = None
    reason: str | None = None


def is_species_like_binomial(scientific_name: str) -> bool:
    return bool(SPECIES_LIKE_BINOMIAL_PATTERN.fullmatch(normalize_whitespace(scientific_name)))


def _normalize_name(value: str | None) -> str:
    return normalize_text(value).casefold()


def _alt_text_for_target(target: TaxonBackfillTarget) -> str:
    common_name = normalize_whitespace(target.common_name)
    return common_name or target.scientific_name


def _occurrence_detail_is_safe(
    target: TaxonBackfillTarget,
    detail: OccurrenceMediaDetail,
) -> ResolutionOutcome | None:
    if detail.scientific_name and _normalize_name(detail.scientific_name) != _normalize_name(
        target.scientific_name
    ):
        return ResolutionOutcome(
            status="unsafe_skip",
            reason="Biodiversidad.gt occurrence detail did not preserve the exact taxon name.",
        )
    if not detail.image_url:
        return ResolutionOutcome(
            status="parse_failure",
            reason="Biodiversidad.gt occurrence detail did not expose a usable image URL.",
        )
    if not detail.license:
        return ResolutionOutcome(
            status="unsafe_skip",
            reason="Biodiversidad.gt occurrence detail did not expose an explicit license.",
        )
    return None


def resolve_biodiversidad_media(target: TaxonBackfillTarget) -> ResolutionOutcome:
    try:
        results = search_taxon_media(
            target.scientific_name,
            request_interval_seconds=BIODIVERSIDAD_REQUEST_INTERVAL_SECONDS,
        )
    except Exception as error:  # pragma: no cover - network path
        return ResolutionOutcome(
            status="parse_failure",
            reason=f"Biodiversidad.gt search failed: {error}",
        )

    exact_result = next(
        (
            result
            for result in results
            if _normalize_name(result.scientific_name) == _normalize_name(target.scientific_name)
        ),
        None,
    )
    if exact_result is None:
        return ResolutionOutcome(
            status="miss",
            reason="No exact Biodiversidad.gt multimedia match was found.",
        )

    try:
        detail = fetch_occurrence_media_detail(
            exact_result.occurrence_id,
            request_interval_seconds=BIODIVERSIDAD_REQUEST_INTERVAL_SECONDS,
        )
    except Exception as error:  # pragma: no cover - network path
        return ResolutionOutcome(
            status="parse_failure",
            reason=f"Biodiversidad.gt occurrence detail fetch failed: {error}",
        )

    unsafe_or_invalid = _occurrence_detail_is_safe(target, detail)
    if unsafe_or_invalid is not None:
        return unsafe_or_invalid

    return ResolutionOutcome(
        status="resolved",
        media=ResolvedMediaRecord(
            source_id="biodiversidad-gt",
            url=detail.image_url or "",
            alt_text=_alt_text_for_target(target),
            attribution=detail.creator,
            license=detail.license or "",
        ),
    )


def _is_safe_gbif_match(target: TaxonBackfillTarget, match_payload: dict[str, Any]) -> bool:
    canonical_name = normalize_whitespace(str(match_payload.get("canonicalName") or ""))
    confidence = int(match_payload.get("confidence") or 0)
    return (
        canonical_name
        and _normalize_name(canonical_name) == _normalize_name(target.scientific_name)
        and str(match_payload.get("rank") or "").upper() == "SPECIES"
        and str(match_payload.get("status") or "").upper() == "ACCEPTED"
        and confidence >= 90
    )


def _looks_like_direct_image(media: dict[str, Any]) -> bool:
    identifier = normalize_whitespace(str(media.get("identifier") or ""))
    media_format = normalize_whitespace(str(media.get("format") or "")).lower()
    return identifier.startswith("http") and media_format.startswith("image/")


def _select_gbif_media(
    target: TaxonBackfillTarget,
    occurrences: list[dict[str, Any]],
) -> tuple[ResolvedMediaRecord | None, bool]:
    saw_unsafe_candidate = False

    for occurrence in occurrences:
        species_name = normalize_whitespace(str(occurrence.get("species") or ""))
        if species_name and _normalize_name(species_name) != _normalize_name(target.scientific_name):
            saw_unsafe_candidate = True
            continue

        for media in occurrence.get("media") or []:
            media_type = normalize_whitespace(str(media.get("type") or ""))
            license_value = normalize_whitespace(str(media.get("license") or ""))
            if media_type and media_type != "StillImage":
                continue
            if not _looks_like_direct_image(media) or not license_value:
                saw_unsafe_candidate = True
                continue

            attribution = normalize_whitespace(
                str(media.get("creator") or media.get("rightsHolder") or "")
            ) or None
            return (
                ResolvedMediaRecord(
                    source_id="gbif",
                    url=normalize_whitespace(str(media.get("identifier") or "")),
                    alt_text=_alt_text_for_target(target),
                    attribution=attribution,
                    license=license_value,
                ),
                saw_unsafe_candidate,
            )

    return None, saw_unsafe_candidate


def resolve_gbif_media(target: TaxonBackfillTarget) -> ResolutionOutcome:
    if not is_species_like_binomial(target.scientific_name):
        return ResolutionOutcome(
            status="unsafe_skip",
            reason="GBIF fallback is restricted to species-like binomials.",
        )

    try:
        species_match = match_species(
            target.scientific_name,
            request_interval_seconds=GBIF_REQUEST_INTERVAL_SECONDS,
        )
    except Exception as error:  # pragma: no cover - network path
        return ResolutionOutcome(
            status="parse_failure",
            reason=f"GBIF species match failed: {error}",
        )

    if not _is_safe_gbif_match(target, species_match):
        return ResolutionOutcome(
            status="unsafe_skip",
            reason="GBIF species match was not an exact accepted species match.",
        )

    taxon_key = int(species_match.get("usageKey") or species_match.get("speciesKey") or 0)
    if taxon_key <= 0:
        return ResolutionOutcome(
            status="parse_failure",
            reason="GBIF species match did not provide a usable taxon key.",
        )

    saw_unsafe_candidate = False
    for country_code in ("GT", None):
        try:
            occurrences = search_occurrences_with_media(
                taxon_key=taxon_key,
                country_code=country_code,
                limit=GBIF_OCCURRENCE_LIMIT,
                request_interval_seconds=GBIF_REQUEST_INTERVAL_SECONDS,
            )
        except Exception as error:  # pragma: no cover - network path
            return ResolutionOutcome(
                status="parse_failure",
                reason=f"GBIF occurrence search failed: {error}",
            )

        media, local_unsafe = _select_gbif_media(target, occurrences)
        saw_unsafe_candidate = saw_unsafe_candidate or local_unsafe
        if media is not None:
            return ResolutionOutcome(status="resolved", media=media)

    if saw_unsafe_candidate:
        return ResolutionOutcome(
            status="unsafe_skip",
            reason="GBIF returned media candidates, but none met the direct-image and explicit-license rules.",
        )

    return ResolutionOutcome(
        status="miss",
        reason="No GBIF occurrence with reusable still-image media was found.",
    )


def resolve_taxon_media(target: TaxonBackfillTarget) -> ResolutionOutcome:
    biodiversity_outcome = resolve_biodiversidad_media(target)
    if biodiversity_outcome.status in {"resolved", "parse_failure"}:
        return biodiversity_outcome

    if not is_species_like_binomial(target.scientific_name):
        if biodiversity_outcome.status == "miss":
            return ResolutionOutcome(
                status="unsafe_skip",
                reason="No exact Biodiversidad.gt match was found and higher taxa are not eligible for GBIF fallback.",
            )
        return biodiversity_outcome

    gbif_outcome = resolve_gbif_media(target)
    if gbif_outcome.status == "resolved":
        return gbif_outcome
    if biodiversity_outcome.status == "unsafe_skip" and gbif_outcome.status == "miss":
        return biodiversity_outcome
    return gbif_outcome


def _fetch_media_coverage_counts(cursor: Any) -> dict[str, int]:
    cursor.execute(
        """
        with media_taxa as (
          select distinct taxon_id
          from taxon_media
        )
        select
          count(*)::int as species_total,
          count(*) filter (where media_taxa.taxon_id is not null)::int as species_with_media,
          count(*) filter (where media_taxa.taxon_id is null)::int as species_missing_media
        from taxa
        left join media_taxa on media_taxa.taxon_id = taxa.id
        """
    )
    row = cursor.fetchone()
    return {
        "species_total": int(row[0]),
        "species_with_media": int(row[1]),
        "species_missing_media": int(row[2]),
    }


def _fetch_backfill_targets(
    cursor: Any,
    *,
    limit: int | None = None,
) -> list[TaxonBackfillTarget]:
    params: list[Any] = []
    limit_sql = ""
    if limit is not None:
        params.append(limit)
        limit_sql = "limit %s"

    cursor.execute(
        f"""
        select
          taxon.id,
          taxon.scientific_name,
          taxon.common_name,
          taxon.taxonomic_group
        from taxa taxon
        where not exists (
          select 1
          from taxon_media media
          where media.taxon_id = taxon.id
        )
        order by taxon.featured_rank nulls last, taxon.common_name asc
        {limit_sql}
        """,
        params,
    )
    return [
        TaxonBackfillTarget(
            id=str(row[0]),
            scientific_name=str(row[1]),
            common_name=str(row[2] or row[1]),
            group=str(row[3]),
        )
        for row in cursor.fetchall()
    ]


def _ensure_gbif_source(cursor: Any) -> None:
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
          %(id)s,
          %(slug)s,
          %(name)s,
          %(tier)s::source_tier,
          %(license)s,
          %(freshness)s,
          %(homepage)s,
          %(citation)s,
          %(description)s
        )
        on conflict (id) do update
        set slug = excluded.slug,
            name = excluded.name,
            tier = excluded.tier,
            license = excluded.license,
            freshness = excluded.freshness,
            homepage = excluded.homepage,
            citation = excluded.citation,
            description = excluded.description
        """,
        GBIF_SOURCE,
    )


def _insert_media_row(
    cursor: Any,
    *,
    target: TaxonBackfillTarget,
    media: ResolvedMediaRecord,
) -> int:
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
        select
          %(id)s,
          %(taxon_id)s,
          %(source_id)s,
          'photo',
          %(url)s,
          %(alt_text)s,
          %(attribution)s,
          %(license)s,
          true,
          0
        where not exists (
          select 1
          from taxon_media existing
          where existing.taxon_id = %(taxon_id)s
        )
        """,
        {
            "id": str(uuid4()),
            "taxon_id": target.id,
            "source_id": media.source_id,
            "url": media.url,
            "alt_text": media.alt_text,
            "attribution": media.attribution,
            "license": media.license,
        },
    )
    return cursor.rowcount


def backfill_taxon_media(
    *,
    database_url: str,
    limit: int | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    import psycopg

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            before = _fetch_media_coverage_counts(cursor)
            targets = _fetch_backfill_targets(cursor, limit=limit)
            if not dry_run:
                _ensure_gbif_source(cursor)

            inserted_by_source: Counter[str] = Counter()
            summary: dict[str, Any] = {
                "dry_run": dry_run,
                "limit": limit,
                "attempted": len(targets),
                "inserted": 0,
                "inserted_by_source": {},
                "misses": 0,
                "parse_failures": 0,
                "skipped_unsafe_matches": 0,
                "skipped_existing": 0,
                "media_coverage_before": before,
            }

            for target in targets:
                outcome = resolve_taxon_media(target)
                if outcome.status == "resolved" and outcome.media is not None:
                    if dry_run:
                        inserted_by_source[outcome.media.source_id] += 1
                        summary["inserted"] += 1
                        continue

                    inserted_rows = _insert_media_row(
                        cursor,
                        target=target,
                        media=outcome.media,
                    )
                    if inserted_rows:
                        inserted_by_source[outcome.media.source_id] += 1
                        summary["inserted"] += inserted_rows
                    else:
                        summary["skipped_existing"] += 1
                    continue

                if outcome.status == "parse_failure":
                    summary["parse_failures"] += 1
                elif outcome.status == "unsafe_skip":
                    summary["skipped_unsafe_matches"] += 1
                else:
                    summary["misses"] += 1

            if dry_run:
                connection.rollback()
                after = dict(before)
            else:
                connection.commit()
                with connection.cursor() as verification_cursor:
                    after = _fetch_media_coverage_counts(verification_cursor)

            summary["inserted_by_source"] = dict(inserted_by_source)
            summary["media_coverage_after"] = after
            return summary
