#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$project_root/.tmp" "$project_root/.cache/pip"

TMPDIR="$project_root/.tmp" PIP_CACHE_DIR="$project_root/.cache/pip" \
  python3 -B -m venv "$project_root/.venv"

cat > "$project_root/.venv/pip.conf" <<EOF
[global]
cache-dir = $project_root/.cache/pip
disable-pip-version-check = true
EOF

"$project_root/.venv/bin/python" -B -c 'import sys; print(sys.executable)'
