# NightSeek PWA - Technical Implementation Plan

## Executive Summary

This document outlines the complete technical implementation plan for converting NightSeek from a Python CLI application to a TypeScript Progressive Web Application (PWA). The PWA will preserve 100% of the original functionality while providing a responsive interface for desktop and mobile devices.

---

## 1. Technology Stack

### Core Framework
| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **TypeScript 5.x** | Language | Type safety, IDE support, maintainability |
| **Vite 5.x** | Build tool | Fast HMR, ESM-native, excellent PWA plugin |
| **React 18.x** | UI framework | Component-based, large ecosystem, hooks |
| **Tailwind CSS 3.x** | Styling | Utility-first, responsive design, small bundle |

### Key Libraries
| Library | Purpose | Replaces Python |
|---------|---------|-----------------|
| **astronomy-engine** | Astronomical calculations | skyfield |
| **date-fns** | Date/time handling | datetime |
| **date-fns-tz** | Timezone conversions | timezonefinder |
| **idb-keyval** | IndexedDB wrapper | file-based cache |
| **vite-plugin-pwa** | PWA/Service Worker | N/A |
| **lucide-react** | Icons | Rich emoji/icons |

### PWA Features
- **Service Worker**: Workbox for caching strategies
- **Manifest**: Install prompts, icons, theme colors
- **Offline Support**: Cache-first for static, network-first for APIs
- **Background Sync**: Queue weather requests when offline

---

## 2. Project Structure

```
web/
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── icons/                  # App icons (192x192, 512x512)
│   ├── data/
│   │   └── meteor-showers.json # Static meteor shower data
│   └── sw.js                   # Service worker (generated)
├── src/
│   ├── main.tsx                # Entry point
│   ├── App.tsx                 # Root component
│   ├── index.css               # Tailwind imports
│   │
│   ├── types/                  # TypeScript interfaces
│   │   ├── index.ts            # Re-exports
│   │   ├── astronomy.ts        # NightInfo, ObjectVisibility, etc.
│   │   ├── weather.ts          # NightWeather, ClearWindow, etc.
│   │   ├── scoring.ts          # ScoredObject, ScoreBreakdown
│   │   ├── events.ts           # Conjunction, MeteorShower
│   │   └── config.ts           # Settings, Location
│   │
│   ├── lib/                    # Core logic (no React)
│   │   ├── astronomy/
│   │   │   ├── calculator.ts   # SkyCalculator class
│   │   │   ├── airmass.ts      # Pickering formula
│   │   │   ├── planets.ts      # Planet definitions & calculations
│   │   │   ├── comets.ts       # Comet magnitude calculations
│   │   │   └── milky-way.ts    # Galactic center tracking
│   │   │
│   │   ├── catalogs/
│   │   │   ├── opengc.ts       # OpenNGC loader & parser
│   │   │   ├── planets.ts      # Built-in planet data
│   │   │   ├── comets.ts       # MPC comet loader
│   │   │   ├── common-names.ts # NGC → Common name mapping
│   │   │   └── messier.ts      # Messier objects not in NGC
│   │   │
│   │   ├── scoring/
│   │   │   ├── index.ts        # Main scoring orchestrator
│   │   │   ├── imaging.ts      # Imaging quality (0-100)
│   │   │   ├── characteristics.ts # Object characteristics (0-50)
│   │   │   ├── priority.ts     # Priority/rarity bonus (0-50)
│   │   │   └── weather.ts      # Weather score calculation
│   │   │
│   │   ├── events/
│   │   │   ├── conjunctions.ts # Planet-planet, planet-moon
│   │   │   └── meteor-showers.ts # Shower detection & calculation
│   │   │
│   │   ├── weather/
│   │   │   ├── open-meteo.ts   # Weather API client
│   │   │   ├── air-quality.ts  # Air quality API client
│   │   │   └── analysis.ts     # Best time calculation
│   │   │
│   │   ├── geo/
│   │   │   ├── ip-location.ts  # IP-based geolocation
│   │   │   ├── nominatim.ts    # Address geocoding
│   │   │   └── timezone.ts     # Timezone detection
│   │   │
│   │   ├── analyzer.ts         # Main forecast analyzer
│   │   └── utils/
│   │       ├── cache.ts        # IndexedDB caching
│   │       ├── format.ts       # Time/number formatting
│   │       └── constants.ts    # Shared constants
│   │
│   ├── hooks/                  # React hooks
│   │   ├── useLocation.ts      # Location state & detection
│   │   ├── useForecast.ts      # Forecast fetching & caching
│   │   ├── useSettings.ts      # User preferences
│   │   └── useOffline.ts       # Offline detection
│   │
│   ├── components/             # React components
│   │   ├── layout/
│   │   │   ├── Header.tsx      # App header with settings
│   │   │   ├── Footer.tsx      # Attribution, version
│   │   │   └── Container.tsx   # Responsive container
│   │   │
│   │   ├── setup/
│   │   │   ├── LocationSetup.tsx    # Location wizard
│   │   │   ├── LocationDetect.tsx   # Auto-detect UI
│   │   │   ├── AddressSearch.tsx    # Address geocoding
│   │   │   └── CoordinateInput.tsx  # Manual lat/lon
│   │   │
│   │   ├── forecast/
│   │   │   ├── ForecastView.tsx     # Main forecast display
│   │   │   ├── HeaderPanel.tsx      # Date range, location
│   │   │   ├── NightSummary.tsx     # Moon & weather table
│   │   │   ├── TonightHighlights.tsx # Best objects tonight
│   │   │   ├── WeeklyForecast.tsx   # Multi-day breakdown
│   │   │   ├── ObjectCard.tsx       # Individual object display
│   │   │   └── ScoreBreakdown.tsx   # Detailed scoring popup
│   │   │
│   │   ├── objects/
│   │   │   ├── PlanetRow.tsx        # Planet display
│   │   │   ├── DSORow.tsx           # Deep sky object display
│   │   │   ├── CometRow.tsx         # Comet display
│   │   │   └── MilkyWayRow.tsx      # Milky Way visibility
│   │   │
│   │   ├── events/
│   │   │   ├── ConjunctionCard.tsx  # Conjunction display
│   │   │   └── MeteorShowerCard.tsx # Meteor shower display
│   │   │
│   │   ├── weather/
│   │   │   ├── WeatherBadge.tsx     # Cloud cover indicator
│   │   │   ├── MoonPhase.tsx        # Moon phase icon
│   │   │   └── StarRating.tsx       # 1-5 star rating
│   │   │
│   │   └── ui/                 # Reusable UI primitives
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Table.tsx
│   │       ├── Badge.tsx
│   │       ├── Progress.tsx
│   │       ├── Skeleton.tsx
│   │       ├── Modal.tsx
│   │       └── Tabs.tsx
│   │
│   ├── pages/
│   │   ├── Home.tsx            # Main forecast page
│   │   ├── Setup.tsx           # Location setup page
│   │   └── Settings.tsx        # App settings page
│   │
│   └── stores/                 # State management
│       ├── location.ts         # Location state (localStorage)
│       ├── settings.ts         # User preferences
│       └── forecast.ts         # Cached forecast data
│
├── index.html                  # HTML entry point
├── vite.config.ts              # Vite configuration
├── tailwind.config.js          # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies
└── README.md                   # Documentation
```

