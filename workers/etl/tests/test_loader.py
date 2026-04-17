from __future__ import annotations

from pathlib import Path
import json

from biomap_gt_etl.loader import build_loader_bundle


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
        "source": {"id": "biodiversidad-gt", "name": "Portal de Biodiversidad de Guatemala"},
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
                    },
                    {
                        "access_uri": "https://example.com/jaguar.jpg",
                        "thumbnail_access_uri": None,
                        "type": "StillImage",
                        "format": "image/jpeg",
                        "rights": "CC-BY",
                        "creator": "Camera Trap",
                        "caption": "Jaguar duplicate",
                    },
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


def test_build_loader_bundle_uses_snapshot_data(monkeypatch, tmp_path):
    snapshot_path = _write_snapshot(tmp_path)

    monkeypatch.setattr(
        "biomap_gt_etl.loader.fetch_boundary_geojson",
        lambda iso, adm: COUNTRY_GEOJSON if adm == "ADM0" else DEPARTMENT_GEOJSON,
    )

    bundle = build_loader_bundle(from_snapshot=snapshot_path)

    assert len(bundle["departments"]) == 2
    assert {department["slug"] for department in bundle["departments"]} == {
        "peten",
        "alta-verapaz",
    }
    taxa_by_name = {taxon["scientific_name"]: taxon for taxon in bundle["taxa"]}
    assert taxa_by_name["Panthera onca"]["common_name"] == "Jaguar"
    assert taxa_by_name["Quercus skinneri"]["common_name"] == "Quercus skinneri"
    assert len(bundle["taxon_media"]) == 1
    assert bundle["occurrences"][1]["department_slug_hint"] == "alta-verapaz"
