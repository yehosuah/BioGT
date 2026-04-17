from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from uuid import uuid4
import json

from biomap_gt_etl.connectors.geoboundaries import fetch_boundary_geojson
from biomap_gt_etl.normalization import (
    build_public_cell_id,
    build_public_cell_polygon,
    coerce_date,
    coerce_elevation_band,
    coerce_float,
    normalize_taxonomic_group,
    normalize_whitespace,
    slugify_text,
    taxon_scope_for_group,
)
from biomap_gt_etl.pipeline import PUBLIC_SOURCE, collect_public_source_payload
from biomap_gt_etl.protected_area_seed import PROTECTED_AREA_SEED


ATLAS_SOURCES: list[dict[str, str]] = [
    {
        "id": "biodiversidad-gt",
        "slug": "biodiversidad-gt",
        "name": "Portal de Biodiversidad de Guatemala",
        "tier": "institutional",
        "license": "CC0 / según colección",
        "freshness": "Actualización continua con DwC-A público",
        "homepage": "https://biodiversidad.gt/portal/index.php",
        "citation": (
            "Biodiversidad de Guatemala. 2026. Portal de Biodiversidad de Guatemala. "
            "Accedido vía biodiversidad.gt/portal."
        ),
        "description": (
            "Columna vertebral institucional para ocurrencias, listados interactivos, "
            "multimedia y paquetes Darwin Core."
        ),
    },
    {
        "id": "wdpa",
        "slug": "wdpa",
        "name": "Protected Planet / WDPA",
        "tier": "official",
        "license": "Según términos de Protected Planet",
        "freshness": "Corte manual para subconjunto protegido inicial",
        "homepage": "https://www.protectedplanet.net/en",
        "citation": (
            "UNEP-WCMC and IUCN. Protected Planet: The World Database on Protected Areas (WDPA)."
        ),
        "description": (
            "Referencia oficial de áreas protegidas para el subconjunto inicial preservado "
            "en la carga nacional del atlas."
        ),
    },
    {
        "id": "geoboundaries",
        "slug": "geoboundaries",
        "name": "geoBoundaries Guatemala ADM",
        "tier": "official",
        "license": "Open Data Commons Open Database License 1.0",
        "freshness": "Corte versionado por dataset",
        "homepage": "https://www.geoboundaries.org",
        "citation": "geoBoundaries Global Administrative Database. Guatemala administrative boundaries.",
        "description": (
            "Capas administrativas redistribuibles para Guatemala usadas como geometría "
            "nacional y departamental del atlas."
        ),
    },
]

COUNTRY_SUMMARY = (
    "Vista nacional del atlas para explorar flora y fauna por departamento, área protegida "
    "y celda pública generalizada."
)
DEPARTMENT_SUMMARY_TEMPLATE = (
    "Cobertura pública institucional agregada para {name}, preparada para lectura territorial "
    "sin exponer coordenadas exactas."
)


def _to_multipolygon_geometry(geometry: dict[str, Any]) -> dict[str, Any]:
    if geometry.get("type") == "MultiPolygon":
        return geometry
    if geometry.get("type") == "Polygon":
        return {
            "type": "MultiPolygon",
            "coordinates": [geometry["coordinates"]],
        }
    raise ValueError(f"Expected polygonal geometry, received {geometry.get('type')}.")


def _preferred_media_url(media: dict[str, Any]) -> str | None:
    access_uri = normalize_whitespace(media.get("access_uri"))
    thumbnail = normalize_whitespace(media.get("thumbnail_access_uri"))
    media_type = (normalize_whitespace(media.get("type")) or "").lower()
    media_format = (normalize_whitespace(media.get("format")) or "").lower()

    if access_uri and (
        "image" in media_type or media_type == "" or media_format.startswith("image/")
    ):
        return access_uri
    if thumbnail and (
        "image" in media_type or media_type == "" or media_format.startswith("image/")
    ):
        return thumbnail
    return access_uri or thumbnail


def _biodiversity_label(species_count: int) -> str:
    if species_count >= 320:
        return "Pulso biodiverso muy alto"
    if species_count >= 180:
        return "Pulso biodiverso alto"
    if species_count >= 80:
        return "Pulso biodiverso medio"
    return "Pulso biodiverso emergente"