---

## 3. Data Models (TypeScript Interfaces)

### Core Astronomy Types

```typescript
// types/astronomy.ts

export interface NightInfo {
  date: Date;
  sunset: Date;
  sunrise: Date;
  astronomicalDusk: Date;
  astronomicalDawn: Date;
  moonPhase: number;           // 0-1 (0=new, 0.5=full)
  moonIllumination: number;    // 0-100%
  moonRise: Date | null;
  moonSet: Date | null;
}

export interface ObjectVisibility {
  objectName: string;
  objectType: ObjectCategory;
  isVisible: boolean;
  maxAltitude: number;
  maxAltitudeTime: Date | null;
  above45Start: Date | null;
  above45End: Date | null;
  above60Start: Date | null;
  above60End: Date | null;
  above75Start: Date | null;
  above75End: Date | null;
  moonSeparation: number | null;
  moonWarning: boolean;
  magnitude: number | null;
  isInterstellar: boolean;
  altitudeSamples: Array<[Date, number]>;
  subtype: DSOSubtype | null;
  angularSizeArcmin: number;
  surfaceBrightness: number | null;
  raHours: number;
  decDegrees: number;
  commonName: string;
  minAirmass: number;
  azimuthAtPeak: number;
  apparentDiameterArcsec: number | null;
  apparentDiameterMin: number | null;
  apparentDiameterMax: number | null;
  positionAngle: number | null;
}

export type ObjectCategory =
  | 'planet'
  | 'dso'
  | 'comet'
  | 'dwarf_planet'
  | 'asteroid'
  | 'milky_way'
  | 'moon';

export type DSOSubtype =
  | 'galaxy'
  | 'galaxy_pair'
  | 'galaxy_triplet'
  | 'galaxy_group'
  | 'emission_nebula'
  | 'reflection_nebula'
  | 'planetary_nebula'
  | 'supernova_remnant'
  | 'nebula'
  | 'hii_region'
  | 'open_cluster'
  | 'globular_cluster'
  | 'double_star'
  | 'asterism'
  | 'star_association'
  | 'dark_nebula'
  | 'other';

export interface NightForecast {
  nightInfo: NightInfo;
  planets: ObjectVisibility[];
  dsos: ObjectVisibility[];
  comets: ObjectVisibility[];
  dwarfPlanets: ObjectVisibility[];
  asteroids: ObjectVisibility[];
  milkyWay: ObjectVisibility;
  moon: ObjectVisibility;
  weather: NightWeather | null;
  conjunctions: Conjunction[];
  meteorShowers: MeteorShower[];
}
```

### Weather Types

```typescript
// types/weather.ts

export interface NightWeather {
  date: Date;
  avgCloudCover: number;
  minCloudCover: number;
  maxCloudCover: number;
  clearDurationHours: number;
  clearWindows: ClearWindow[];
  hourlyData: Map<number, number>;  // timestamp -> cloud cover

  avgVisibilityKm: number | null;
  avgWindSpeedKmh: number | null;
  maxWindSpeedKmh: number | null;
  avgHumidity: number | null;
  avgTemperatureC: number | null;
  transparencyScore: number | null;
  cloudCoverLow: number | null;
  cloudCoverMid: number | null;
  cloudCoverHigh: number | null;
  minPrecipProbability: number | null;
  maxPrecipProbability: number | null;
  totalPrecipitationMm: number | null;
  minDewMargin: number | null;
  dewRiskHours: number;
  avgPressureHpa: number | null;
  pressureTrend: 'rising' | 'falling' | 'steady' | null;
  maxCape: number | null;
  bestTime: BestObservingTime | null;
  avgAerosolOpticalDepth: number | null;
  avgPm25: number | null;
  avgPm10: number | null;
  avgDust: number | null;
}

export interface ClearWindow {
  start: Date;
  end: Date;
  avgCloudCover: number;
}

export interface BestObservingTime {
  start: Date;
  end: Date;
  score: number;
  reason: string;
}
```

### Scoring Types

```typescript
// types/scoring.ts

export interface ScoredObject {
  objectName: string;
  category: ObjectCategory;
  subtype: DSOSubtype | null;
  totalScore: number;          // 0-200 max
  scoreBreakdown: ScoreBreakdown;
  reason: string;
  visibility: ObjectVisibility;
  magnitude: number | null;
}

export interface ScoreBreakdown {
  // Imaging Quality (0-100)
  altitudeScore: number;       // 0-40
  moonInterference: number;    // 0-30
  peakTiming: number;          // 0-15
  weatherScore: number;        // 0-15

  // Object Characteristics (0-50)
  surfaceBrightness: number;   // 0-20
  magnitudeScore: number;      // 0-15
  typeSuitability: number;     // 0-15

  // Priority/Rarity (0-50)
  transientBonus: number;      // 0-25
  seasonalWindow: number;      // 0-15
  noveltyPopularity: number;   // 0-10
}

export type ScoreTier =
  | 'excellent'   // 150-200
  | 'very_good'   // 100-150
  | 'good'        // 75-100
  | 'fair'        // 40-75
  | 'poor';       // 0-40
```

### Event Types

```typescript
// types/events.ts

export interface Conjunction {
  object1Name: string;
  object2Name: string;
  separationDegrees: number;
  time: Date;
  description: string;
  isNotable: boolean;  // < 5°
}

export interface MeteorShower {
  name: string;
  code: string;
  peakMonth: number;
  peakDay: number;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  zhr: number;
  radiantRaDeg: number;
  radiantDecDeg: number;
  velocityKms: number;
  parentObject: string;

  // Calculated
  isActive: boolean;
  daysFromPeak: number | null;
  radiantAltitude: number | null;
  moonIllumination: number | null;
  moonSeparationDeg: number | null;
}
```

### Configuration Types

