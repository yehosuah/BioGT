from __future__ import annotations

from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json
import time


BASE_URL = "https://api.gbif.org/v1"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (BioGT ETL Connector)",
}


def fetch_json(
    url: str,
    *,
    attempts: int = 3,
    request_interval_seconds: float = 0.0,
    timeout_seconds: float = 30.0,
) -> dict[str, Any]:
    if request_interval_seconds > 0:
        time.sleep(request_interval_seconds)

    last_error: Exception | None = None
    for attempt in range(attempts):
        request = Request(url, headers=DEFAULT_HEADERS)
        try:
            with urlopen(request, timeout=timeout_seconds) as response:  # noqa: S310 - official public API
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            last_error = error
            if error.code != 429 and not 500 <= error.code < 600:
                break
        except URLError as error:
            last_error = error

        if attempt < attempts - 1:
            time.sleep(min(2**attempt, 4))

    raise RuntimeError(f"Failed to fetch GBIF URL: {url}") from last_error


def match_species(
    scientific_name: str,
    *,
    request_interval_seconds: float = 0.0,
) -> dict[str, Any]:
    params = {
        "name": scientific_name,
        "verbose": "true",
    }
    return fetch_json(
        f"{BASE_URL}/species/match?{urlencode(params)}",
        request_interval_seconds=request_interval_seconds,
    )


def search_occurrences_with_media(
    *,
    taxon_key: int,
    country_code: str | None = None,
    limit: int = 10,
    request_interval_seconds: float = 0.0,
) -> list[dict[str, Any]]:
    params: dict[str, Any] = {
        "taxonKey": taxon_key,
        "mediaType": "StillImage",
        "limit": limit,
    }
    if country_code:
        params["country"] = country_code

    payload = fetch_json(
        f"{BASE_URL}/occurrence/search?{urlencode(params)}",
        request_interval_seconds=request_interval_seconds,
    )
    results = payload.get("results")
    return results if isinstance(results, list) else []
