from __future__ import annotations

from typing import Any
from urllib.request import Request, urlopen
import json


BASE_URL = "https://www.geoboundaries.org/api/current/gbOpen"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (BioGT geoBoundaries connector)",
}


def fetch_json(url: str) -> dict[str, Any]:
    request = Request(url, headers=DEFAULT_HEADERS)
    with urlopen(request) as response:  # noqa: S310 - public read-only endpoint
        return json.loads(response.read().decode("utf-8"))


def fetch_boundary_metadata(iso: str, adm: str) -> dict[str, Any]:
    return fetch_json(f"{BASE_URL}/{iso}/{adm}/")


def fetch_boundary_geojson(iso: str, adm: str, simplified: bool = False) -> dict[str, Any]:
    metadata = fetch_boundary_metadata(iso, adm)
    download_url = (
        metadata.get("simplifiedGeometryGeoJSON")
        if simplified
        else metadata.get("gjDownloadURL")
    )
    if not download_url:
        raise ValueError(f"geoBoundaries metadata for {iso} {adm} did not include a GeoJSON URL.")
    return fetch_json(str(download_url))
