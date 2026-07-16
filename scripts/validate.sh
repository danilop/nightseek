#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Validating NightSeek web app..."
pnpm --dir "$ROOT_DIR/web" run validate:full
pnpm --dir "$ROOT_DIR/web" run build

echo "Validating Capacitor mobile wrapper..."
npm --prefix "$ROOT_DIR/mobile" run build

echo "NightSeek validation passed."
