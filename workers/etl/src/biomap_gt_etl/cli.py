from __future__ import annotations

from argparse import ArgumentParser
from pathlib import Path
import json
import os

from biomap_gt_etl.loader import load_atlas_database
from biomap_gt_etl.media_backfill import backfill_taxon_media
from biomap_gt_etl.pipeline import build_public_source_snapshot


def main() -> None:
    parser = ArgumentParser(description="BioMap Guatemala ETL utilities")
    subparsers = parser.add_subparsers(dest="command", required=True)

    snapshot_parser = subparsers.add_parser(
        "snapshot", help="Fetch a compact Biodiversidad.gt public snapshot"
    )
    snapshot_parser.add_argument("--output", type=Path, required=True)
    snapshot_parser.add_argument("--archive-limit", type=int, default=4)
    snapshot_parser.add_argument("--occurrence-limit-per-archive", type=int, default=40)
    snapshot_parser.add_argument("--preview-limit", type=int, default=12)

    load_parser = subparsers.add_parser(
        "load", help="Populate the atlas database from live Biodiversidad.gt data or a snapshot"
    )
    load_parser.add_argument("--database-url", type=str, default=os.environ.get("DATABASE_URL"))
    load_parser.add_argument("--replace-atlas-data", action="store_true")
    load_parser.add_argument("--archive-limit", type=int, default=None)
    load_parser.add_argument("--from-snapshot", type=Path)

    backfill_parser = subparsers.add_parser(
        "backfill-media",
        help="Populate missing taxon_media rows from vetted external public sources",
    )
    backfill_parser.add_argument(
        "--database-url",
        type=str,
        default=os.environ.get("DATABASE_URL"),
    )
    backfill_parser.add_argument("--limit", type=int, default=None)
    backfill_parser.add_argument("--dry-run", action="store_true")

    args = parser.parse_args()

    if args.command == "snapshot":
        payload = build_public_source_snapshot(
            archive_limit=args.archive_limit,
            occurrence_limit_per_archive=args.occurrence_limit_per_archive,
            preview_limit=args.preview_limit,
        )
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return

    if not args.database_url:
        raise SystemExit("DATABASE_URL or --database-url is required for atlas loading.")

    if args.command == "backfill-media":
        summary = backfill_taxon_media(
            database_url=args.database_url,
            limit=args.limit,
            dry_run=args.dry_run,
        )
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return

    summary = load_atlas_database(
        database_url=args.database_url,
        replace_atlas_data=args.replace_atlas_data,
        archive_limit=args.archive_limit,
        from_snapshot=args.from_snapshot,
    )
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