```typescript
// types/config.ts

export interface Location {
  latitude: number;
  longitude: number;
  name?: string;
  timezone?: string;
}

export interface Settings {
  forecastDays: number;        // 1-30, default 7
  maxObjects: number;          // 1-50, default 8
  cometMagnitude: number;      // default 12.0
  dsoMagnitude: number;        // default 14.0
  theme: 'light' | 'dark' | 'system';
  units: 'metric' | 'imperial';
}

export interface AppState {
  location: Location | null;
  settings: Settings;
  lastForecast: NightForecast[] | null;
  lastUpdate: Date | null;
}
```

---

## 4. Astronomical Calculations

### 4.1 Airmass Calculation (Pickering 2002)

```typescript
// lib/astronomy/airmass.ts

/**
 * Calculate airmass using Pickering (2002) formula
 * More accurate than secant formula, especially at low altitudes
 *
 * @param altitudeDeg - Altitude above horizon in degrees
 * @returns Airmass (1.0 at zenith, higher = more atmosphere)
 */
export function calculateAirmass(altitudeDeg: number): number {
  if (altitudeDeg <= 0) return Infinity;
  if (altitudeDeg >= 90) return 1.0;

  const h = altitudeDeg;
  const denominator = Math.sin(
    (h + 244 / (165 + 47 * Math.pow(h, 1.1))) * Math.PI / 180
  );

  return 1 / denominator;
}
```

### 4.2 Comet Apparent Magnitude

```typescript
// lib/astronomy/comets.ts

/**
 * Calculate comet apparent magnitude
 *
 * @param absoluteMag - Absolute magnitude (g)
 * @param earthDistanceAU - Distance from Earth in AU (Δ)
 * @param sunDistanceAU - Distance from Sun in AU (r)
 * @param slopeParam - Magnitude slope parameter (k), default 10
 * @returns Apparent magnitude
 */
export function calculateCometMagnitude(
  absoluteMag: number,
  earthDistanceAU: number,
  sunDistanceAU: number,
  slopeParam: number = 10
): number {
  if (earthDistanceAU <= 0 || sunDistanceAU <= 0) return 99.0;

  return (
    absoluteMag +
    5 * Math.log10(earthDistanceAU) +
    slopeParam * Math.log10(sunDistanceAU)
  );
}
```

### 4.3 Planet Apparent Diameter

```typescript
// lib/astronomy/planets.ts

// Physical diameters in km
export const PLANET_DIAMETERS: Record<string, number> = {
  mercury: 4879,
  venus: 12104,
  mars: 6779,
  jupiter: 139820,
  saturn: 116460,
  uranus: 50724,
  neptune: 49244,
};

// Historical min/max apparent diameters in arcseconds
export const PLANET_DIAMETER_RANGES: Record<string, [number, number]> = {
  mercury: [4.5, 13.0],
  venus: [9.7, 66.0],
  mars: [3.5, 25.1],
  jupiter: [29.8, 50.1],
  saturn: [14.5, 20.1],
  uranus: [3.3, 4.1],
  neptune: [2.2, 2.4],
};

/**
 * Calculate planet apparent diameter
 *
 * @param planetName - Planet name (lowercase)
 * @param distanceKm - Distance from Earth in km
 * @returns Apparent diameter in arcseconds
 */
export function calculateApparentDiameter(
  planetName: string,
  distanceKm: number
): number {
  const physicalDiameter = PLANET_DIAMETERS[planetName];
  if (!physicalDiameter || distanceKm <= 0) return 0;

  const angularDiameterRad = physicalDiameter / distanceKm;
  return angularDiameterRad * 206265; // Convert to arcseconds
}
```

### 4.4 Angular Separation

```typescript
// lib/astronomy/calculator.ts

/**
 * Calculate angular separation between two celestial objects
 * Uses Vincenty formula for accuracy
 *
 * @param ra1, dec1 - First object (degrees)
 * @param ra2, dec2 - Second object (degrees)
 * @returns Separation in degrees
 */
export function angularSeparation(
  ra1: number, dec1: number,
  ra2: number, dec2: number
): number {
  const toRad = Math.PI / 180;

  const ra1Rad = ra1 * toRad;
  const dec1Rad = dec1 * toRad;
  const ra2Rad = ra2 * toRad;
  const dec2Rad = dec2 * toRad;

  const deltaRa = Math.abs(ra1Rad - ra2Rad);

  const numerator = Math.sqrt(
    Math.pow(Math.cos(dec2Rad) * Math.sin(deltaRa), 2) +
    Math.pow(
      Math.cos(dec1Rad) * Math.sin(dec2Rad) -
      Math.sin(dec1Rad) * Math.cos(dec2Rad) * Math.cos(deltaRa),
      2
    )
  );

  const denominator =
    Math.sin(dec1Rad) * Math.sin(dec2Rad) +
    Math.cos(dec1Rad) * Math.cos(dec2Rad) * Math.cos(deltaRa);

  return Math.atan2(numerator, denominator) / toRad;
}
```

### 4.5 Using astronomy-engine Library

The `astronomy-engine` library provides:
- Planet positions (RA/Dec, altitude/azimuth)
- Moon phase and illumination
- Sunrise/sunset and twilight times
- Comet/asteroid positions from orbital elements