def _load_snapshot(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    occurrences = payload.get("normalized_occurrences")
    if not isinstance(occurrences, list):
        occurrences = payload.get("sample_occurrences") or []

    return {
        "source": payload.get("source") or PUBLIC_SOURCE,
        "archives": payload.get("archives") or [],
        "normalized_occurrences": occurrences,
    }


def _build_country_record(country_geojson: dict[str, Any]) -> dict[str, Any]:
    feature = country_geojson["features"][0]
    return {
        "slug": "guatemala",
        "name": "Guatemala",
        "kind": "country",
        "summary": COUNTRY_SUMMARY,
        "geometry_external_key": "country",
        "geometry_label": "Guatemala",
        "geometry": _to_multipolygon_geometry(feature["geometry"]),
        "featured_rank": 1,
        "source_ids": ["biodiversidad-gt", "geoboundaries"],
    }


def _department_slug(name: str) -> str:
    slug = slugify_text(name)
    return "guatemala-department" if slug == "guatemala" else slug


def _build_department_records(department_geojson: dict[str, Any]) -> list[dict[str, Any]]:
    priorities = {
        "peten": 1,
        "alta-verapaz": 2,
        "izabal": 3,
    }
    records: list[dict[str, Any]] = []

    for feature in department_geojson["features"]:
        properties = feature.get("properties", {})
        name = normalize_whitespace(properties.get("shapeName")) or "Departamento"
        slug = _department_slug(name)
        records.append(
            {
                "slug": slug,
                "name": name,
                "kind": "department",
                "summary": DEPARTMENT_SUMMARY_TEMPLATE.format(name=name),
                "geometry_external_key": f"dept-{slug}",
                "geometry_label": name,
                "geometry": _to_multipolygon_geometry(feature["geometry"]),
                "featured_rank": priorities.get(slug, 10),
                "source_ids": ["biodiversidad-gt", "geoboundaries"],
            }
        )

    records.sort(key=lambda item: (item["featured_rank"], item["name"]))
    return records


def _build_department_aliases(departments: list[dict[str, Any]]) -> dict[str, str]:
    aliases: dict[str, str] = {}

    for department in departments:
        name = str(department["name"])
        slug = str(department["slug"])
        aliases[slug] = slug
        aliases[slugify_text(name)] = slug
        aliases[slugify_text(f"Departamento de {name}")] = slug
        aliases[slugify_text(f"Depto. de {name}")] = slug

    aliases["guatemala-city"] = "guatemala"
    aliases["ciudad-de-guatemala"] = "guatemala"
    return aliases


def _prepare_occurrence(
    occurrence: dict[str, Any],
    department_aliases: dict[str, str],
) -> dict[str, Any] | None:
    scientific_name = normalize_whitespace(occurrence.get("scientificName"))
    if not scientific_name:
        return None

    latitude = coerce_float(occurrence.get("decimalLatitude"))
    longitude = coerce_float(occurrence.get("decimalLongitude"))
    group = occurrence.get("group") or normalize_taxonomic_group(
        {
            "kingdom": occurrence.get("kingdom"),
            "class": occurrence.get("class"),
            "phylum": occurrence.get("phylum"),
        }
    )
    group = normalize_whitespace(group) or "fauna"
    taxon_scope = occurrence.get("taxon_scope") or taxon_scope_for_group(group)
    state_province = normalize_whitespace(occurrence.get("stateProvince")) or None
    department_slug_hint = (
        department_aliases.get(slugify_text(state_province))
        if state_province
        else None
    )
    public_cell_id = occurrence.get("public_cell_id") or build_public_cell_id(latitude, longitude)
    visibility = occurrence.get("visibility") or (
        "internal_exact" if latitude is not None and longitude is not None else "summary_only"
    )

    return {
        "archive_collection_id": normalize_whitespace(occurrence.get("archive_collection_id")) or None,
        "occurrence_id": normalize_whitespace(occurrence.get("occurrenceID")) or str(uuid4()),
        "scientific_name": scientific_name,
        "common_name": normalize_whitespace(occurrence.get("vernacularName")) or scientific_name,
        "family": normalize_whitespace(occurrence.get("family")) or None,
        "order": normalize_whitespace(occurrence.get("order")) or None,
        "class": normalize_whitespace(occurrence.get("class")) or None,
        "phylum": normalize_whitespace(occurrence.get("phylum")) or None,
        "kingdom": normalize_whitespace(occurrence.get("kingdom")) or None,
        "group": group,
        "taxon_scope": taxon_scope,
        "country": normalize_whitespace(occurrence.get("country")) or None,
        "state_province": state_province,
        "municipality": normalize_whitespace(occurrence.get("municipality")) or None,
        "locality": normalize_whitespace(occurrence.get("locality")) or None,
        "observed_at": coerce_date(occurrence.get("eventDate")),
        "latitude": latitude,
        "longitude": longitude,
        "public_cell_id": public_cell_id,
        "public_strategy": "generalize_to_public_hex",
        "visibility": visibility,
        "elevation_band": occurrence.get("elevationBand")
        or coerce_elevation_band(
            {
                "minimumElevationInMeters": occurrence.get("minimumElevationInMeters"),
                "maximumElevationInMeters": occurrence.get("maximumElevationInMeters"),
                "verbatimElevation": occurrence.get("verbatimElevation"),
            }
        ),
        "media": occurrence.get("media") or (
            [occurrence["primary_media"]] if occurrence.get("primary_media") else []
        ),
        "department_slug_hint": department_slug_hint,
    }


def _build_taxa(occurrences: list[dict[str, Any]]) -> list[dict[str, Any]]:
    buckets: dict[str, dict[str, Any]] = {}

    for occurrence in occurrences:
        scientific_name = occurrence["scientific_name"]
        bucket = buckets.setdefault(
            scientific_name,
            {
                "scientific_name": scientific_name,
                "slug": slugify_text(scientific_name),
                "group": occurrence["group"],
                "common_name_counts": Counter(),
                "occurrence_count": 0,
                "media": [],
            },
        )
        bucket["occurrence_count"] += 1
        bucket["group"] = bucket["group"] if bucket["group"] != "fauna" else occurrence["group"]
        bucket["common_name_counts"][occurrence["common_name"]] += 1
        bucket["media"].extend(occurrence.get("media") or [])

    taxa = sorted(
        buckets.values(),
        key=lambda item: (-item["occurrence_count"], item["scientific_name"]),
    )
    used_slugs: dict[str, int] = {}

    for index, taxon in enumerate(taxa, start=1):
        ranked_names = sorted(
            taxon["common_name_counts"].items(),
            key=lambda item: (
                item[0] == taxon["scientific_name"],
                -item[1],
                item[0],
            ),
        )
        taxon["common_name"] = ranked_names[0][0] if ranked_names else taxon["scientific_name"]
        base_slug = taxon["slug"] or f"taxon-{index}"
        suffix = used_slugs.get(base_slug, 0) + 1
        used_slugs[base_slug] = suffix
        taxon["slug"] = base_slug if suffix == 1 else f"{base_slug}-{suffix}"
        taxon["featured_rank"] = index

    return taxa


def _build_taxon_media_rows(
    taxa: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for taxon in taxa:
        seen_urls: set[str] = set()
        sort_order = 0

        for media in taxon["media"]:
            url = _preferred_media_url(media)
            if not url or url in seen_urls:
                continue

            seen_urls.add(url)
            rows.append(
                {
                    "scientific_name": taxon["scientific_name"],
                    "url": url,
                    "alt_text": normalize_whitespace(media.get("caption")) or taxon["common_name"],
                    "attribution": normalize_whitespace(media.get("creator")) or None,
                    "license": normalize_whitespace(media.get("rights")) or None,
                    "media_kind": "photo",
                    "source_id": "biodiversidad-gt",
                    "is_primary": sort_order == 0,
                    "sort_order": sort_order,
                }
            )
            sort_order += 1
            if sort_order >= 3:
                break

    return rows


def build_loader_bundle(
    archive_limit: int | None = None,
    from_snapshot: Path | None = None,
) -> dict[str, Any]:
    source_payload = (
        _load_snapshot(from_snapshot)
        if from_snapshot is not None
        else collect_public_source_payload(
            archive_limit=archive_limit,
            occurrence_limit_per_archive=None,
        )
    )

    country_geojson = fetch_boundary_geojson("GTM", "ADM0")
    department_geojson = fetch_boundary_geojson("GTM", "ADM1")

    country = _build_country_record(country_geojson)
    departments = _build_department_records(department_geojson)
    department_aliases = _build_department_aliases(departments)

    occurrences = [
        occurrence
        for occurrence in (
            _prepare_occurrence(item, department_aliases)
            for item in source_payload["normalized_occurrences"]
        )
        if occurrence is not None
    ]
    taxa = _build_taxa(occurrences)
    taxon_media = _build_taxon_media_rows(taxa)

    archives = source_payload.get("archives") or []
    if not archives:
        archives = [
            {
                "collection_id": "snapshot-import",
                "title": "Snapshot import",
                "description": "Deterministic snapshot import for BioGT loader tests.",
                "archive_url": str(from_snapshot) if from_snapshot else "",
                "eml_url": "",
                "published_at": None,
            }
        ]

    return {
        "sources": ATLAS_SOURCES,
        "country": country,
        "departments": departments,
        "protected_areas": PROTECTED_AREA_SEED,
        "archives": archives,
        "occurrences": occurrences,
        "taxa": taxa,
        "taxon_media": taxon_media,
    }


def _ensure_sources(cursor: Any, sources: list[dict[str, str]]) -> None:
    cursor.executemany(
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
        values (%(id)s, %(slug)s, %(name)s, %(tier)s::source_tier, %(license)s, %(freshness)s, %(homepage)s, %(citation)s, %(description)s)
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
        sources,
    )


def _ensure_protected_area_subset(cursor: Any) -> None:
    for seed in PROTECTED_AREA_SEED:
        geometry_id = str(uuid4())
        cursor.execute(
            """
            insert into area_geometries (id, external_key, kind, label, geom)
            values (%s, %s, 'protected_area'::area_kind, %s, st_setsrid(st_geomfromgeojson(%s), 4326))
            on conflict (external_key) do update
            set label = excluded.label,
                geom = excluded.geom
            returning id
            """,
            (
                geometry_id,
                seed["geometry_external_key"],
                seed["geometry_label"],
                json.dumps(_to_multipolygon_geometry(seed["geometry"])),
            ),
        )
        geometry_id = str(cursor.fetchone()[0])

        cursor.execute(
            """
            insert into areas_protected (
              slug,
              name,
              summary,
              wdpa_id,
              geometry_id,
              department,
              featured_rank
            )
            values (%s, %s, %s, %s, %s, %s, 0)
            on conflict (slug) do update
            set name = excluded.name,
                summary = excluded.summary,
                wdpa_id = excluded.wdpa_id,
                geometry_id = excluded.geometry_id,
                department = excluded.department
            """,
            (
                seed["slug"],
                seed["name"],
                seed["summary"],
                seed["wdpa_id"],
                geometry_id,
                seed["department"],
            ),
        )

        cursor.executemany(
            """
            insert into entity_source_links (entity_type, entity_ref, source_id)
            values ('area', %s, %s)
            on conflict (entity_type, entity_ref, source_id) do nothing
            """,
            [(seed["slug"], source_id) for source_id in seed["source_ids"]],
        )


def _count_existing_atlas_records(cursor: Any) -> int:
    cursor.execute(
        """
        select (
          (select count(*) from taxa) +
          (select count(*) from occurrences_normalized) +
          (select count(*) from areas_admin where kind in ('country', 'department'))
        )::int
        """
    )
    return int(cursor.fetchone()[0])


def _replace_atlas_data(cursor: Any) -> None:
    statements = [
        "delete from public_cell_rollups",
        "delete from taxon_presence_rollups",
        "delete from occurrences_public",
        "delete from occurrences_normalized",
        "delete from occurrences_raw",
        "delete from taxon_media",
        "delete from taxon_synonyms",
        "delete from entity_source_links where entity_type = 'species'",
        """
        delete from entity_source_links
        where entity_type = 'area'
          and entity_ref in (
            select slug from areas_admin where kind in ('country', 'department')
          )
        """,
        "delete from area_metrics where area_kind in ('country', 'department', 'protected_area')",
        "delete from datasets",
        "delete from taxa",
        "delete from areas_admin where kind in ('country', 'department')",
        "delete from area_geometries where kind in ('country', 'department')",
    ]

    for statement in statements:
        cursor.execute(statement)


def _insert_country_and_departments(
    cursor: Any,
    country: dict[str, Any],
    departments: list[dict[str, Any]],
) -> dict[str, str]:
    geometry_rows = []
    area_rows = []

    for area in [country, *departments]:
        geometry_id = str(uuid4())
        area_id = str(uuid4())
        geometry_rows.append(
            {
                "id": geometry_id,
                "external_key": area["geometry_external_key"],
                "kind": area["kind"],
                "label": area["geometry_label"],
                "geometry": json.dumps(area["geometry"]),
            }
        )
        area_rows.append(
            {
                "id": area_id,
                "slug": area["slug"],
                "name": area["name"],
                "kind": area["kind"],
                "summary": area["summary"],
                "geometry_id": geometry_id,
                "featured_rank": area["featured_rank"],
            }
        )

    cursor.executemany(
        """
        insert into area_geometries (id, external_key, kind, label, geom)
        values (%(id)s, %(external_key)s, %(kind)s::area_kind, %(label)s, st_setsrid(st_geomfromgeojson(%(geometry)s), 4326))
        """,
        geometry_rows,
    )
    cursor.executemany(
        """
        insert into areas_admin (
          id,
          slug,
          name,
          kind,
          summary,
          geometry_id,
          featured_rank,
          department
        )
        values (%(id)s, %(slug)s, %(name)s, %(kind)s::area_kind, %(summary)s, %(geometry_id)s, %(featured_rank)s, null)
        """,
        area_rows,
    )

    link_rows = []
    for area in [country, *departments]:
        for source_id in area["source_ids"]:
            link_rows.append((area["slug"], source_id))

    cursor.executemany(
        """
        insert into entity_source_links (entity_type, entity_ref, source_id)
        values ('area', %s, %s)
        on conflict (entity_type, entity_ref, source_id) do nothing
        """,
        link_rows,
    )

    return {row["slug"]: row["id"] for row in area_rows}


def _insert_datasets(
    cursor: Any,
    archives: list[dict[str, Any]],
) -> dict[str, str]:
    dataset_rows = []
    dataset_ids: dict[str, str] = {}

    for archive in archives:
        dataset_id = str(uuid4())
        external_key = normalize_whitespace(archive.get("collection_id")) or str(uuid4())
        dataset_rows.append(
            {
                "id": dataset_id,
                "source_id": "biodiversidad-gt",
                "external_key": external_key,
                "title": normalize_whitespace(archive.get("title")) or external_key,
                "description": normalize_whitespace(archive.get("description")) or None,
                "archive_url": normalize_whitespace(archive.get("archive_url")) or None,
                "metadata_url": normalize_whitespace(archive.get("eml_url")) or None,
                "refreshed_at": coerce_date(archive.get("published_at")),
            }
        )
        dataset_ids[external_key] = dataset_id

    cursor.executemany(
        """
        insert into datasets (
          id,
          source_id,
          external_key,
          title,
          description,
          archive_url,
          metadata_url,
          refreshed_at
        )
        values (%(id)s, %(source_id)s, %(external_key)s, %(title)s, %(description)s, %(archive_url)s, %(metadata_url)s, %(refreshed_at)s)
        """,
        dataset_rows,
    )

    return dataset_ids


def _insert_taxa(
    cursor: Any,
    taxa: list[dict[str, Any]],
    taxon_media_rows: list[dict[str, Any]],
) -> dict[str, str]:
    taxon_rows = []
    taxon_ids: dict[str, str] = {}

    for taxon in taxa:
        taxon_id = str(uuid4())
        taxon_ids[taxon["scientific_name"]] = taxon_id
        taxon_rows.append(
            {
                "id": taxon_id,
                "slug": taxon["slug"],
                "common_name": taxon["common_name"],
                "scientific_name": taxon["scientific_name"],
                "taxonomic_group": taxon["group"],
                "featured_rank": taxon["featured_rank"],
            }
        )

    cursor.executemany(
        """
        insert into taxa (
          id,
          slug,
          common_name,
          scientific_name,
          taxonomic_group,
          status,
          endemism,
          summary,
          hero_metric,
          featured_rank
        )
        values (%(id)s, %(slug)s, %(common_name)s, %(scientific_name)s, %(taxonomic_group)s, '', '', '', '', %(featured_rank)s)
        """,
        taxon_rows,
    )

    cursor.executemany(
        """
        insert into entity_source_links (entity_type, entity_ref, source_id)
        values ('species', %s, 'biodiversidad-gt')
        on conflict (entity_type, entity_ref, source_id) do nothing
        """,
        [(taxon["slug"],) for taxon in taxa],
    )

    media_inserts = []
    for media in taxon_media_rows:
        taxon_id = taxon_ids.get(media["scientific_name"])
        if not taxon_id:
            continue
        media_inserts.append(
            {
                "id": str(uuid4()),
                "taxon_id": taxon_id,
                "source_id": media["source_id"],
                "media_kind": media["media_kind"],
                "url": media["url"],
                "alt_text": media["alt_text"],
                "attribution": media["attribution"],
                "license": media["license"],
                "is_primary": media["is_primary"],
                "sort_order": media["sort_order"],
            }
        )

    cursor.executemany(
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
        values (%(id)s, %(taxon_id)s, %(source_id)s, %(media_kind)s, %(url)s, %(alt_text)s, %(attribution)s, %(license)s, %(is_primary)s, %(sort_order)s)
        """,
        media_inserts,
    )

    return taxon_ids


def _insert_occurrences(
    cursor: Any,
    occurrences: list[dict[str, Any]],
    dataset_ids: dict[str, str],
    taxon_ids: dict[str, str],
    department_ids: dict[str, str],
) -> None:
    raw_rows = []
    normalized_rows = []
    public_rows = []

    for occurrence in occurrences:
        taxon_id = taxon_ids.get(occurrence["scientific_name"])
        if not taxon_id:
            continue

        raw_id = str(uuid4())
        normalized_id = str(uuid4())
        dataset_id = dataset_ids.get(occurrence["archive_collection_id"] or "")
        raw_payload = {
            "scientificName": occurrence["scientific_name"],
            "vernacularName": occurrence["common_name"]
            if occurrence["common_name"] != occurrence["scientific_name"]
            else None,
            "family": occurrence["family"],
            "order": occurrence["order"],
            "class": occurrence["class"],
            "phylum": occurrence["phylum"],
            "kingdom": occurrence["kingdom"],
            "country": occurrence["country"],
            "stateProvince": occurrence["state_province"],
            "municipality": occurrence["municipality"],
            "locality": occurrence["locality"],
            "eventDate": occurrence["observed_at"],
            "decimalLatitude": occurrence["latitude"],
            "decimalLongitude": occurrence["longitude"],
            "group": occurrence["group"],
            "media": occurrence.get("media") or [],
        }

        raw_rows.append(
            {
                "id": raw_id,
                "dataset_id": dataset_id,
                "source_id": "biodiversidad-gt",
                "source_occurrence_id": occurrence["occurrence_id"],
                "payload": json.dumps(raw_payload, ensure_ascii=False),
            }
        )

        public_geometry = (
            json.dumps(build_public_cell_polygon(occurrence["latitude"], occurrence["longitude"]))
            if occurrence["latitude"] is not None and occurrence["longitude"] is not None
            else None
        )
        department_slug_hint = occurrence.get("department_slug_hint")
        normalized_rows.append(
            {
                "id": normalized_id,
                "raw_occurrence_id": raw_id,
                "taxon_id": taxon_id,
                "source_id": "biodiversidad-gt",
                "visibility": occurrence["visibility"],
                "area_admin_id": department_ids.get(department_slug_hint) if not public_geometry else None,
                "area_protected_id": None,
                "observed_at": occurrence["observed_at"],
                "elevation_band": occurrence["elevation_band"],
                "is_sensitive": False,
                "longitude": occurrence["longitude"],
                "latitude": occurrence["latitude"],
                "public_geometry": public_geometry,
            }
        )

        if public_geometry:
            public_rows.append(
                {
                    "id": str(uuid4()),
                    "normalized_occurrence_id": normalized_id,
                    "visibility": "generalized_public",
                    "public_geometry": public_geometry,
                    "public_summary": json.dumps(
                        {
                            "cellId": occurrence["public_cell_id"],
                            "publicStrategy": occurrence["public_strategy"],
                            "stateProvince": occurrence["state_province"],
                            "scientificName": occurrence["scientific_name"],
                        },
                        ensure_ascii=False,
                    ),
                }
            )

    cursor.executemany(
        """
        insert into occurrences_raw (
          id,
          dataset_id,
          source_id,
          source_occurrence_id,
          payload
        )
        values (%(id)s, %(dataset_id)s, %(source_id)s, %(source_occurrence_id)s, %(payload)s::jsonb)
        """,
        raw_rows,
    )

    cursor.executemany(
        """
        insert into occurrences_normalized (
          id,
          raw_occurrence_id,
          taxon_id,
          source_id,
          visibility,
          area_admin_id,
          area_protected_id,
          observed_at,
          elevation_band,
          is_sensitive,
          exact_geom,
          public_geom
        )
        values (
          %(id)s,
          %(raw_occurrence_id)s,
          %(taxon_id)s,
          %(source_id)s,
          %(visibility)s::visibility,
          %(area_admin_id)s,
          %(area_protected_id)s,
          %(observed_at)s,
          %(elevation_band)s,
          %(is_sensitive)s,
          case
            when %(longitude)s::double precision is not null and %(latitude)s::double precision is not null
              then st_setsrid(st_makepoint(%(longitude)s::double precision, %(latitude)s::double precision), 4326)
            else null
          end,
          case
            when %(public_geometry)s::text is not null
              then st_setsrid(st_geomfromgeojson(%(public_geometry)s::text), 4326)
            else null
          end
        )
        """,
        normalized_rows,
    )

    cursor.executemany(
        """
        insert into occurrences_public (
          id,
          normalized_occurrence_id,
          visibility,
          public_geom,
          public_summary
        )
        values (
          %(id)s,
          %(normalized_occurrence_id)s,
          %(visibility)s::visibility,
          st_setsrid(st_geomfromgeojson(%(public_geometry)s::text), 4326),
          %(public_summary)s::jsonb
        )
        """,
        public_rows,
    )


def _assign_spatial_membership(cursor: Any) -> None:
    cursor.execute(
        """
        with department_matches as (
          select
            occ.id as occurrence_id,
            (
              select dept.id
              from areas_admin dept
              join area_geometries geom on geom.id = dept.geometry_id
              where dept.kind = 'department'
                and occ.exact_geom is not null
                and st_intersects(geom.geom, occ.exact_geom)
              order by st_area(geom.geom) asc
              limit 1
            ) as department_id
          from occurrences_normalized occ
        )
        update occurrences_normalized occ
        set area_admin_id = department_matches.department_id
        from department_matches
        where occ.id = department_matches.occurrence_id
          and department_matches.department_id is not null
        """
    )

    cursor.execute(
        """
        with protected_matches as (
          select
            occ.id as occurrence_id,
            (
              select pa.id
              from areas_protected pa
              join area_geometries geom on geom.id = pa.geometry_id
              where occ.exact_geom is not null
                and st_intersects(geom.geom, occ.exact_geom)
              order by st_area(geom.geom) asc
              limit 1
            ) as protected_area_id
          from occurrences_normalized occ
        )
        update occurrences_normalized occ
        set area_protected_id = protected_matches.protected_area_id
        from protected_matches
        where occ.id = protected_matches.occurrence_id
          and protected_matches.protected_area_id is not null
        """
    )


def _rebuild_rollups(cursor: Any) -> None:
    cursor.execute(
        """
        insert into taxon_presence_rollups (
          taxon_id,
          area_kind,
          area_ref,
          source_tier,
          occurrence_count,
          protected_occurrence_count,
          latest_observed_at,
          elevation_bands,
          refreshed_at
        )
        select
          occ.taxon_id,
          'country'::area_kind,
          'guatemala',
          src.tier,
          count(*)::int,
          count(*) filter (where occ.area_protected_id is not null)::int,
          max(occ.observed_at),
          coalesce(array_agg(distinct occ.elevation_band) filter (where occ.elevation_band is not null), '{}'),
          now()
        from occurrences_normalized occ
        join sources src on src.id = occ.source_id
        where occ.taxon_id is not null
        group by occ.taxon_id, src.tier
        on conflict (taxon_id, area_kind, area_ref, source_tier) do update
        set occurrence_count = excluded.occurrence_count,
            protected_occurrence_count = excluded.protected_occurrence_count,
            latest_observed_at = excluded.latest_observed_at,
            elevation_bands = excluded.elevation_bands,
            refreshed_at = excluded.refreshed_at
        """
    )

    cursor.execute(
        """
        insert into taxon_presence_rollups (
          taxon_id,
          area_kind,
          area_ref,
          source_tier,
          occurrence_count,
          protected_occurrence_count,
          latest_observed_at,
          elevation_bands,
          refreshed_at
        )
        select
          occ.taxon_id,
          'department'::area_kind,
          dept.slug,
          src.tier,
          count(*)::int,
          count(*) filter (where occ.area_protected_id is not null)::int,
          max(occ.observed_at),
          coalesce(array_agg(distinct occ.elevation_band) filter (where occ.elevation_band is not null), '{}'),
          now()
        from occurrences_normalized occ
        join sources src on src.id = occ.source_id
        join areas_admin dept on dept.id = occ.area_admin_id
        where occ.taxon_id is not null
          and dept.kind = 'department'
        group by occ.taxon_id, dept.slug, src.tier
        on conflict (taxon_id, area_kind, area_ref, source_tier) do update
        set occurrence_count = excluded.occurrence_count,
            protected_occurrence_count = excluded.protected_occurrence_count,
            latest_observed_at = excluded.latest_observed_at,
            elevation_bands = excluded.elevation_bands,
            refreshed_at = excluded.refreshed_at
        """
    )

    cursor.execute(
        """
        insert into taxon_presence_rollups (
          taxon_id,
          area_kind,
          area_ref,
          source_tier,
          occurrence_count,
          protected_occurrence_count,
          latest_observed_at,
          elevation_bands,
          refreshed_at
        )
        select
          occ.taxon_id,
          'protected_area'::area_kind,
          pa.slug,
          src.tier,
          count(*)::int,
          count(*) filter (where occ.area_protected_id is not null)::int,
          max(occ.observed_at),
          coalesce(array_agg(distinct occ.elevation_band) filter (where occ.elevation_band is not null), '{}'),
          now()
        from occurrences_normalized occ
        join sources src on src.id = occ.source_id
        join areas_protected pa on pa.id = occ.area_protected_id
        where occ.taxon_id is not null
        group by occ.taxon_id, pa.slug, src.tier
        on conflict (taxon_id, area_kind, area_ref, source_tier) do update
        set occurrence_count = excluded.occurrence_count,
            protected_occurrence_count = excluded.protected_occurrence_count,
            latest_observed_at = excluded.latest_observed_at,
            elevation_bands = excluded.elevation_bands,
            refreshed_at = excluded.refreshed_at
        """
    )

    cursor.execute(
        """
        insert into taxon_presence_rollups (
          taxon_id,
          area_kind,
          area_ref,
          source_tier,
          occurrence_count,
          protected_occurrence_count,
          latest_observed_at,
          elevation_bands,
          refreshed_at
        )
        select
          occ.taxon_id,
          'public_hex'::area_kind,
          'hex:' || md5(st_asgeojson(pub.public_geom)),
          src.tier,
          count(*)::int,
          count(*) filter (where occ.area_protected_id is not null)::int,
          max(occ.observed_at),
          coalesce(array_agg(distinct occ.elevation_band) filter (where occ.elevation_band is not null), '{}'),
          now()
        from occurrences_normalized occ
        join occurrences_public pub on pub.normalized_occurrence_id = occ.id
        join sources src on src.id = occ.source_id
        where occ.taxon_id is not null
        group by occ.taxon_id, 'hex:' || md5(st_asgeojson(pub.public_geom)), src.tier
        on conflict (taxon_id, area_kind, area_ref, source_tier) do update
        set occurrence_count = excluded.occurrence_count,
            protected_occurrence_count = excluded.protected_occurrence_count,
            latest_observed_at = excluded.latest_observed_at,
            elevation_bands = excluded.elevation_bands,
            refreshed_at = excluded.refreshed_at
        """
    )

    cursor.execute(
        """
        insert into public_cell_rollups (
          cell_ref,
          source_tier,
          taxon_scope,
          species_count,
          occurrence_count,
          latest_observed_at,
          refreshed_at
        )
        select
          'hex:' || md5(st_asgeojson(pub.public_geom)),
          src.tier,
          scope.taxon_scope,
          count(distinct occ.taxon_id)::int,
          count(*)::int,
          max(occ.observed_at),
          now()
        from occurrences_normalized occ
        join occurrences_public pub on pub.normalized_occurrence_id = occ.id
        join sources src on src.id = occ.source_id
        join taxa taxon on taxon.id = occ.taxon_id
        join lateral (
          values
            ('all', true),
            ('flora', taxon.taxonomic_group = 'flora'),
            ('fauna', taxon.taxonomic_group <> 'flora')
        ) as scope(taxon_scope, include_row) on scope.include_row
        where occ.taxon_id is not null
        group by 'hex:' || md5(st_asgeojson(pub.public_geom)), src.tier, scope.taxon_scope
        on conflict (cell_ref, source_tier, taxon_scope) do update
        set species_count = excluded.species_count,
            occurrence_count = excluded.occurrence_count,
            latest_observed_at = excluded.latest_observed_at,
            refreshed_at = excluded.refreshed_at
        """
    )

    cursor.execute(
        """
        insert into area_metrics (
          area_kind,
          area_ref,
          species_count,
          endemic_count,
          protected_count,
          story_label,
          refreshed_at
        )
        select
          'country'::area_kind,
          'guatemala',
          count(distinct occ.taxon_id)::int,
          0,
          (select count(*)::int from areas_protected),
          case
            when count(distinct occ.taxon_id) >= 320 then 'Pulso biodiverso muy alto'
            when count(distinct occ.taxon_id) >= 180 then 'Pulso biodiverso alto'
            when count(distinct occ.taxon_id) >= 80 then 'Pulso biodiverso medio'
            else 'Pulso biodiverso emergente'
          end,
          now()
        from occurrences_normalized occ
        """
    )

    cursor.execute(
        """
        insert into area_metrics (
          area_kind,
          area_ref,
          species_count,
          endemic_count,
          protected_count,
          story_label,
          refreshed_at
        )
        select
          'department'::area_kind,
          dept.slug,
          count(distinct occ.taxon_id)::int,
          0,
          count(distinct pa.slug)::int,
          case
            when count(distinct occ.taxon_id) >= 320 then 'Pulso biodiverso muy alto'
            when count(distinct occ.taxon_id) >= 180 then 'Pulso biodiverso alto'
            when count(distinct occ.taxon_id) >= 80 then 'Pulso biodiverso medio'
            else 'Pulso biodiverso emergente'
          end,
          now()
        from areas_admin dept
        left join occurrences_normalized occ on occ.area_admin_id = dept.id
        left join areas_protected pa on pa.id = occ.area_protected_id
        where dept.kind = 'department'
        group by dept.slug
        """
    )

    cursor.execute(
        """
        insert into area_metrics (
          area_kind,
          area_ref,
          species_count,
          endemic_count,
          protected_count,
          story_label,
          refreshed_at
        )
        select
          'protected_area'::area_kind,
          pa.slug,
          count(distinct occ.taxon_id)::int,
          0,
          1,
          case
            when count(distinct occ.taxon_id) >= 320 then 'Pulso biodiverso muy alto'
            when count(distinct occ.taxon_id) >= 180 then 'Pulso biodiverso alto'
            when count(distinct occ.taxon_id) >= 80 then 'Pulso biodiverso medio'
            else 'Pulso biodiverso emergente'
          end,
          now()
        from areas_protected pa
        left join occurrences_normalized occ on occ.area_protected_id = pa.id
        group by pa.slug
        """
    )
    
    cursor.execute(
        """
        update area_metrics
        set story_label = %s
        where area_kind = 'country' and area_ref = 'guatemala'
        """,
        (_biodiversity_label(_fetch_country_species_count(cursor)),),
    )


def _fetch_country_species_count(cursor: Any) -> int:
    cursor.execute(
        """
        select coalesce(species_count, 0)::int
        from area_metrics
        where area_kind = 'country' and area_ref = 'guatemala'
        limit 1
        """
    )
    row = cursor.fetchone()
    return int(row[0]) if row else 0


def _atlas_counts(cursor: Any) -> dict[str, int]:
    counts: dict[str, int] = {}
    for key, statement in {
        "taxa": "select count(*)::int from taxa",
        "occurrences": "select count(*)::int from occurrences_normalized",
        "departments": "select count(*)::int from areas_admin where kind = 'department'",
        "public_cells": "select count(*)::int from public_cell_rollups where taxon_scope = 'all'",
    }.items():
        cursor.execute(statement)
        counts[key] = int(cursor.fetchone()[0])
    return counts


def load_atlas_database(
    *,
    database_url: str,
    replace_atlas_data: bool = False,
    archive_limit: int | None = None,
    from_snapshot: Path | None = None,
) -> dict[str, int]:
    import psycopg

    bundle = build_loader_bundle(
        archive_limit=archive_limit,
        from_snapshot=from_snapshot,
    )

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            existing_count = _count_existing_atlas_records(cursor)
            if existing_count > 0 and not replace_atlas_data:
                raise RuntimeError(
                    "Atlas tables already contain data. Re-run with --replace-atlas-data to reload them."
                )

            if replace_atlas_data:
                _replace_atlas_data(cursor)

            _ensure_sources(cursor, bundle["sources"])
            _ensure_protected_area_subset(cursor)
            department_ids = _insert_country_and_departments(
                cursor,
                bundle["country"],
                bundle["departments"],
            )
            dataset_ids = _insert_datasets(cursor, bundle["archives"])
            taxon_ids = _insert_taxa(cursor, bundle["taxa"], bundle["taxon_media"])
            _insert_occurrences(
                cursor,
                bundle["occurrences"],
                dataset_ids,
                taxon_ids,
                department_ids,
            )
            _assign_spatial_membership(cursor)
            _rebuild_rollups(cursor)

        connection.commit()

        with connection.cursor() as cursor:
            return _atlas_counts(cursor)
