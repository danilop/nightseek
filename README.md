# NightSeek

NightSeek is a visual astronomy and astrophotography planner. It turns target
position, darkness, Moon conditions, local obstacles, weather, and equipment
constraints into practical observing and imaging windows.

**Open the app:** [nightseek.danilop.net](https://nightseek.danilop.net/)

This repository contains the React Progressive Web App and its Capacitor-based
iOS/macOS wrapper. The terminal application now lives in the independent
[nightseek-cli repository](https://github.com/danilop/nightseek-cli).

## What the app shows

- Start and end times when a target clears the configured minimum altitude and
  direction-specific horizon obstacles
- Civil, nautical, and astronomical twilight, including the Sun altitude behind
  each term and high-latitude nights where a threshold is never reached
- Moon phase, illumination, altitude, target separation, and estimated
  moonlight impact
- Solar and lunar eclipses with local visibility, timing, type, and coverage
- Planets, deep-sky objects, comets, asteroids, meteor showers, satellites,
  conjunctions, transits, and other astronomical events
- Weather, seeing, transparency, dew risk, cloud, wind, precipitation, aurora,
  and light-pollution context
- Telescope field of view, framing, mosaic guidance, sky maps, and target search

NightSeek is installable as a PWA and keeps core planning available offline.
Network-backed weather and frequently changing astronomical data use cached or
pre-fetched fallbacks when a service is unavailable.

## Repository layout

```text
nightseek/
├── web/                    # React/TypeScript PWA and astronomy engine
│   ├── e2e/                # Playwright browser tests
│   ├── public/             # Static PWA and catalogue assets
│   └── src/                # UI, state, calculations, data adapters, and tests
├── mobile/                 # Capacitor overlay and native iOS/macOS project
│   ├── ios/                # Xcode workspace and native app configuration
│   ├── public/             # Assets bundled for offline native use
│   └── src/                # Native-specific overrides
├── scripts/                # Validation, data refresh, and deployment utilities
└── .github/workflows/      # Web/mobile CI, deployment, and data refresh
```

The mobile app uses an overlay pattern: most source files resolve from `web/src`,
while native-specific implementations in `mobile/src` override location,
sharing, notifications, haptics, settings, and bundled sky-chart behavior. This
keeps one product implementation without copying the full web application.

## Web development

Requirements:

- Node.js 24
- pnpm 11.13.1

```bash
git clone https://github.com/danilop/nightseek.git
cd nightseek/web
pnpm install --frozen-lockfile
pnpm dev
```

Useful commands:

```bash
pnpm run type-check
pnpm run check
pnpm run dead-code
pnpm run test:run
pnpm run test:e2e
pnpm run build
```

The web app uses React, TypeScript, Vite, Tailwind CSS, Astronomy Engine,
Vitest, Playwright, Biome, and Knip.

## iOS and macOS development

Additional requirements:

- Xcode 15 or newer
- CocoaPods

```bash
cd mobile
npm ci
npm run sync-deps       # Run after shared web dependencies change
npm run sync            # Build and synchronize the Capacitor project
npm run open            # Open the Xcode workspace
```

The native wrapper adds local notifications, native location permissions,
sharing, haptics, bundled sky-chart assets, and Mac Catalyst support.

## Validate everything

From the repository root:

```bash
./scripts/validate.sh
```

This validates the complete web app, builds its production bundle, and builds
the mobile overlay. GitHub CI runs the web and mobile checks independently so a
native integration failure cannot hide behind a successful web build.

## Deployment and data refresh

Pushes to `main` build and deploy the PWA through GitHub Pages, then invalidate
the production CloudFront distribution. The GitLab mirror contains an
equivalent Pages deployment. A scheduled GitHub workflow refreshes astronomy
data daily and redeploys only when the generated data changes.

The deployment inputs are intentionally rooted under `web/`; generated browser
reports, coverage output, native build products, and dependency directories are
not versioned.

## License

NightSeek is available under the [MIT License](LICENSE).