```typescript
// lib/astronomy/calculator.ts

import * as Astronomy from 'astronomy-engine';

export class SkyCalculator {
  private observer: Astronomy.Observer;

  constructor(latitude: number, longitude: number, elevation: number = 0) {
    this.observer = new Astronomy.Observer(latitude, longitude, elevation);
  }

  /**
   * Get night information for a given date
   */
  getNightInfo(date: Date): NightInfo {
    const sunset = Astronomy.SearchRiseSet(
      Astronomy.Body.Sun, this.observer, -1, date, 1
    );

    const sunrise = Astronomy.SearchRiseSet(
      Astronomy.Body.Sun, this.observer, +1, date, 1
    );

    // Astronomical twilight: Sun at -18°
    const dusk = Astronomy.SearchAltitude(
      Astronomy.Body.Sun, this.observer, -1, date, 1, -18
    );

    const dawn = Astronomy.SearchAltitude(
      Astronomy.Body.Sun, this.observer, +1, date, 1, -18
    );

    const moonIllum = Astronomy.Illumination(Astronomy.Body.Moon, date);

    return {
      date,
      sunset: sunset?.date ?? date,
      sunrise: sunrise?.date ?? date,
      astronomicalDusk: dusk?.date ?? date,
      astronomicalDawn: dawn?.date ?? date,
      moonPhase: moonIllum.phase_angle / 180, // Normalize to 0-1
      moonIllumination: moonIllum.phase_fraction * 100,
      moonRise: Astronomy.SearchRiseSet(
        Astronomy.Body.Moon, this.observer, +1, date, 1
      )?.date ?? null,
      moonSet: Astronomy.SearchRiseSet(
        Astronomy.Body.Moon, this.observer, -1, date, 1
      )?.date ?? null,
    };
  }

  /**
   * Calculate object visibility throughout the night
   */
  calculateVisibility(
    ra: number,      // hours
    dec: number,     // degrees
    nightInfo: NightInfo,
    objectName: string,
    objectType: ObjectCategory
  ): ObjectVisibility {
    const samples: Array<[Date, number]> = [];
    let maxAltitude = -90;
    let maxAltitudeTime: Date | null = null;

    // Sample every 10 minutes from dusk to dawn
    const startTime = nightInfo.astronomicalDusk.getTime();
    const endTime = nightInfo.astronomicalDawn.getTime();
    const interval = 10 * 60 * 1000; // 10 minutes

    for (let t = startTime; t <= endTime; t += interval) {
      const time = new Date(t);
      const { altitude, azimuth } = this.getAltAz(ra, dec, time);

      samples.push([time, altitude]);

      if (altitude > maxAltitude) {
        maxAltitude = altitude;
        maxAltitudeTime = time;
      }
    }

    // Find altitude threshold windows
    const above45 = this.findAltitudeWindow(samples, 45);
    const above60 = this.findAltitudeWindow(samples, 60);
    const above75 = this.findAltitudeWindow(samples, 75);

    // Calculate moon separation at peak
    const moonSeparation = maxAltitudeTime
      ? this.getMoonSeparation(ra, dec, maxAltitudeTime)
      : null;

    return {
      objectName,
      objectType,
      isVisible: maxAltitude >= 30,
      maxAltitude,
      maxAltitudeTime,
      above45Start: above45?.[0] ?? null,
      above45End: above45?.[1] ?? null,
      above60Start: above60?.[0] ?? null,
      above60End: above60?.[1] ?? null,
      above75Start: above75?.[0] ?? null,
      above75End: above75?.[1] ?? null,
      moonSeparation,
      moonWarning: moonSeparation !== null && moonSeparation < 30,
      altitudeSamples: samples,
      minAirmass: maxAltitude > 0 ? calculateAirmass(maxAltitude) : Infinity,
      azimuthAtPeak: maxAltitudeTime
        ? this.getAltAz(ra, dec, maxAltitudeTime).azimuth
        : 0,
      // Other fields filled by caller
      magnitude: null,
      isInterstellar: false,
      subtype: null,
      angularSizeArcmin: 0,
      surfaceBrightness: null,
      raHours: ra,
      decDegrees: dec,
      commonName: objectName,
      apparentDiameterArcsec: null,
      apparentDiameterMin: null,
      apparentDiameterMax: null,
      positionAngle: null,
    };
  }

  private getAltAz(raHours: number, decDeg: number, time: Date): {
    altitude: number;
    azimuth: number;
  } {
    const equator = new Astronomy.EquatorialCoordinates(
      raHours, decDeg, 1000 // distance doesn't matter for alt/az
    );

    const horizon = Astronomy.Horizon(
      time, this.observer, raHours * 15, decDeg, 'normal'
    );

    return {
      altitude: horizon.altitude,
      azimuth: horizon.azimuth,
    };
  }

  private getMoonSeparation(raHours: number, decDeg: number, time: Date): number {
    const moonEquator = Astronomy.Equator(
      Astronomy.Body.Moon, time, this.observer, true, true
    );

    return angularSeparation(
      raHours * 15, decDeg,
      moonEquator.ra * 15, moonEquator.dec
    );
  }

  private findAltitudeWindow(
    samples: Array<[Date, number]>,
    threshold: number
  ): [Date, Date] | null {
    let start: Date | null = null;
    let end: Date | null = null;

    for (const [time, alt] of samples) {
      if (alt >= threshold) {
        if (!start) start = time;
        end = time;
      }
    }

    return start && end ? [start, end] : null;
  }
}
```

---

## 5. API Services

### 5.1 Open-Meteo Weather API

```typescript
// lib/weather/open-meteo.ts

const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface WeatherAPIResponse {
  hourly: {
    time: string[];
    cloud_cover: number[];
    cloud_cover_low: number[];
    cloud_cover_mid: number[];
    cloud_cover_high: number[];
    visibility: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    relative_humidity_2m: number[];
    temperature_2m: number[];
    dew_point_2m: number[];
    precipitation_probability: number[];
    precipitation: number[];
    pressure_msl: number[];
    cape: number[];
  };
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
  forecastDays: number
): Promise<WeatherAPIResponse> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    hourly: [
      'cloud_cover',
      'cloud_cover_low',
      'cloud_cover_mid',
      'cloud_cover_high',
      'visibility',
      'wind_speed_10m',
      'wind_gusts_10m',
      'relative_humidity_2m',
      'temperature_2m',
      'dew_point_2m',
      'precipitation_probability',
      'precipitation',
      'pressure_msl',
      'cape',
    ].join(','),
    forecast_days: Math.min(forecastDays, 16).toString(),
    timezone: 'auto',
  });

  const response = await fetch(`${WEATHER_API_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  return response.json();
}
```

### 5.2 Air Quality API

```typescript
// lib/weather/air-quality.ts

const AIR_QUALITY_API_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

interface AirQualityAPIResponse {
  hourly: {
    time: string[];
    pm2_5: number[];
    pm10: number[];
    aerosol_optical_depth: number[];
    dust: number[];
  };
}

export async function fetchAirQuality(
  latitude: number,
  longitude: number,
  forecastDays: number
): Promise<AirQualityAPIResponse> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    hourly: 'pm2_5,pm10,aerosol_optical_depth,dust',
    forecast_days: Math.min(forecastDays, 5).toString(),
    timezone: 'auto',
  });

  const response = await fetch(`${AIR_QUALITY_API_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Air Quality API error: ${response.status}`);
  }

  return response.json();
}
```

### 5.3 Geolocation Services

```typescript
// lib/geo/ip-location.ts

interface IPLocationResponse {
  status: string;
  lat: number;
  lon: number;
  city: string;
  country: string;
  timezone: string;
}

export async function detectLocationByIP(): Promise<Location | null> {
  try {
    const response = await fetch(
      'http://ip-api.com/json/?fields=status,lat,lon,city,country,timezone'
    );
    const data: IPLocationResponse = await response.json();

    if (data.status !== 'success') return null;

    return {
      latitude: data.lat,
      longitude: data.lon,
      name: `${data.city}, ${data.country}`,
      timezone: data.timezone,
    };
  } catch {
    return null;
  }
}

