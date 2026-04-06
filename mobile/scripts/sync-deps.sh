#!/usr/bin/env bash
#
# sync-deps.sh — Sync web/ dependencies into mobile/package.json
#
# Reads dependencies from web/package.json and updates mobile/package.json
# to keep versions aligned. Preserves Capacitor-specific dependencies.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
WEB_DIR="$MOBILE_DIR/../web"

if [ ! -f "$WEB_DIR/package.json" ]; then
  echo "Error: web/package.json not found at $WEB_DIR/package.json"
  exit 1
fi

if [ ! -f "$MOBILE_DIR/package.json" ]; then
  echo "Error: mobile/package.json not found at $MOBILE_DIR/package.json"
  exit 1
fi

echo "Syncing dependencies from web/package.json to mobile/package.json..."

# Use node to read web deps and update mobile package.json
node -e "
const fs = require('fs');
const webPkg = JSON.parse(fs.readFileSync('$WEB_DIR/package.json', 'utf8'));
const mobilePkg = JSON.parse(fs.readFileSync('$MOBILE_DIR/package.json', 'utf8'));

// Sync runtime dependencies (keep Capacitor deps, update everything else)
const capacitorDeps = Object.entries(mobilePkg.dependencies || {})
  .filter(([name]) => name.startsWith('@capacitor/'));

// Start with web deps, then add Capacitor deps
mobilePkg.dependencies = { ...webPkg.dependencies };
for (const [name, version] of capacitorDeps) {
  mobilePkg.dependencies[name] = version;
}

// Sort dependencies alphabetically
const sortObj = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
mobilePkg.dependencies = sortObj(mobilePkg.dependencies);

// Sync relevant devDependencies (types, vite, typescript, postcss, tailwindcss)
const syncDevDeps = ['@types/react', '@types/react-dom', '@vitejs/plugin-react', 'postcss', 'tailwindcss', 'typescript', 'vite'];
for (const dep of syncDevDeps) {
  if (webPkg.devDependencies?.[dep]) {
    mobilePkg.devDependencies[dep] = webPkg.devDependencies[dep];
  }
}
mobilePkg.devDependencies = sortObj(mobilePkg.devDependencies);

fs.writeFileSync('$MOBILE_DIR/package.json', JSON.stringify(mobilePkg, null, 2) + '\n');
console.log('Done! Dependencies synced.');
console.log('Run \"npm install\" in mobile/ to install updated packages.');
"
