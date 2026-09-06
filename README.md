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
- A session shortlist, a device-local target watchlist, and calendar export
- Optional red night vision and screen wake lock on supported browsers

NightSeek is installable as a PWA. Its cached app shell works offline; catalogue
availability depends on previously cached or bundled data. Fresh weather requires
a connection.
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

The overlay works through Vite path aliases and therefore only intercepts
`@/`-prefixed imports. Any module listed as an override in
`mobile/vite.config.ts` must be imported as `@/...` everywhere in `web/src`; a
relative import silently bypasses the override and loads the web version
instead.

## Forecast architecture

`web/src/lib/forecast/client.ts` owns a cancellable module worker. The analyzer
publishes each completed night, so the first forecast becomes usable while the
remaining nights run in the background. Superseded requests terminate their
worker. Date and Map values use structured cloning. The non-worker fallback
uses the same analyzer; heavy sky-map libraries remain lazy loaded.

`AppContext.shared.tsx` holds the common state and persistence logic. The mobile
provider adds native notification and reset behavior around that same context.
Historical daily cloud statistics load only when expanded. The independent NOAA
Kp outlook loads after the overview renders and distinguishes predicted periods
from past observations.

Use Node 24 or newer for both projects. Dependency overrides are intentional:
web esbuild excludes the vulnerable development-server release; mobile xcode uses
uuid 11, a compatible CommonJS line for its `require('uuid').v4`
call. Revisit these overrides when their parent packages update.

Weather quality, seeing proxies, target scores, satellite brightness, mosaic
conditions and aurora guidance are planning estimates. They are not measurements
or guarantees. Open-Meteo's free hosted service is restricted to non-commercial
use; see its [terms](https://open-meteo.com/en/terms). NOAA's public Kp feed needs
no key, and does not establish whether an aurora is visible at a specific site.

Target-size preference uses both catalogue axes relative to the selected field
of view. Its bonus increases until the target spans both frame dimensions, then
plateaus; larger targets retain the bonus and show crop/mosaic needs separately.
This expresses a preference for substantial subjects, not a detection limit.
Displayed frame area estimates the catalogue ellipse relative to the rectangular
frame; it can exceed 100% and does not measure how much of a cropped target is
visible. Brightness, altitude, Moon and imaging conditions still affect ranking.

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
pnpm --dir web install --frozen-lockfile
npm --prefix mobile ci
npm --prefix mobile run sync-deps  # Run after shared web dependencies change
npm --prefix mobile run sync       # Build and synchronize the Capacitor project
npm --prefix mobile run open       # Open the Xcode workspace
```

The native wrapper adds local notifications, native location permissions,
sharing, haptics, bundled sky-chart assets, and Mac Catalyst support. Both
dependency installs are required because shared files remain physically rooted
under `web/src`, and TypeScript resolves their imports through `web/node_modules`.

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
the production CloudFront distribution. A scheduled GitHub workflow refreshes
astronomy data daily and redeploys only when the generated data changes.

The deployment inputs are intentionally rooted under `web/`; generated browser
reports, coverage output, native build products, and dependency directories are
not versioned.

## License

NightSeek is available under the [MIT License](LICENSE).

## Credits and attribution

Open **Settings → About & credits**, or select the NightSeek logo, for library
and data-source acknowledgements, source links, license notices and the existing
Buy Me a Coffee support link. The dialog is shared by web and native builds.

Human-readable credits live in `web/src/lib/about/credits.ts`. Vite generates
`THIRD_PARTY_LICENSES.md` for each production build; the web app precaches it
for offline access. `additional-notices.txt` preserves the exact-version notices
for Astronomy Engine and the separately loaded/bundled D3 sky chart. Update
those notices when upgrading those libraries. Data credits distinguish original
sources from NightSeek's derived estimates.

### Sky brightness data

NightSeek fetches one compressed 5° regional tile on demand from [David Lorenz’s
2025 Light Pollution Atlas](https://djlorenz.github.io/astronomy/lp/). No API key or
worldwide download is required. A checked European tile was 80 KB; sizes vary by
region. Resolution is 1/120° (roughly 1 km north–south). The last region is cached
locally for offline use (360 KB decoded); memory holds at most four regions.
Only the region identifier is sent to the provider, without credentials or a referrer.

The displayed decimal value is modeled zenith brightness in mag/arcsec², assuming
natural brightness of 22 mag/arcsec². Higher means darker. This is a moonless atlas
baseline, not tonight’s measurement and **not a Bortle class**. The atlas combines
NOAA VIIRS nighttime lights processed by EOG with atmospheric light propagation.
See the author’s [explanation of the distinction](https://djlorenz.github.io/astronomy/lp/bortle.html).
No dataset is redistributed with the app. Credits appear in About.

Missing data, failed requests and positions outside 65°S–75°N show unavailable;
they never receive a latitude-based guess. The Milky Way planner uses 20 mag/arcsec²
as a pragmatic contrast threshold, not a physical detectability limit or Bortle
conversion. Without data it retains candidate windows but does not claim skyglow
has been checked. Data loads independently of the forecast and retries on reconnection.