// lib/geo/nominatim.ts

export async function geocodeAddress(address: string): Promise<Location | null> {
  const params = new URLSearchParams({
    q: address,
    format: 'json',
    limit: '1',
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        'User-Agent': 'NightSeek-PWA/1.0.0',
      },
    }
  );

  const results = await response.json();
  if (results.length === 0) return null;

  return {
    latitude: parseFloat(results[0].lat),
    longitude: parseFloat(results[0].lon),
    name: results[0].display_name,
  };
}
```

---

## 6. Scoring System Implementation

### 6.1 Imaging Quality Score (0-100 points)

```typescript
// lib/scoring/imaging.ts

/**
 * Calculate altitude score based on airmass (0-40 points)
 */
export function calculateAltitudeScore(airmass: number): number {
  if (airmass <= 1.05) return 38;
  if (airmass <= 1.15) return 36;
  if (airmass <= 1.41) return 30;
  if (airmass <= 2.0) return 22;
  if (airmass <= 3.0) return 12;
  return 4;
}

/**
 * Calculate moon interference score (0-30 points)
 * Higher score = MORE interference (penalty)
 */
export function calculateMoonInterference(
  moonIllumination: number,
  moonSeparation: number | null,
  objectType: ObjectCategory,
  subtype: DSOSubtype | null
): number {
  // Planets are less affected
  if (objectType === 'planet') return 27;

  // Dark sky bonus
  if (moonIllumination < 5) return 30;

  // Calculate base from separation
  let score = 0;
  if (moonSeparation !== null) {
    if (moonSeparation > 90) score = 9;
    else if (moonSeparation > 60) score = 15;
    else if (moonSeparation > 30) score = 21;
    else score = 30;
  }

  // Apply sensitivity factor for DSO subtypes
  const sensitivity = getMoonSensitivity(subtype);
  return Math.round(score * sensitivity);
}

function getMoonSensitivity(subtype: DSOSubtype | null): number {
  switch (subtype) {
    case 'reflection_nebula': return 0.95;
    case 'emission_nebula': return 0.90;
    case 'galaxy': return 0.80;
    case 'supernova_remnant': return 0.85;
    case 'planetary_nebula': return 0.50;
    case 'globular_cluster': return 0.40;
    case 'open_cluster': return 0.30;
    case 'double_star': return 0.10;
    default: return 0.70;
  }
}

/**
 * Calculate peak timing score (0-15 points)
 */
export function calculatePeakTimingScore(
  peakTime: Date | null,
  dusk: Date,
  dawn: Date
): number {
  if (!peakTime) return 3;

  const peakMs = peakTime.getTime();
  const duskMs = dusk.getTime();
  const dawnMs = dawn.getTime();

  // Check if within observation window
  if (peakMs >= duskMs && peakMs <= dawnMs) return 15;

  // Calculate hours outside window
  const hoursOutside = Math.min(
    Math.abs(peakMs - duskMs),
    Math.abs(peakMs - dawnMs)
  ) / (60 * 60 * 1000);

  if (hoursOutside < 1) return 12;
  if (hoursOutside < 2) return 9;
  if (hoursOutside < 4) return 6;
  return 3;
}
```

### 6.2 Weather Score (0-15 points)

```typescript
// lib/scoring/weather.ts

interface WeatherScoreParams {
  cloudCover: number;
  aod: number | null;
  precipProbability: number | null;
  windGustKmh: number | null;
  transparency: number | null;
  isDeepSky: boolean;
  isPlanet: boolean;
}

export function calculateWeatherScore(params: WeatherScoreParams): number {
  const {
    cloudCover,
    aod,
    precipProbability,
    windGustKmh,
    transparency,
    isDeepSky,
    isPlanet,
  } = params;

  // Base score from cloud cover
  let baseScore: number;
  if (cloudCover < 10) baseScore = 1.0;
  else if (cloudCover < 25) baseScore = 0.9;
  else if (cloudCover < 50) baseScore = 0.6;
  else if (cloudCover < 75) baseScore = 0.3;
  else baseScore = 0.1;

  // AOD penalty
  let aodFactor = 1.0;
  if (aod !== null) {
    if (isDeepSky) {
      if (aod < 0.1) aodFactor = 1.0;
      else if (aod < 0.2) aodFactor = 0.95;
      else if (aod < 0.3) aodFactor = 0.85;
      else if (aod < 0.5) aodFactor = 0.70;
      else aodFactor = 0.50;
    } else {
      if (aod < 0.1) aodFactor = 1.0;
      else if (aod < 0.2) aodFactor = 0.98;
      else if (aod < 0.3) aodFactor = 0.92;
      else if (aod < 0.5) aodFactor = 0.85;
      else aodFactor = 0.75;
    }
  }

  // Transparency bonus (deep sky only)
  let transparencyFactor = 1.0;
  if (isDeepSky && transparency !== null) {
    if (transparency >= 80) transparencyFactor = 1.05;
    else if (transparency >= 60) transparencyFactor = 1.0;
    else if (transparency >= 40) transparencyFactor = 0.9;
    else transparencyFactor = 0.75;
  }

  // Precipitation penalty
  let precipFactor = 1.0;
  if (precipProbability !== null) {
    if (precipProbability <= 10) precipFactor = 1.0;
    else if (precipProbability <= 30) precipFactor = 0.9;
    else if (precipProbability <= 50) precipFactor = 0.7;
    else if (precipProbability <= 70) precipFactor = 0.5;
    else precipFactor = 0.3;
  }

  // Wind penalty
  let windFactor = 1.0;
  if (windGustKmh !== null) {
    if (isPlanet) {
      if (windGustKmh < 15) windFactor = 1.0;
      else if (windGustKmh < 25) windFactor = 0.98;
      else if (windGustKmh < 40) windFactor = 0.92;
      else if (windGustKmh < 55) windFactor = 0.80;
      else windFactor = 0.60;
    } else {
      if (windGustKmh < 15) windFactor = 1.0;
      else if (windGustKmh < 25) windFactor = 0.95;
      else if (windGustKmh < 40) windFactor = 0.80;
      else if (windGustKmh < 55) windFactor = 0.60;
      else windFactor = 0.40;
    }
  }

  // Combine factors and scale to 0-15
  const composite = baseScore * aodFactor * transparencyFactor * precipFactor * windFactor;
  return Math.round(composite * 15);
}
```

### 6.3 Object Characteristics Score (0-50 points)

```typescript
// lib/scoring/characteristics.ts

/**
 * Surface brightness score for DSOs (0-20 points)
 */
