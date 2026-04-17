from __future__ import annotations

from datetime import date
import re
import unicodedata


PUBLIC_CELL_WIDTH = 0.18

_FISH_CLASSES = {
    "actinopterygii",
    "chondrichthyes",
    "sarcopterygii",
    "myxini",
    "cephalaspidomorphi",
    "elasmobranchii",
}


def normalize_whitespace(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def normalize_text(value: str | None) -> str:
    normalized = unicodedata.normalize("NFKD", normalize_whitespace(value))
    return "".join(character for character in normalized if not unicodedata.combining(character))


def slugify_text(value: str | None) -> str:
    normalized = normalize_text(value).lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    normalized = re.sub(r"-{2,}", "-", normalized)
    return normalized.strip("-")


def coerce_float(value: str | float | int | None) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def coerce_date(value: str | None) -> str | None:
    raw = normalize_whitespace(value)
    if not raw:
        return None

    match = re.search(r"(\d{4})-(\d{2})-(\d{2})", raw)
    if match:
        candidate = match.group(0)
        try:
            parsed = date.fromisoformat(candidate)
        except ValueError:
            return None
        return parsed.isoformat()

    year_match = re.search(r"\b(\d{4})\b", raw)
    if year_match:
        year = int(year_match.group(1))
        if year < 1:
            return None
        return f"{year:04d}-01-01"

    return None


def round_public_cell(value: float) -> float:
    return round(value * 4) / 4


def build_public_cell_id(latitude: float | None, longitude: float | None) -> str | None:
    if latitude is None or longitude is None:
        return None
    return f"hex:{round_public_cell(longitude):.2f}:{round_public_cell(latitude):.2f}"


def build_public_cell_polygon(
    latitude: float,
    longitude: float,
    width: float = PUBLIC_CELL_WIDTH,
) -> dict[str, object]:
    center_lng = round_public_cell(longitude)
    center_lat = round_public_cell(latitude)
    half = width / 2

    return {
        "type": "Polygon",
        "coordinates": [
            [
                [center_lng - half, center_lat - half],
                [center_lng + half, center_lat - half],
                [center_lng + half, center_lat + half],
                [center_lng - half, center_lat + half],
                [center_lng - half, center_lat - half],
            ]
        ],
    }


def normalize_taxonomic_group(record: dict[str, str | None]) -> str:
    kingdom = slugify_text(record.get("kingdom"))
    taxon_class = slugify_text(record.get("class"))
    phylum = slugify_text(record.get("phylum"))

    if kingdom == "plantae":
        return "flora"
    if kingdom == "fungi":
        return "hongos"
    if taxon_class == "aves":
        return "aves"
    if taxon_class == "mammalia":
        return "mamiferos"
    if taxon_class == "amphibia":
        return "anfibios"
    if taxon_class == "reptilia":
        return "reptiles"
    if taxon_class in _FISH_CLASSES:
        return "peces"
    if taxon_class == "insecta":
        return "insectos"
    if taxon_class == "arachnida":
        return "aracnidos"
    if phylum == "mollusca":
        return "moluscos"
    if phylum == "arthropoda":
        return "otros-invertebrados"
    if kingdom == "animalia":
        return "fauna"
    return "fauna"


def taxon_scope_for_group(group: str) -> str:
    return "flora" if group == "flora" else "fauna"


def _extract_elevation_candidates(record: dict[str, str | None]) -> list[float]:
    candidates = [
        coerce_float(record.get("minimumElevationInMeters")),
        coerce_float(record.get("maximumElevationInMeters")),
    ]

    verbatim = normalize_whitespace(record.get("verbatimElevation"))
    if verbatim:
        for match in re.findall(r"-?\d+(?:\.\d+)?", verbatim):
            candidates.append(coerce_float(match))

    return [candidate for candidate in candidates if candidate is not None]


def coerce_elevation_band(record: dict[str, str | None]) -> str | None:
    candidates = _extract_elevation_candidates(record)
    if not candidates:
        return None

    mean = sum(candidates) / len(candidates)
    if mean >= 1500:
        return "alta"
    if mean >= 600:
        return "media"
    return "baja"


def safe_date(value: str | None) -> date | None:
    parsed = coerce_date(value)
    if not parsed:
        return None
    return date.fromisoformat(parsed)
