from __future__ import annotations

from dataclasses import dataclass
from html import unescape
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen
import json
import re
import time
import xml.etree.ElementTree as ET

from biomap_gt_etl.normalization import normalize_whitespace


BASE_URL = "https://biodiversidad.gt/portal"
RSS_URL = f"{BASE_URL}/content/dwca/rss.xml"
MEDIA_SEARCH_URL = f"{BASE_URL}/imagelib/search.php"
OCCURRENCE_URL = f"{BASE_URL}/collections/individual/index.php"
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (BioGT ETL Connector)",
}

_SEARCH_RESULT_PATTERN = re.compile(
    r'openIndPU\((?P<occurrence_id>\d+)\).*?<img src="(?P<thumbnail_url>[^"]+)".*?'
    r'openTaxonPopup\(\d+\);return false;"[^>]*>\s*<i>(?P<scientific_name>.*?)</i>',
    re.DOTALL,
)
_DETAIL_TAXON_PATTERN = re.compile(
    r"<label>\s*Tax[oó]n:\s*</label>\s*<i>(?P<scientific_name>.*?)</i>",
    re.DOTALL,
)
_DETAIL_IMAGE_PATTERN = re.compile(
    r'id="thumbnail-div".*?<a[^>]+href="(?P<image_url>[^"]+)"',
    re.DOTALL,
)
_DETAIL_AUTHOR_PATTERN = re.compile(
    r"Autor:\s*(?P<creator>[^<]+)<",
    re.DOTALL,
)
_DETAIL_RIGHTS_BLOCK_PATTERN = re.compile(
    r'id="rights-div".*?</div>\s*</div>',
    re.DOTALL,
)
_DETAIL_RIGHTS_LINK_PATTERN = re.compile(
    r'<a[^>]+href="(?P<license_href>[^"]+)"[^>]*>(?P<license_text>.*?)</a>',
    re.DOTALL,
)


@dataclass(slots=True)
class ArchiveFeedItem:
    collection_id: str
    title: str
    description: str
    archive_url: str
    eml_url: str
    published_at: str


@dataclass(slots=True)
class MediaSearchResult:
    occurrence_id: str
    scientific_name: str
    thumbnail_url: str | None


@dataclass(slots=True)
class OccurrenceMediaDetail:
    scientific_name: str | None
    image_url: str | None
    creator: str | None
    license: str | None


