#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${BIOGT_ETL_VENV:-$ROOT_DIR/.etl-venv}"
PYTHON_BIN="${BIOGT_ETL_PYTHON:-python3}"
INSTALL_SPEC="$ROOT_DIR/workers/etl"
BASE_MARKER_FILE="$VENV_DIR/.biogt-etl-ready"
DEV_MARKER_FILE="$VENV_DIR/.biogt-etl-dev-ready"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Missing Python interpreter: $PYTHON_BIN" >&2
  exit 1
fi

if ! "$PYTHON_BIN" - <<'PY'
import sys

raise SystemExit(0 if sys.version_info >= (3, 11) else 1)
PY
then
  echo "BioGT ETL requires Python 3.11 or newer." >&2
  exit 1
fi

if [ ! -x "$VENV_DIR/bin/python" ]; then
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

MARKER_FILE="$BASE_MARKER_FILE"
if [ "${BIOGT_ETL_REQUIRE_PYTEST:-0}" = "1" ]; then
  INSTALL_SPEC="$ROOT_DIR/workers/etl[dev]"
  MARKER_FILE="$DEV_MARKER_FILE"
fi

if [ ! -f "$MARKER_FILE" ] || [ "$ROOT_DIR/workers/etl/pyproject.toml" -nt "$MARKER_FILE" ]; then
  "$VENV_DIR/bin/python" -m pip install -e "$INSTALL_SPEC"
  touch "$BASE_MARKER_FILE"
  if [ "${BIOGT_ETL_REQUIRE_PYTEST:-0}" = "1" ]; then
    touch "$DEV_MARKER_FILE"
  fi
fi

export PYTHONPATH="$ROOT_DIR/workers/etl/src${PYTHONPATH:+:$PYTHONPATH}"
exec "$VENV_DIR/bin/python" "$@"
