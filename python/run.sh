#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$PROJECT_DIR/.venv"
REQ_FILE="$PROJECT_DIR/SmartAttendance/requirements.txt"

cd "$PROJECT_DIR"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 is not installed or not in PATH." >&2
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "Error: uv is not installed or not in PATH." >&2
  exit 1
fi

if [[ ! -d "$VENV_DIR" ]]; then
  echo "[1/4] Creating virtual environment at $VENV_DIR"
  python3 -m venv "$VENV_DIR"
else
  echo "[1/4] Reusing existing virtual environment at $VENV_DIR"
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

echo "[2/4] Ensuring pip is available"
python -m ensurepip --upgrade
python -m pip install --upgrade pip

echo "[3/4] Installing pip requirements"
if [[ -f "$REQ_FILE" ]]; then
  pip install -r "$REQ_FILE"
else
  echo "Error: requirements file not found at $REQ_FILE" >&2
  exit 1
fi

echo "[4/4] Running uv sync"
export UV_PROJECT_ENVIRONMENT="$VENV_DIR"
uv sync

echo "Starting FastAPI server"
exec uv run uvicorn main:app --reload