export function calculateSurfaceBrightnessScore(
  surfaceBrightness: number | null,
  magnitude: number | null,
  angularSizeArcmin: number
): number {
  let sb = surfaceBrightness;

  // Estimate if not provided
  if (sb === null && magnitude !== null && angularSizeArcmin > 0) {
    const areaArcsec2 = Math.PI * Math.pow(angularSizeArcmin * 60 / 2, 2);
    sb = magnitude + 2.5 * Math.log10(Math.max(areaArcsec2, 1));
  }

  if (sb === null) return 10; // Default middle score

  if (sb < 20) return 20;
  if (sb < 22) return 16;
  if (sb < 24) return 12;
  if (sb < 26) return 8;
  return 4;
}

/**
 * Magnitude score (0-15 points)
 */
export function calculateMagnitudeScore(
  magnitude: number | null,
  objectType: ObjectCategory
): number {
  if (magnitude === null) return 7.5;

  if (objectType === 'planet') {
    if (magnitude < -2) return 15;
    if (magnitude < 0) return 13.5;
    if (magnitude < 2) return 10.5;
    return 7.5;
  }

  if (objectType === 'comet' || objectType === 'asteroid') {
    if (magnitude < 6) return 15;
    if (magnitude < 8) return 12;
    if (magnitude < 10) return 9;
    if (magnitude < 12) return 6;
    return 3;
  }

  // DSOs
  if (magnitude < 5) return 15;
  if (magnitude < 7) return 13.5;
  if (magnitude < 9) return 10.5;
  if (magnitude < 11) return 7.5;
  if (magnitude < 13) return 4.5;
  return 3;
}

/**
 * Type suitability score based on moon conditions (0-15 points)
 */
export function calculateTypeSuitabilityScore(
  objectType: ObjectCategory,
  subtype: DSOSubtype | null,
  moonIllumination: number
): number {
  const isDarkSky = moonIllumination < 30;

  if (isDarkSky) {
    if (objectType === 'milky_way') return 15;
    if (subtype === 'emission_nebula' || subtype === 'reflection_nebula' || subtype === 'galaxy') return 14.25;
    if (subtype === 'planetary_nebula' || subtype === 'supernova_remnant') return 12.75;
    if (objectType === 'comet') return 12;
    if (subtype?.includes('cluster')) return 10.5;
    if (objectType === 'planet') return 9;
    return 7.5;
  } else {
    // Bright moon - prioritize moon-resistant targets
    if (objectType === 'planet') return 15;
    if (subtype?.includes('cluster')) return 13.5;
    if (subtype === 'planetary_nebula') return 10.5;
    if (objectType === 'comet') return 7.5;
    if (subtype === 'galaxy' || subtype === 'emission_nebula') return 4.5;
    if (objectType === 'milky_way') return 1.5;
    return 6;
  }
}
```

### 6.4 Priority/Rarity Score (0-50 points)

```typescript
// lib/scoring/priority.ts

/**
 * Transient bonus for rare/time-sensitive objects (0-25 points)
 */
export function calculateTransientBonus(
  objectType: ObjectCategory,
  isInterstellar: boolean,
  daysFromPerihelion?: number
): number {
  if (isInterstellar) return 25; // Extremely rare!

  if (objectType === 'comet') {
    if (daysFromPerihelion !== undefined && Math.abs(daysFromPerihelion) < 30) {
      return 17.5; // Near perihelion
    }
    return 12.5;
  }

  if (objectType === 'asteroid') return 7.5;

  return 0; // Static objects
}

/**
 * Seasonal window bonus (0-15 points)
 * Objects opposite the sun score higher
 */
export function calculateSeasonalWindowScore(
  objectRaHours: number,
  sunRaHours: number
): number {
  // Calculate RA difference (0-24 hours)
  let raDiff = Math.abs(objectRaHours - sunRaHours);
  if (raDiff > 12) raDiff = 24 - raDiff;

  // Best when RA diff = 12 (opposite sun)
  return 15 * (1 - Math.abs(raDiff - 12) / 12);
}

/**
 * Novelty/popularity bonus (0-10 points)
 */
export function calculateNoveltyScore(
  objectName: string,
  isMessier: boolean
): number {
  if (isMessier) return 10;

  // Check for common named objects
  if (COMMON_NAMES[objectName]) return 5;

  return 0;
}
```

---

## 7. UI Components Design

### 7.1 Responsive Layout Strategy

```
Desktop (≥1024px):
┌─────────────────────────────────────────────────────┐
│ Header: Logo | Location | Settings                   │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────┐  ┌────────────────────────────┐ │
│ │ Date Range      │  │ Moon & Weather Summary     │ │
│ │ Location Info   │  │ (Table view)               │ │
│ └─────────────────┘  └────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ Tonight's Highlights                                 │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐            │
│ │Object │ │Object │ │Object │ │Object │            │
│ │Card   │ │Card   │ │Card   │ │Card   │            │
│ └───────┘ └───────┘ └───────┘ └───────┘            │
├─────────────────────────────────────────────────────┤
│ Weekly Forecast (Tabs: Planets | DSOs | Comets)     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Object rows with detailed info                  │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘

Mobile Portrait (< 640px):
┌─────────────────────┐
│ Header (compact)    │
├─────────────────────┤
│ Date & Location     │
├─────────────────────┤
│ Moon & Weather      │
│ (Vertical cards)    │
├─────────────────────┤
│ Tonight's Best      │
│ ┌─────────────────┐ │
│ │ Object Card     │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ Object Card     │ │
│ └─────────────────┘ │
├─────────────────────┤
│ [Planets] [DSOs]    │
│ ┌─────────────────┐ │
│ │ Collapsed rows  │ │
│ │ (tap to expand) │ │
│ └─────────────────┘ │
└─────────────────────┘

Mobile Landscape (< 900px, landscape):
┌───────────────────────────────────────────┐
│ Header | Date Range | Location            │
├───────────────────────────────────────────┤
│ ┌─────────────┐  ┌──────────────────────┐ │
│ │ Tonight's   │  │ Weekly Forecast      │ │
│ │ Highlights  │  │ (scrollable)         │ │
│ │ (vertical)  │  │                      │ │
│ └─────────────┘  └──────────────────────┘ │
└───────────────────────────────────────────┘
```

### 7.2 Component Specifications

#### ObjectCard Component

```typescript
// components/forecast/ObjectCard.tsx

interface ObjectCardProps {
  object: ScoredObject;
  weather: NightWeather | null;
  onExpand: () => void;
}

