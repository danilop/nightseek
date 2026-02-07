# NightSeek

An astronomy observation planning tool with both a **Web App** and **CLI**. Generate forecasts showing when planets, deep sky objects, comets, and other celestial targets are optimally positioned in the night sky.

## Web App

**Try it now**: https://danilop.github.io/nightseek/

The web app is a Progressive Web App (PWA) that works on desktop and mobile:
- **Offline Support**: Install as an app and use without internet
- **Interactive Sky Chart**: Visual representation of the night sky
- **Object Search**: Find any celestial object by name, common name, or catalog code (M31, Monkey Head Nebula, NGC 2174, Jupiter, etc.)
- **Weather Integration**: Real-time cloud cover and observing conditions
- **Drag & Drop**: Reorder categories to personalize your view

## CLI Tool

For terminal users who prefer command-line tools.

### Quickstart

### 1. Install uv

[uv](https://docs.astral.sh/uv/) is a fast Python package installer and resolver. Install it with:

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### 2. Install NightSeek

```bash
uv tool install git+https://github.com/danilop/nightseek#subdirectory=cli
```

### 3. Configure your location

Run the interactive setup on first use:

```bash
nightseek --setup
```

The setup will:
1. **Auto-detect your location** from IP address (if available)
2. Let you enter an address (e.g., "London, UK")
3. Let you enter coordinates manually (latitude/longitude)

You can confirm the auto-detected location or choose another method.

### 4. Generate your forecast

```bash
nightseek              # 7-day forecast (default)
nightseek -d 3         # 3-day forecast
nightseek -d 14        # 14-day forecast
nightseek -n 10        # Show top 10 objects per night
```

## Features

### Core Features
- **~13,000 Deep Sky Objects**: Full OpenNGC catalog (NGC/IC objects) with intelligent filtering
- **Professional Scoring**: Merit-based 200-point scoring algorithm for optimal target selection
- **Weather-Integrated Forecasts**: Cloud cover, visibility, wind, humidity, precipitation from Open-Meteo API
- **Air Quality Integration**: Aerosol optical depth (AOD), dust, PM2.5/PM10 from Open-Meteo Air Quality API
- **Smart Night Ranking**: Combines moon phase AND weather conditions for optimal observing nights
- **Airmass Calculations**: Scientifically accurate atmospheric extinction modeling

### Object Tracking
- **Planets**: All major planets with apparent diameter tracking (current size vs. yearly range)
- **Comets**: Automatic detection from Minor Planet Center with apparent magnitude calculation
- **Dwarf Planets**: Pluto, Ceres, Eris, Makemake, Haumea
- **Asteroids**: Bright asteroids (Vesta, Pallas, Juno, Hygiea)
- **Interstellar Objects**: Highlights rare visitors like 2I/Borisov

### Observation Planning
- **Optimal Altitude Tracking**: Shows when objects reach 45°+ for best imaging conditions
- **Conjunction Alerts**: Automatic detection of close approaches between planets/Moon
- **5-Tier Weather Rating**: Excellent/Good/Fair/Poor/Bad with cloud percentage ranges
- **Best Observing Time**: Hourly analysis to find optimal conditions (lowest cloud + precipitation)
- **Position Angle**: DSO orientation for composition planning
- **Transit Times**: When objects cross the meridian (optimal viewing)
- **Transparency Score**: Combined visibility, cloud cover, and aerosol assessment
- **Dew Risk Warnings**: Based on temperature-dewpoint margin (not just humidity)
- **Storm Alerts**: CAPE-based atmospheric instability warnings

### Quality of Life
- **Tonight's Highlights**: Top objects prioritized by imaging quality score
- **Time-Window Grouping**: Objects grouped by weather conditions, not fixed intervals
- **Moon Interference Warnings**: Alerts when bright moon affects deep sky visibility
- **Graceful Degradation**: Works with or without weather/comet data
- **IP-Based Location**: Auto-detects your location during setup (optional)
- **Auto-Updates**: Automatically checks for updates once per day and installs them after showing your forecast

## Development Setup

NightSeek has two components, each in its own directory:
- **CLI (Python)**: `cli/` — managed with [uv](https://docs.astral.sh/uv/)
- **Web App (TypeScript/React)**: `web/` — managed with [pnpm](https://pnpm.io/)

### Clone the Repository

```bash
git clone https://github.com/danilop/nightseek.git
cd nightseek
```

### CLI Development (Python + uv)

```bash
# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Navigate to CLI directory
cd cli

# Install dependencies
uv sync

# Run from source
uv run nightseek

# Run tests
uv run pytest

# Search for objects
uv run nightseek --search "M31"
```

### Web App Development (TypeScript + pnpm)

```bash
# Install pnpm (if not already installed)
npm install -g pnpm

# Navigate to web directory
cd web

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

The web app is built with:
- **React 19** + **TypeScript**
- **Vite** for fast builds
- **Tailwind CSS** for styling
- **astronomy-engine** for calculations
- **Vitest** for testing

### Code Quality Checks

Both CLI and Web use equivalent static analysis tools. Run all checks with:

```bash
./precommit.sh
```

| Check | Python CLI | TypeScript Web |
|-------|------------|----------------|
| **Lint** | ruff | Biome |
| **Format** | ruff format | Biome format |
| **Type Check** | ty | tsc |
| **Dead Code** | vulture | knip |
| **Tests** | pytest | vitest |

The pre-commit hook runs automatically before each commit.

## Configuration

NightSeek stores your location in a platform-specific config directory:
- **Windows**: `%APPDATA%\nightseek\config`
- **macOS**: `~/Library/Application Support/nightseek/config`
- **Linux**: `~/.config/nightseek/config`

The easiest way to set this up is with the interactive setup:

```bash
nightseek --setup
```

You can also manually edit the config file:

```bash
# Location coordinates (required)
LATITUDE=51.4536
LONGITUDE=-0.1919

# Default forecast days (optional, defaults to 7)
FORECAST_DAYS=7

# Maximum objects to show per night (optional, defaults to 8)
MAX_OBJECTS=8
```

### For Development

When developing NightSeek, use CLI parameters to test with different locations:

```bash
cd cli
uv run nightseek -lat 40.7128 -lon -74.0060 -d 3
```

## Usage

### Basic Usage

Generate a forecast using your saved location:

```bash
nightseek
```

### Override Location

Specify a custom location via CLI parameters:

```bash
nightseek --latitude 40.7128 --longitude -74.0060
# Or use short flags:
nightseek -lat 40.7128 -lon -74.0060
```

### Custom Forecast Period

Change the number of forecast days (1-30):

```bash
nightseek --days 3
# Or use short flag:
nightseek -d 3
```

### Limit Objects Shown

Change the maximum objects displayed per night (1-50, default 8):

```bash
nightseek --max-objects 10
# Or use short flag:
nightseek -n 10
```

### Comet Magnitude Filter

Limit comets by brightness for faster results:

```bash
nightseek --comet-mag 8    # Only comets brighter than magnitude 8 (binocular visible)
nightseek --comet-mag 6    # Only naked-eye comets
# Or use short flag:
nightseek -cm 8
```

Lower magnitude = brighter = fewer comets = faster forecast.

### Combined Parameters

```bash
nightseek -lat 34.0522 -lon -118.2437 -d 14 -n 10 -cm 8
```

### Reconfigure Location

Run the interactive setup again to change your location:

```bash
nightseek --setup
```

### Search for Objects

Find any celestial object and check its visibility:

```bash
nightseek --search "M31"           # Andromeda Galaxy
nightseek --search "Jupiter"       # Planet
nightseek --search "Orion"         # Orion Nebula
nightseek -s "NGC 7000"            # North America Nebula
nightseek -s "Monkey Head"         # Search by common name
nightseek -s "12P"                 # Comet by designation
```

The search shows:
- Current visibility status (visible tonight or next visible date)
- Peak altitude and optimal viewing time
- When object reaches 45°+ altitude (optimal for imaging)
- Moon distance to assess interference

### Help

```bash
nightseek --help
```

## Updates

### Manual Update

Force check and install updates immediately:

```bash
nightseek --update
# or
nightseek -u
```

### Auto-Updates

NightSeek also checks automatically in the background:

- **Automatic checks**: Once per day (24-hour cache)
- **Non-intrusive**: Your forecast displays immediately, update happens after
- **Transparent**: Shows a message when updating
- **Zero configuration**: Works automatically, no action needed

**What you'll see:**
```
[your forecast output]
...

ℹ️  Update available. Installing latest version...
✓ Updated successfully. Changes apply on next run.
```

Updates are installed using `uv tool install --force --reinstall git+...#subdirectory=cli` and apply the next time you run `nightseek`.

## Output Format

The forecast includes:

1. **Observing Conditions**:
   - Dark sky window (astronomical night: sun >18° below horizon)
   - Moon phases and illumination percentage
   - Cloud cover range (min-max) during astronomical night
   - Best observing time (hour with lowest cloud + precipitation probability)
   - Wind speed, visibility, humidity, dew risk warnings when relevant
   - Atmospheric stability (pressure) and storm risk (CAPE)
   - Air quality: AOD, dust levels, transparency score
   - Combined quality ratings (Excellent/Good/Fair/Poor)

2. **Celestial Events**: Conjunction alerts when planets/Moon are close together

3. **Best Observing Nights**: Optimal nights ranked by moon + weather conditions

4. **Tonight's Observation Plan**:
   - Time windows grouped by weather conditions (dynamic, not fixed intervals)
   - Top objects with professional scores (0-200 scale)
   - Score explanations ("Why: excellent altitude, dark sky, peak season")
   - Planet apparent sizes with context (current vs. yearly range)

5. **Multi-Night Forecast**:
   - Best targets for each upcoming night
   - Category icons for quick identification
   - Quality ratings and peak times

6. **Milky Way Core**: Best viewing opportunity (when moon <30%)

### Weather Integration

- **Days 1-16**: Full weather integration with:
  - Hourly cloud cover (total + low/mid/high layers)
  - Best observing time per night (lowest cloud + precipitation)
  - Atmospheric visibility (transparency score)
  - Wind speed and gusts
  - Humidity and dew point (dew risk calculation)
  - Temperature and pressure (atmospheric stability)
  - Precipitation probability (min-max range)
  - CAPE (storm potential indicator)
- **Days 1-5**: Additional air quality data:
  - Aerosol Optical Depth (AOD) - atmospheric haze
  - Dust concentration (Saharan dust events)
  - PM2.5 and PM10 particulate matter
- **Days 17-30**: Astronomical data only (moon, object positions)
- **APIs**: Uses Open-Meteo Weather + Air Quality APIs (free, no API key required)

### Scoring System

NightSeek uses a professional 200-point scoring algorithm:

#### Imaging Quality (0-100 points)
| Component | Points | Factors |
|-----------|--------|---------|
| Airmass/Altitude | 0-40 | Uses Pickering formula; lower airmass = better |
| Moon Interference | 0-30 | Separation + illumination + object type sensitivity |
| Peak Timing | 0-15 | Is object at peak during observation window? |
| Weather | 0-15 | Cloud cover for this time slot |

#### Object Characteristics (0-50 points)
| Component | Points | Factors |
|-----------|--------|---------|
| Surface Brightness | 0-20 | Brighter surface = easier to image |
| Magnitude | 0-15 | Apparent brightness |
| Type Suitability | 0-15 | Match object type to conditions |

#### Priority/Rarity (0-50 points)
| Component | Points | Factors |
|-----------|--------|---------|
| Transient Events | 0-25 | Interstellar objects, bright comets |
| Seasonal Window | 0-15 | Object opposite sun = peak season |
| Popularity | 0-10 | Messier/famous objects bonus |

#### Score Tiers
| Score | Rating | Meaning |
|-------|--------|---------|
| 150+ | ★★★★★ | Prime target - don't miss |
| 120-149 | ★★★★☆ | High-quality opportunity |
| 90-119 | ★★★☆☆ | Worth imaging |
| 60-89 | ★★☆☆☆ | Acceptable, not optimal |
| <60 | ★☆☆☆☆ | Wait for better conditions |

### Weather Quality Tiers

| Cloud Cover | Rating | Color |
|-------------|--------|-------|
| 0-10% | Excellent | Green |
| 10-25% | Good | Green |
| 25-40% | Fair | Yellow |
| 40-60% | Poor | Yellow |
| 60%+ | Cloudy | Red |

### Altitude/Airmass Quality

| Airmass | Altitude | Rating |
|---------|----------|--------|
| ≤1.05 | ~90° | Excellent (overhead) |
| ≤1.15 | ~75° | Very Good (high) |
| ≤1.41 | ~45° | Good (clear) |
| ≤2.0 | ~30° | Acceptable |
| >2.0 | <30° | Poor (thick atmosphere) |

## Object Catalog

### Planets
All major planets (Mercury through Neptune) with:
- Current apparent diameter in arcseconds
- Yearly min/max range for context
- Subtype classification (inner/outer)

### Comets
- **Automatically loaded** from Minor Planet Center
- Includes all comets brighter than magnitude 12 (configurable)
- **Apparent magnitude** calculated from distance (not absolute magnitude)
- **Interstellar objects** marked with special highlight
- Updates automatically with each run (24-hour cache)

### Deep Sky Objects (~13,000)
Loaded from **OpenNGC** catalog with intelligent filtering:
- **Galaxies**: NGC/IC galaxies, pairs, groups, clusters
- **Nebulae**: Emission, reflection, planetary, supernova remnants
- **Clusters**: Open clusters, globular clusters
- **Position Angle**: Orientation for composition planning
- **Surface Brightness**: For imaging difficulty assessment

#### Notable Objects
- Messier catalog (M1-M110) with priority bonus
- Caldwell catalog objects
- Famous named objects (Andromeda, Orion Nebula, etc.)

### Dwarf Planets
- Pluto, Ceres, Eris, Makemake, Haumea
- Loaded from MPC orbital elements

### Asteroids
- Vesta, Pallas, Juno, Hygiea
- Brightness-filtered from MPC data

### Special Targets
- **Milky Way Core**: Sagittarius A* region
- **Conjunctions**: Automatically detected close approaches

## Technical Details

### Astronomical Calculations
- Uses [Skyfield](https://rhodesmill.org/skyfield/) for precise ephemeris calculations
- JPL DE421 ephemeris for planet positions
- **Airmass**: Pickering (2002) formula for accurate atmospheric extinction
- **Planet Sizes**: Calculated from distance using physical diameters
- Astronomical twilight threshold (sun >18° below horizon)
- 10-minute sampling resolution for altitude calculations

### Weather Forecasting
- Uses [Open-Meteo Weather API](https://open-meteo.com/) for comprehensive 16-day forecast:
  - Cloud cover (total + low/mid/high layers, hourly)
  - Visibility (atmospheric transparency)
  - Wind speed and gusts
  - Temperature and dew point (dew risk margin)
  - Relative humidity
  - Surface pressure (atmospheric stability)
  - Precipitation probability
  - CAPE (Convective Available Potential Energy)
- Uses [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) for 5-day forecast:
  - Aerosol Optical Depth (AOD) at 550nm
  - Dust concentration (μg/m³)
  - PM2.5 and PM10 particulate matter
- **Transparency Score**: Combined visibility + cloud + AOD assessment
- **Best Time Calculation**: Hourly analysis to find lowest cloud + precipitation
- Combines moon illumination (30%) and cloud cover (70%) for quality scoring
- No API key required, completely free

### Comet Tracking
- Uses [Minor Planet Center](https://www.minorplanetcenter.net/) orbital elements database
- **Apparent magnitude** calculated using: `m = g + 5*log10(Δ) + k*log10(r)`
  - g = absolute magnitude
  - Δ = distance from Earth (AU)
  - r = distance from Sun (AU)
  - k = magnitude slope parameter
- Pre-filters by declination to skip objects that can't reach useful altitude
- Detects interstellar objects (eccentricity >1.0 = hyperbolic orbits)
- Caches orbital elements locally (24-hour expiry)

### OpenNGC Integration
- Full [OpenNGC](https://github.com/mattiaverga/OpenNGC) catalog (~13,000 objects)
- **Common names**: Searchable by popular names (Monkey Head Nebula, Rosette, etc.)
- Cached locally (7-day expiry)
- Filtered by:
  - Maximum magnitude (default: 14)
  - Observer latitude (only objects that can reach useful altitude)
  - Object type (excludes non-existent and duplicate entries)

### Caching
Unified caching system for all external data:
- **Ephemeris**: Permanent (~17MB, downloaded once)
- **OpenNGC**: 7-day expiry (~4MB)
- **Comets**: 24-hour expiry
- Cache location: Platform-specific cache directory

### Performance
- First run downloads ~17MB ephemeris data (cached permanently)
- OpenNGC catalog cached for 7 days
- Comet orbital elements cached for 24 hours
- Typical forecast times:
  - 1-day forecast: ~10-15 seconds
  - 7-day forecast: ~45-60 seconds
- Use `--comet-mag 8` for faster results (fewer comets to track)

### Conjunction Detection
Automatically detects when objects are close together:
- Planet-planet conjunctions
- Planet-Moon conjunctions
- Threshold: Notable if <5°, highlighted if <2°

## Project Structure

```
nightseek/
├── README.md           # This file
├── LICENSE             # MIT License
├── precommit.sh        # Unified code quality checks
├── cli/                # Python CLI tool
│   ├── main.py         # CLI entry point
│   ├── config.py       # Configuration management
│   ├── sky_calculator.py   # Astronomical calculations
│   ├── catalog.py      # Celestial object catalog
│   ├── opengc_loader.py    # OpenNGC catalog integration
│   ├── analyzer.py     # Visibility analysis engine
│   ├── search.py       # Object search functionality
│   ├── scoring.py      # Scoring algorithm
│   ├── weather.py      # Weather forecast integration
│   ├── formatter.py    # Output formatting
│   ├── pyproject.toml  # Python dependencies (uv)
│   └── uv.lock         # Locked Python dependencies
├── web/                # Web application
│   ├── src/            # React/TypeScript source
│   ├── package.json    # Node dependencies (pnpm)
│   ├── pnpm-lock.yaml  # Locked Node dependencies
│   └── vite.config.ts  # Vite configuration
└── .github/workflows/  # CI/CD
    └── deploy.yml      # GitHub Pages deployment
```

## Requirements

- Python 3.11+
- Dependencies managed via uv (see `cli/pyproject.toml`)
- Key dependencies:
  - skyfield (astronomical calculations)
  - pandas (orbital elements parsing)
  - rich (terminal formatting)
  - typer (CLI framework)
  - requests (API calls)
  - timezonefinder (automatic timezone detection)
  - platformdirs (cross-platform directories)

## License

MIT License
