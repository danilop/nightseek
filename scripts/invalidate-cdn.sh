#!/usr/bin/env bash
set -euo pipefail

DISTRIBUTION_ID="E2KBTPAF1A4T9O"

echo "Invalidating CloudFront cache for distribution ${DISTRIBUTION_ID}..."
aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*" \
  --output json

echo "Invalidation submitted. It typically completes within 1-2 minutes."