// Features:
// - Category icon with color coding
// - Object name (common name + designation)
// - Score badge with tier color
// - Peak altitude and time
// - Moon separation indicator
// - Weather conditions badge
// - Tap/click to expand for details
// - Responsive: horizontal on desktop, vertical on mobile
```

#### NightSummaryTable Component

```typescript
// components/forecast/NightSummary.tsx

// Desktop: Full table with all columns
// Tablet: Condensed columns, hover for details
// Mobile: Card stack, each night as a card

// Columns:
// - Date (weekday + date)
// - Night times (dusk-dawn)
// - Moon phase icon + %
// - Cloud cover (if weather available)
// - Best time window
// - Star rating (1-5)
```

#### StarRating Component

```typescript
// components/weather/StarRating.tsx

// Based on combined moon + weather conditions
// ★★★★★ = Excellent (< 20% moon, < 20% clouds)
// ★★★★☆ = Very Good
// ★★★☆☆ = Good
// ★★☆☆☆ = Fair
// ★☆☆☆☆ = Poor

// Visual: Filled/empty star icons
// Color: Gold for filled, gray for empty
// Accessibility: aria-label with text rating
```

### 7.3 Tailwind Responsive Breakpoints

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'xs': '375px',    // Small phones
      'sm': '640px',    // Large phones / small tablets
      'md': '768px',    // Tablets
      'lg': '1024px',   // Laptops
      'xl': '1280px',   // Desktops
      '2xl': '1536px',  // Large screens
    },
  },
  plugins: [
    // For safe-area-inset on notched devices
    require('tailwindcss-safe-area'),
  ],
}
```

---

## 8. PWA Configuration

### 8.1 Web App Manifest

```json
// public/manifest.json
{
  "name": "NightSeek - Astronomy Planner",
  "short_name": "NightSeek",
  "description": "Plan your astronomy observations with weather-integrated forecasts",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0ea5e9",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshots/mobile.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],
  "categories": ["utilities", "weather", "education"],
  "shortcuts": [
    {
      "name": "Tonight's Forecast",
      "url": "/?days=1",
      "icons": [{ "src": "/icons/tonight.png", "sizes": "96x96" }]
    },
    {
      "name": "7-Day Forecast",
      "url": "/?days=7",
      "icons": [{ "src": "/icons/week.png", "sizes": "96x96" }]
    }
  ]
}
```

### 8.2 Vite PWA Plugin Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      manifest: false, // Use public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache OpenNGC catalog
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/mattiaverga\/OpenNGC/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'opengc-catalog',
              expiration: {
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
            },
          },
          {
            // Cache weather API (network first, fallback to cache)
            urlPattern: /^https:\/\/api\.open-meteo\.com/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-api',
              expiration: {
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache air quality API
            urlPattern: /^https:\/\/air-quality-api\.open-meteo\.com/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'air-quality-api',
              expiration: {
                maxAgeSeconds: 60 * 60, // 1 hour
              },
            },
          },
          {
            // Cache geocoding (address lookups)
            urlPattern: /^https:\/\/nominatim\.openstreetmap\.org/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'geocoding',
              expiration: {
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
});
```

### 8.3 Offline Support Strategy

```typescript
// lib/utils/cache.ts

import { get, set, del, keys } from 'idb-keyval';

const CACHE_KEYS = {
  LOCATION: 'nightseek:location',
  SETTINGS: 'nightseek:settings',
  LAST_FORECAST: 'nightseek:forecast',
  OPENGC_CATALOG: 'nightseek:opengc',
  COMET_ELEMENTS: 'nightseek:comets',
};

export async function cacheLocation(location: Location): Promise<void> {
  await set(CACHE_KEYS.LOCATION, location);
}

export async function getCachedLocation(): Promise<Location | null> {
  return await get(CACHE_KEYS.LOCATION) ?? null;
}

export async function cacheForecast(
  forecast: NightForecast[],
  timestamp: Date
): Promise<void> {
  await set(CACHE_KEYS.LAST_FORECAST, { forecast, timestamp });
}

export async function getCachedForecast(): Promise<{
  forecast: NightForecast[];
  timestamp: Date;
} | null> {
  return await get(CACHE_KEYS.LAST_FORECAST) ?? null;
}

// Clear old cache entries
export async function pruneCache(): Promise<void> {
  const allKeys = await keys();
  const now = Date.now();

  for (const key of allKeys) {
    if (typeof key === 'string' && key.startsWith('nightseek:weather:')) {
      const data = await get(key);
      if (data?.timestamp && now - data.timestamp > 60 * 60 * 1000) {
        await del(key);
      }
    }
  }
}
```

---

## 9. State Management

### 9.1 React Context for Global State

```typescript
// stores/AppContext.tsx

import { createContext, useContext, useReducer, useEffect } from 'react';

interface AppState {
  location: Location | null;
  settings: Settings;
  forecast: NightForecast[] | null;
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
}

type Action =
  | { type: 'SET_LOCATION'; payload: Location }
  | { type: 'SET_SETTINGS'; payload: Partial<Settings> }
  | { type: 'SET_FORECAST'; payload: NightForecast[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_OFFLINE'; payload: boolean };

const initialState: AppState = {
  location: null,
  settings: {
    forecastDays: 7,
    maxObjects: 8,
    cometMagnitude: 12.0,
    dsoMagnitude: 14.0,
    theme: 'system',
    units: 'metric',
  },
  forecast: null,
  isLoading: false,
  error: null,
  isOffline: !navigator.onLine,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOCATION':
      return { ...state, location: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_FORECAST':
      return { ...state, forecast: action.payload, error: null };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_OFFLINE':
      return { ...state, isOffline: action.payload };
    default:
      return state;
  }
}

export const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('nightseek:settings', JSON.stringify(state.settings));
  }, [state.settings]);

  // Load settings on mount
  useEffect(() => {
    const saved = localStorage.getItem('nightseek:settings');
    if (saved) {
      dispatch({ type: 'SET_SETTINGS', payload: JSON.parse(saved) });
    }
  }, []);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_OFFLINE', payload: false });
    const handleOffline = () => dispatch({ type: 'SET_OFFLINE', payload: true });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests (Vitest)

