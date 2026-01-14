#!/bin/bash
# Pre-commit hook for code quality checks

set -e

echo "Running code quality checks..."

# Run ruff for linting and formatting
echo "→ Running ruff check..."
uv run ruff check .

echo "→ Running ruff format check..."
uv run ruff format --check .

# Run ty for type checking
echo "→ Running ty..."
uv run ty check .

# Run vulture for dead code detection
echo "→ Running vulture..."
uv run vulture *.py --min-confidence 80

echo "✓ All checks passed!"
