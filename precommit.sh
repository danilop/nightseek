#!/bin/bash
# Pre-commit hook for code quality checks
# This repo is dual-interface: Python CLI + TypeScript Web

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  Running code quality checks (Python CLI + TypeScript Web)"
echo "═══════════════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────
# PYTHON CLI CHECKS
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "──────────── Python CLI ────────────"

# Run ruff for linting and formatting
echo "→ Running ruff check (lint)..."
uv run ruff check .

echo "→ Running ruff format check..."
uv run ruff format --check .

# Run ty for type checking
echo "→ Running ty (type check)..."
uv run ty check .

# Run vulture for dead code detection
echo "→ Running vulture (dead code)..."
uv run vulture *.py --min-confidence 80 --exclude test_*.py

# Run pytest
echo "→ Running pytest..."
uv run pytest test_nightseek.py -q

echo "✓ Python checks passed!"

# ─────────────────────────────────────────────────────────────────────
# TYPESCRIPT WEB CHECKS
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "──────────── TypeScript Web ────────────"

cd web

# Run Biome for linting (equivalent to ruff lint)
echo "→ Running biome check (lint + format)..."
pnpm exec biome check src

# Run TypeScript compiler for type checking (equivalent to ty)
echo "→ Running tsc (type check)..."
pnpm exec tsc --noEmit

# Run knip for dead code detection (equivalent to vulture)
# Only check for unused files (not exports - those are utility functions for future use)
echo "→ Running knip (dead code)..."
pnpm exec knip --include files

# Run vitest (equivalent to pytest)
echo "→ Running vitest..."
pnpm exec vitest run --reporter=dot

cd ..

echo "✓ TypeScript checks passed!"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✓ All checks passed!"
echo "═══════════════════════════════════════════════════════════════"