```typescript
// lib/astronomy/__tests__/airmass.test.ts
import { describe, it, expect } from 'vitest';
import { calculateAirmass } from '../airmass';

describe('calculateAirmass', () => {
  it('returns 1.0 at zenith', () => {
    expect(calculateAirmass(90)).toBeCloseTo(1.0, 2);
  });

  it('returns ~1.41 at 45°', () => {
    expect(calculateAirmass(45)).toBeCloseTo(1.41, 1);
  });

  it('returns ~2.0 at 30°', () => {
    expect(calculateAirmass(30)).toBeCloseTo(2.0, 1);
  });

  it('returns Infinity at or below horizon', () => {
    expect(calculateAirmass(0)).toBe(Infinity);
    expect(calculateAirmass(-5)).toBe(Infinity);
  });
});

// lib/scoring/__tests__/scoring.test.ts
describe('Scoring System', () => {
  it('scores excellent objects 150-200 points', () => {
    const score = calculateTotalScore({
      // High altitude, dark sky, bright magnitude, good weather
    });
    expect(score).toBeGreaterThanOrEqual(150);
  });

  it('applies moon sensitivity correctly', () => {
    const galaxyScore = calculateMoonInterference(50, 45, 'dso', 'galaxy');
    const clusterScore = calculateMoonInterference(50, 45, 'dso', 'open_cluster');
    expect(galaxyScore).toBeGreaterThan(clusterScore); // Galaxies more affected
  });
});
```

### 10.2 Integration Tests

```typescript
// __tests__/integration/forecast.test.ts

describe('Forecast Generation', () => {
  it('generates complete forecast for valid location', async () => {
    const forecast = await generateForecast({
      latitude: 51.4536,
      longitude: -0.1919,
      forecastDays: 3,
    });

    expect(forecast).toHaveLength(3);
    expect(forecast[0].planets.length).toBeGreaterThan(0);
    expect(forecast[0].nightInfo.astronomicalDusk).toBeDefined();
  });

  it('handles API failures gracefully', async () => {
    // Mock network failure
    const forecast = await generateForecast({
      latitude: 51.4536,
      longitude: -0.1919,
      forecastDays: 3,
    });

    // Should still return forecast without weather
    expect(forecast).toHaveLength(3);
    expect(forecast[0].weather).toBeNull();
  });
});
```

### 10.3 E2E Tests (Playwright)

```typescript
// e2e/forecast.spec.ts
import { test, expect } from '@playwright/test';

test('displays forecast for detected location', async ({ page }) => {
  await page.goto('/');

  // Wait for location detection or setup prompt
  await expect(page.getByText(/Observation Forecast|Set up location/)).toBeVisible();

  // If setup required, enter coordinates
  if (await page.getByText('Set up location').isVisible()) {
    await page.getByLabel('Latitude').fill('51.4536');
    await page.getByLabel('Longitude').fill('-0.1919');
    await page.getByRole('button', { name: 'Save' }).click();
  }

  // Verify forecast displays
  await expect(page.getByText('Tonight\'s Highlights')).toBeVisible();
});

test('works offline with cached data', async ({ page, context }) => {
  // First visit - cache data
  await page.goto('/');
  await page.waitForSelector('[data-testid="forecast-loaded"]');

  // Go offline
  await context.setOffline(true);

  // Reload - should show cached forecast
  await page.reload();
  await expect(page.getByText('Tonight\'s Highlights')).toBeVisible();
  await expect(page.getByText('Offline')).toBeVisible();
});
```

---

## 11. Build & Deployment

### 11.1 Build Commands

```json
// package.json scripts
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint src --ext ts,tsx",
    "type-check": "tsc --noEmit"
  }
}
```

### 11.2 Production Build Output

```
dist/
├── index.html              # Entry point
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── assets/
│   ├── index-[hash].js     # Main bundle (~150KB gzipped)
│   ├── index-[hash].css    # Styles (~15KB gzipped)
│   └── vendor-[hash].js    # Dependencies (~100KB gzipped)
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── data/
    └── meteor-showers.json
```

### 11.3 Deployment Options

1. **Vercel** (recommended for ease)
   - Auto-deploys from GitHub
   - Edge caching for static assets
   - Serverless functions if needed

2. **Netlify**
   - Similar to Vercel
   - Good PWA support

3. **GitHub Pages**
   - Free hosting
   - Manual deploy or GitHub Actions

4. **Self-hosted**
   - Any static file server (nginx, Apache)
   - CDN recommended (Cloudflare, etc.)

---

## 12. Migration Checklist

### Phase 1: Core Infrastructure
- [ ] Set up Vite + React + TypeScript project
- [ ] Configure Tailwind CSS with responsive breakpoints
- [ ] Set up PWA plugin and manifest
- [ ] Create type definitions for all data models

### Phase 2: Core Logic (No UI)
- [ ] Implement astronomical calculations (airmass, separation, etc.)
- [ ] Port SkyCalculator class using astronomy-engine
- [ ] Implement weather API clients
- [ ] Port OpenNGC catalog loader
- [ ] Implement scoring system (all 3 categories)
- [ ] Port event detection (conjunctions, meteor showers)

### Phase 3: UI Components
- [ ] Build layout components (Header, Footer, Container)
- [ ] Build setup wizard components
- [ ] Build forecast display components
- [ ] Build object cards and rows
- [ ] Build weather and moon indicators
- [ ] Ensure responsive design works

### Phase 4: Integration
- [ ] Wire up state management
- [ ] Connect components to core logic
- [ ] Implement caching layer
- [ ] Add offline support

### Phase 5: Testing & Polish
- [ ] Write unit tests for calculations
- [ ] Write integration tests for forecast
- [ ] Write E2E tests for user flows
- [ ] Performance optimization
- [ ] Accessibility audit

### Phase 6: Deployment
- [ ] Build production bundle
- [ ] Deploy to hosting platform
- [ ] Verify PWA install works
- [ ] Test on real iOS/Android devices

---

## 13. Performance Considerations

### 13.1 Bundle Size Optimization

- Use dynamic imports for heavy components (charts, modals)
- Tree-shake astronomy-engine (only import needed functions)
- Lazy load OpenNGC catalog (fetch on demand)
- Use lightweight alternatives where possible:
  - `date-fns` over `moment.js` (tree-shakeable)
  - Native `fetch` over `axios`
  - `idb-keyval` over `localforage`

### 13.2 Calculation Performance

- Memoize expensive calculations (visibility windows)
- Use Web Workers for heavy computation if needed
- Debounce settings changes before recalculating
- Cache intermediate results (planet positions)

### 13.3 Rendering Performance

- Use `React.memo` for object cards
- Virtualize long lists (react-window)
- Lazy load images and icons
- Use CSS containment for complex layouts

---

## 14. Accessibility

- Semantic HTML (headings, landmarks, lists)
- ARIA labels for icons and interactive elements
- Keyboard navigation for all interactions
- Color contrast meets WCAG AA
- Screen reader announcements for loading states
- Reduced motion preference support
- Focus management for modals and popups

---

This implementation plan provides a complete roadmap for building the NightSeek PWA with 100% feature parity to the Python CLI application.