def _normalize_url(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit(
        (
            parts.scheme,
            parts.netloc.encode("idna").decode("ascii"),
            quote(parts.path),
            quote(parts.query, safe="=&?/"),
            quote(parts.fragment, safe="=&?/"),
        )
    )


def _fetch_url(
    url: str,
    *,
    attempts: int = 3,
    request_interval_seconds: float = 0.0,
    timeout_seconds: float = 30.0,
) -> bytes:
    if request_interval_seconds > 0:
        time.sleep(request_interval_seconds)

    last_error: Exception | None = None
    for attempt in range(attempts):
        request = Request(_normalize_url(url), headers=DEFAULT_HEADERS)
        try:
            with urlopen(request, timeout=timeout_seconds) as response:  # noqa: S310 - public read-only endpoint
                return response.read()
        except HTTPError as error:
            last_error = error
            if error.code != 429 and not 500 <= error.code < 600:
                break
        except URLError as error:
            last_error = error

        if attempt < attempts - 1:
            time.sleep(min(2**attempt, 4))

    raise RuntimeError(f"Failed to fetch Biodiversidad.gt URL: {url}") from last_error


def fetch_text(
    url: str,
    *,
    attempts: int = 3,
    request_interval_seconds: float = 0.0,
    timeout_seconds: float = 30.0,
) -> str:
    return _fetch_url(
        url,
        attempts=attempts,
        request_interval_seconds=request_interval_seconds,
        timeout_seconds=timeout_seconds,
    ).decode("utf-8")


def fetch_bytes(
    url: str,
    *,
    attempts: int = 3,
    request_interval_seconds: float = 0.0,
    timeout_seconds: float = 30.0,
) -> bytes:
    return _fetch_url(
        url,
        attempts=attempts,
        request_interval_seconds=request_interval_seconds,
        timeout_seconds=timeout_seconds,
    )


def _clean_fragment(value: str | None) -> str | None:
    cleaned = normalize_whitespace(re.sub(r"<[^>]+>", "", unescape(value or "")))
    return cleaned or None


def fetch_archive_feed(limit: int | None = 6) -> list[ArchiveFeedItem]:
    raw_xml = fetch_text(RSS_URL)
    root = ET.fromstring(raw_xml)
    items: list[ArchiveFeedItem] = []

    feed_items = root.findall("./channel/item")
    if limit is not None:
        feed_items = feed_items[:limit]

    for item in feed_items:
        items.append(
            ArchiveFeedItem(
                collection_id=item.attrib.get("collid", ""),
                title=item.findtext("title", default=""),
                description=item.findtext("description", default=""),
                archive_url=item.findtext("link", default=""),
                eml_url=item.findtext("emllink", default=""),
                published_at=item.findtext("pubDate", default=""),
            )
        )

    return items


def fetch_occurrence_sample(occurrence_id: str = "395910") -> dict[str, Any]:
    raw_json = fetch_text(f"{BASE_URL}/api/v2/occurrence/{occurrence_id}")
    payload = json.loads(raw_json)
    return payload[0]


def fetch_archive_bundle(archive_url: str) -> bytes:
    return fetch_bytes(archive_url)


def parse_media_search_results(page_html: str) -> list[MediaSearchResult]:
    results: list[MediaSearchResult] = []
    for match in _SEARCH_RESULT_PATTERN.finditer(page_html):
        scientific_name = _clean_fragment(match.group("scientific_name"))
        if not scientific_name:
            continue
        results.append(
            MediaSearchResult(
                occurrence_id=match.group("occurrence_id"),
                scientific_name=scientific_name,
                thumbnail_url=normalize_whitespace(match.group("thumbnail_url")) or None,
            )
        )
    return results


def search_taxon_media(
    scientific_name: str,
    *,
    request_interval_seconds: float = 0.0,
) -> list[MediaSearchResult]:
    params = {
        "submitaction": "search",
        "taxa": scientific_name,
        "taxontype": 2,
        "imagecount": 1,
        "imagetype": 0,
        "mediaType": "image",
        "cntperpage": 20,
    }
    url = f"{MEDIA_SEARCH_URL}?{urlencode(params)}"
    return parse_media_search_results(
        fetch_text(
            url,
            request_interval_seconds=request_interval_seconds,
        )
    )


def parse_occurrence_media_detail(page_html: str) -> OccurrenceMediaDetail:
    taxon_match = _DETAIL_TAXON_PATTERN.search(page_html)
    image_match = _DETAIL_IMAGE_PATTERN.search(page_html)
    author_match = _DETAIL_AUTHOR_PATTERN.search(page_html)
    rights_block_match = _DETAIL_RIGHTS_BLOCK_PATTERN.search(page_html)

    license_value = None
    if rights_block_match:
        rights_block = rights_block_match.group(0)
        rights_link_match = _DETAIL_RIGHTS_LINK_PATTERN.search(rights_block)
        if rights_link_match:
            license_value = (
                normalize_whitespace(rights_link_match.group("license_href"))
                or _clean_fragment(rights_link_match.group("license_text"))
            )
        else:
            license_value = _clean_fragment(rights_block)

    return OccurrenceMediaDetail(
        scientific_name=_clean_fragment(
            taxon_match.group("scientific_name") if taxon_match else None
        ),
        image_url=normalize_whitespace(image_match.group("image_url")) if image_match else None,
        creator=_clean_fragment(author_match.group("creator") if author_match else None),
        license=license_value or None,
    )


def fetch_occurrence_media_detail(
    occurrence_id: str,
    *,
    request_interval_seconds: float = 0.0,
) -> OccurrenceMediaDetail:
    url = f"{OCCURRENCE_URL}?{urlencode({'occid': occurrence_id})}"
    return parse_occurrence_media_detail(
        fetch_text(
            url,
            request_interval_seconds=request_interval_seconds,
        )
    )
