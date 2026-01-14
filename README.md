# NightSeek

A Python CLI tool for planning astronomy observations based on celestial object visibility. Generate forecasts showing when planets, deep sky objects, and other celestial targets are optimally positioned in the night sky.

## Quickstart

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
uv tool install git+https://github.com/danilop/nightseek
```

### 3. Configure your location

Run the interactive setup on first use:

```bash
nightseek --setup
```

This will prompt you to enter your location either as an address (e.g., "London, UK") or as coordinates (latitude/longitude).

### 4. Generate your forecast

```bash
nightseek              # 7-day forecast (default)
nightseek -d 3         # 3-day forecast
nightseek -d 14        # 14-day forecast
nightseek -n 10        # Show top 10 objects per night
```

## Features

- **Weather-Integrated Forecasts**: Real-time cloud cover data from Open-Meteo API (up to 16 days)
- **Smart Night Ranking**: Combines moon phase AND cloud cover for optimal observing nights
- **Comet Tracking**: Automatic detection of bright comets (magnitude <12) from Minor Planet Center
- **Interstellar Object Alerts**: Highlights rare interstellar comets (like 3I/ATLAS)
- **7-Day Forecasts**: Plan your observations for up to 30 nights ahead
- **Altitude Thresholds**: Identifies when objects reach 45°, 60°, and 75° altitude for optimal viewing
- **Moon Phase Analysis**: Shows moon illumination and identifies best dark-sky nights for DSO imaging
- **Moon Interference Warnings**: Alerts when bright moon affects deep sky object visibility
- **Curated Object Catalog**: Notable Messier objects, planets, and the Milky Way core
- **Tonight's Highlights**: Top 8 objects prioritized by viewing quality
- **Graceful Degradation**: Works with or without weather data or comet data

## Development Setup

For contributors and developers who want to work on NightSeek:

```bash
# Clone the repository
git clone https://github.com/danilop/nightseek.git
cd nightseek

# Install dependencies
uv sync

# Run from source
uv run nightseek
```

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

### Help

```bash
nightseek --help
```

## Output Format

The forecast includes:

1. **Observing Conditions**:
   - Dark sky window (astronomical night: sun >18° below horizon)
   - Moon phases and illumination percentage
   - Cloud cover range (min-max) during astronomical night (if ≤16 days)
   - Combined quality ratings
2. **Best Observing Nights**: Optimal nights ranked by moon + cloud cover (or moon only if no weather data)
3. **Tonight's Observation Plan**: Time-windowed targets with weather conditions for each 3-hour window
4. **Forecast by Object Type**:
   - **Planets**: Best viewing times throughout the period
   - **Comets**: Currently visible comets (magnitude <12) with peak viewing times
     - Special highlight for interstellar objects with ⭐ marker
   - **Deep Sky Objects**: Top N objects (configurable, default 8) for the best 5 nights
   - **Milky Way Core**: Best viewing opportunity (when moon <30%)

### Weather Integration

- **Days 1-16**: Full weather integration with hourly cloud cover during astronomical night
- **Days 17-30**: Astronomical data only (moon, object positions) - gracefully degrades without weather
- **API**: Uses Open-Meteo (free, no API key required)

### Quality Ratings

#### Object Altitude (for Astrophotography)
- **Excellent (overhead)**: Object reaches 75°+ altitude
- **Very Good (high)**: Object reaches 60-74° altitude
- **Good (clear)**: Object reaches 45-59° altitude
- **Fair (low)**: Object reaches 30-44° altitude

#### Observing Night Quality (with weather data)
- **Excellent - Dark & Clear**: <20% combined score (moon + clouds)
- **Good - Clear skies**: <35% combined score, low clouds
- **Fair**: 35-55% combined score (moderate clouds or bright moon)
- **Poor - Very cloudy**: >55% combined score (high clouds or bright moon + clouds)

## Object Catalog

### Planets
All major planets (Mercury through Neptune)

### Comets
- **Automatically loaded** from Minor Planet Center
- Includes all comets brighter than magnitude 12 (telescope visibility)
- **Interstellar objects** marked with ⭐ (eccentricity >1.0)
- Examples of recent/current comets:
  - 24P/Schaumasse (mag ~8, January 2026)
  - C/2024 E1 (Wierzchos) (mag ~8, January 2026)
  - 3I/ATLAS (mag ~15, interstellar - 3rd ever detected!)
- Updates automatically with each run
- Gracefully handles network failures

### Deep Sky Objects
- **Galaxies**: M31 (Andromeda), M33, M51 (Whirlpool), M81, M82, M101, M104
- **Nebulae**: M42 (Orion), M8 (Lagoon), M16 (Eagle), M17 (Omega), M20 (Trifid), M27 (Dumbbell), M57 (Ring), Helix, North America
- **Clusters**: M13 (Hercules), M45 (Pleiades), M44 (Beehive), Double Cluster
- **Special**: Milky Way Core

## Technical Details

### Astronomical Calculations
- Uses [Skyfield](https://rhodesmill.org/skyfield/) for precise ephemeris calculations
- JPL DE421 ephemeris for planet positions
- Astronomical twilight threshold (sun >18° below horizon)
- 10-minute sampling resolution for altitude calculations

### Weather Forecasting
- Uses [Open-Meteo API](https://open-meteo.com/) for hourly cloud cover forecasts
- Automatically fetches weather for forecasts ≤16 days
- Calculates average and maximum cloud cover during astronomical night
- Combines moon illumination (30%) and cloud cover (70%) for quality scoring
- No API key required, completely free

### Comet Tracking
- Uses [Minor Planet Center](https://www.minorplanetcenter.net/) orbital elements database
- Default: loads comets with magnitude <12 (telescope-visible), configurable via `--comet-mag`
- Pre-filters by declination to skip comets that can't reach useful altitude from your location
- Computes positions using Skyfield and MPC orbital elements
- Detects interstellar objects (eccentricity >1.0 = hyperbolic orbits)
- Caches orbital elements locally (24-hour expiry) for faster startup
- Requires pandas library for MPC data parsing

### Performance
- First run downloads ~17MB ephemeris data (cached permanently)
- Comet orbital elements cached for 24 hours
- Typical forecast times:
  - 1-day forecast: ~10 seconds
  - 7-day forecast: ~45 seconds
- Use `--comet-mag 8` for faster results (fewer comets to track)

### Altitude Thresholds
The app reports three altitude tiers:
- **45°**: Minimum for good city viewing (reduces light pollution effects)
- **60°**: Optimal viewing angle
- **75°**: Excellent viewing conditions

### Moon Interference
DSOs are flagged with moon warnings when:
- Moon is >50% illuminated AND
- Object is within 30° of the moon

## Project Structure

```
nightseek/
├── main.py           # CLI entry point
├── config.py         # Configuration management
├── sky_calculator.py # Astronomical calculations
├── catalog.py        # Celestial object catalog
├── analyzer.py       # Visibility analysis engine
├── weather.py        # Weather forecast integration (Open-Meteo)
├── formatter.py      # Output formatting
├── timezone_utils.py # Timezone conversion utilities
├── pyproject.toml    # Project dependencies
└── LICENSE           # MIT License
```

## Requirements

- Python 3.11+
- Dependencies managed via uv (see `pyproject.toml`)
- Key dependencies:
  - skyfield (astronomical calculations)
  - pandas (comet orbital elements parsing)
  - rich (terminal formatting)
  - typer (CLI framework)
  - requests (API calls)
  - timezonefinder (automatic timezone detection)

## License

MIT License
