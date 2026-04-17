from __future__ import annotations

from io import BytesIO
import zipfile

from biomap_gt_etl.pipeline import build_public_source_snapshot


def _build_archive_bundle() -> bytes:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(
            "occurrences.csv",
            "\n".join(
                [
                    (
                        "id,occurrenceID,scientificName,vernacularName,family,order,class,phylum,kingdom,"
                        "country,stateProvince,municipality,locality,eventDate,decimalLatitude,decimalLongitude,"
                        "minimumElevationInMeters,maximumElevationInMeters"
                    ),
                    (
                        "1,occ-1,Quercus skinneri,,Fagaceae,Fagales,Magnoliopsida,Tracheophyta,Plantae,"
                        "Guatemala,Alta Verapaz,Cobán,Bosque nuboso,2025-05-04,15.47,-90.38,1200,1400"
                    ),
                    (
                        "2,occ-2,Panthera onca,Jaguar,Felidae,Carnivora,Mammalia,Chordata,Animalia,"
                        "Guatemala,Petén,Flores,Selva baja,2024-11-14,17.22,-89.62,350,420"
                    ),
                    (
                        "3,occ-3,Basiliscus vittatus,,Corytophanidae,Squamata,Reptilia,Chordata,Animalia,"
                        "Guatemala,Izabal,Livingston,Caribe húmedo,2023-10-23,15.72,-88.95,10,25"
                    ),
                ]
            ),
        )
        archive.writestr(
            "multimedia.csv",
            "\n".join(
                [
                    "coreid,accessURI,thumbnailAccessURI,format,type,rights,creator,caption",
                    (
                        "2,https://example.com/jaguar.jpg,https://example.com/jaguar-thumb.jpg,"
                        "image/jpeg,StillImage,CC-BY,Camera Trap,JAGUAR"
                    ),
                ]
            ),
        )
    return buffer.getvalue()


def test_snapshot_shape(monkeypatch):
    monkeypatch.setattr(
        "biomap_gt_etl.pipeline.fetch_archive_feed",
        lambda limit=4: [
            type(
                "ArchiveFeedItem",
                (),
                {
                    "collection_id": "34",
                    "title": "ASUHIC DwC-Archive",
                    "description": "Sample archive",
                    "archive_url": "https://example.com/archive.zip",
                    "eml_url": "https://example.com/archive.eml",
                    "published_at": "Mon, 02 Mar 2026 08:57:00",
                },
            )()
        ],
    )
    monkeypatch.setattr(
        "biomap_gt_etl.pipeline.fetch_archive_bundle",
        lambda archive_url: _build_archive_bundle(),
    )
    monkeypatch.setattr(
        "biomap_gt_etl.pipeline.fetch_occurrence_sample",
        lambda: {
            "occurrenceID": "sample-occurrence",
            "sciname": "Doryphora viridifasciata",
            "family": "Chrysomelidae",
            "country": "Guatemala",
            "stateProvince": "Quiché",
            "locality": "Finca el Recuerdo",
            "decimalLatitude": 15.45,
            "decimalLongitude": -90.75,
        },
    )

    snapshot = build_public_source_snapshot(
        archive_limit=1,
        occurrence_limit_per_archive=10,
        preview_limit=10,
    )

    assert snapshot["source"]["id"] == "biodiversidad-gt"
    assert snapshot["ingestion"]["normalized_occurrence_count"] == 3
    assert snapshot["archives"][0]["collection_id"] == "34"
    assert snapshot["sample_occurrence"]["public_strategy"] == "generalize_to_public_hex"
    assert snapshot["sample_occurrences"][0]["public_cell_id"] == "hex:-90.50:15.50"
    assert snapshot["sample_occurrences"][0]["elevationBand"] == "media"
    assert snapshot["regional_rollups"][0]["visible_species"] >= 1
    assert {item["scope"] for item in snapshot["taxon_scope_rollups"]} == {"fauna", "flora"}
    assert snapshot["public_cell_rollups"][0]["visible_species"] >= 1

    taxa_by_name = {item["scientific_name"]: item for item in snapshot["taxa"]}
    assert taxa_by_name["Panthera onca"]["common_name"] == "Jaguar"
    assert taxa_by_name["Quercus skinneri"]["common_name"] == "Quercus skinneri"
    assert taxa_by_name["Basiliscus vittatus"]["group"] == "reptiles"
    assert taxa_by_name["Panthera onca"]["primary_media"]["access_uri"] == "https://example.com/jaguar.jpg"
