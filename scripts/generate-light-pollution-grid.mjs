#!/usr/bin/env node
/**
 * Generate a light pollution lookup grid from the World Atlas 2015 dataset.
 *
 * This script processes pre-computed radiance data into a compact JSON grid
 * that can be bundled with the web app (~100-150KB compressed).
 *
 * Grid resolution: 0.5 degrees (about 55km at the equator)
 * Coverage: -60 to 75 latitude (populated land areas)
 *
 * The data source is the "New World Atlas of Artificial Night Sky Brightness"
 * (Falchi et al., 2016) radiance values mapped to Bortle classes.
 *
 * Since we can't download the raw GeoTIFF in CI easily, this script generates
 * a representative grid using population density heuristics enhanced with
 * known astronomical observing site data. For production, replace this with
 * actual VIIRS processing.
 *
 * Output: web/src/data/light-pollution.json
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'web', 'src', 'data', 'light-pollution.json');

// Grid parameters
const LAT_MIN = -60;
const LAT_MAX = 75;
const LON_MIN = -180;
const LON_MAX = 180;
const RESOLUTION = 0.5; // degrees

// ─── Known dark sites (Bortle 1-3) ──────────────────────────────────────────

const DARK_SITES = [
  // International Dark Sky Parks/Reserves
  { lat: 32.5, lon: -105.5, bortle: 1, radius: 1.5 }, // Cosmic Campground, NM
  { lat: 32.1, lon: -110.7, bortle: 2, radius: 1.0 }, // Kitt Peak, AZ
  { lat: 36.1, lon: -116.9, bortle: 1, radius: 2.0 }, // Death Valley, CA
  { lat: 38.9, lon: -114.3, bortle: 1, radius: 1.5 }, // Great Basin, NV
  { lat: 35.4, lon: -111.5, bortle: 2, radius: 1.0 }, // Flagstaff, AZ area
  { lat: 31.9, lon: -111.6, bortle: 1, radius: 1.5 }, // Organ Pipe Cactus, AZ
  { lat: 38.5, lon: -109.5, bortle: 1, radius: 2.0 }, // Canyonlands, UT
  { lat: 37.7, lon: -119.5, bortle: 2, radius: 1.5 }, // Yosemite, CA
  { lat: 44.6, lon: -110.5, bortle: 2, radius: 2.0 }, // Yellowstone, WY
  { lat: 48.5, lon: -113.5, bortle: 1, radius: 1.5 }, // Glacier NP, MT
  { lat: 29.3, lon: -103.9, bortle: 1, radius: 2.0 }, // Big Bend, TX
  { lat: 40.5, lon: -105.6, bortle: 3, radius: 1.0 }, // Rocky Mountain NP
  { lat: 36.1, lon: -112.1, bortle: 2, radius: 1.5 }, // Grand Canyon, AZ
  { lat: 37.3, lon: -105.5, bortle: 2, radius: 1.5 }, // Great Sand Dunes, CO
  { lat: 48.8, lon: -114.0, bortle: 2, radius: 1.5 }, // Waterton-Glacier, MT
  // Hawaii
  { lat: 19.8, lon: -155.5, bortle: 1, radius: 1.0 }, // Mauna Kea, HI
  // Europe
  { lat: 28.3, lon: -16.5, bortle: 1, radius: 1.0 }, // La Palma, Canary Islands
  { lat: 37.1, lon: -2.5, bortle: 2, radius: 1.0 },  // Calar Alto, Spain
  { lat: 44.5, lon: 6.9, bortle: 2, radius: 1.0 },   // French Alps observatories
  { lat: 55.5, lon: -5.0, bortle: 2, radius: 1.5 },   // Scottish Highlands
  { lat: 57.0, lon: -6.5, bortle: 1, radius: 1.5 },   // Isle of Skye
  { lat: 60.5, lon: 8.0, bortle: 2, radius: 2.0 },    // Central Norway
  { lat: 67.5, lon: 15.0, bortle: 2, radius: 2.0 },   // Lofoten Islands
  { lat: 69.0, lon: 18.5, bortle: 2, radius: 1.5 },   // Tromsø area
  // Southern hemisphere
  { lat: -30.2, lon: -70.8, bortle: 1, radius: 1.5 },  // Atacama, Chile
  { lat: -31.3, lon: 149.1, bortle: 2, radius: 1.5 },  // Warrumbungle, Australia
  { lat: -44.0, lon: 170.5, bortle: 1, radius: 2.0 },  // Aoraki, New Zealand
  { lat: -32.4, lon: 20.8, bortle: 1, radius: 1.5 },   // SAAO, South Africa
  { lat: -23.3, lon: -67.7, bortle: 1, radius: 2.0 },  // ALMA, Chile
  // Africa
  { lat: -24.6, lon: 15.5, bortle: 1, radius: 3.0 },   // NamibRand, Namibia
];

// ─── Major population centers (high Bortle) ──────────────────────────────────

const POPULATION_CENTERS = [
  // North America
  { lat: 40.7, lon: -74.0, bortle: 9, radius: 1.5 }, // NYC
  { lat: 34.1, lon: -118.2, bortle: 9, radius: 2.0 }, // LA
  { lat: 41.9, lon: -87.6, bortle: 9, radius: 1.5 }, // Chicago
  { lat: 29.8, lon: -95.4, bortle: 8, radius: 1.5 }, // Houston
  { lat: 33.4, lon: -112.1, bortle: 8, radius: 1.5 }, // Phoenix
  { lat: 39.9, lon: -75.2, bortle: 9, radius: 1.0 }, // Philly
  { lat: 32.7, lon: -117.2, bortle: 8, radius: 1.0 }, // San Diego
  { lat: 32.8, lon: -96.8, bortle: 8, radius: 1.5 }, // Dallas
  { lat: 37.3, lon: -121.9, bortle: 8, radius: 1.0 }, // San Jose
  { lat: 37.8, lon: -122.4, bortle: 9, radius: 0.8 }, // SF
  { lat: 47.6, lon: -122.3, bortle: 7, radius: 1.0 }, // Seattle
  { lat: 39.7, lon: -104.9, bortle: 7, radius: 1.0 }, // Denver
  { lat: 42.4, lon: -71.1, bortle: 9, radius: 1.0 }, // Boston
  { lat: 25.8, lon: -80.2, bortle: 8, radius: 1.5 }, // Miami
  { lat: 38.9, lon: -77.0, bortle: 8, radius: 1.5 }, // DC
  { lat: 35.1, lon: -80.8, bortle: 7, radius: 1.0 }, // Charlotte
  { lat: 36.2, lon: -115.2, bortle: 8, radius: 1.5 }, // Las Vegas
  { lat: 33.7, lon: -84.4, bortle: 8, radius: 1.5 }, // Atlanta
  { lat: 45.5, lon: -73.6, bortle: 7, radius: 1.0 }, // Montreal
  { lat: 43.7, lon: -79.4, bortle: 8, radius: 1.5 }, // Toronto
  { lat: 49.3, lon: -123.1, bortle: 7, radius: 1.0 }, // Vancouver
  { lat: 19.4, lon: -99.1, bortle: 9, radius: 2.0 }, // Mexico City
  // Europe
  { lat: 51.5, lon: -0.1, bortle: 9, radius: 2.0 }, // London
  { lat: 48.9, lon: 2.3, bortle: 9, radius: 1.5 }, // Paris
  { lat: 52.5, lon: 13.4, bortle: 8, radius: 1.0 }, // Berlin
  { lat: 40.4, lon: -3.7, bortle: 8, radius: 1.5 }, // Madrid
  { lat: 41.9, lon: 12.5, bortle: 8, radius: 1.0 }, // Rome
  { lat: 52.4, lon: 4.9, bortle: 9, radius: 0.8 }, // Amsterdam
  { lat: 50.8, lon: 4.4, bortle: 8, radius: 0.8 }, // Brussels
  { lat: 48.2, lon: 16.4, bortle: 8, radius: 0.8 }, // Vienna
  { lat: 55.7, lon: 37.6, bortle: 8, radius: 2.0 }, // Moscow
  { lat: 59.9, lon: 30.3, bortle: 7, radius: 1.0 }, // St Petersburg
  { lat: 50.1, lon: 14.4, bortle: 7, radius: 0.8 }, // Prague
  { lat: 52.2, lon: 21.0, bortle: 7, radius: 1.0 }, // Warsaw
  { lat: 47.5, lon: 19.1, bortle: 7, radius: 0.8 }, // Budapest
  { lat: 59.3, lon: 18.1, bortle: 7, radius: 0.8 }, // Stockholm
  { lat: 55.7, lon: 12.6, bortle: 7, radius: 0.8 }, // Copenhagen
  { lat: 38.7, lon: -9.1, bortle: 8, radius: 0.8 }, // Lisbon
  { lat: 41.4, lon: 2.2, bortle: 8, radius: 1.0 }, // Barcelona
  { lat: 45.5, lon: 9.2, bortle: 8, radius: 1.5 }, // Milan
  { lat: 45.4, lon: 12.3, bortle: 7, radius: 0.5 }, // Venice
  { lat: 53.3, lon: -6.3, bortle: 7, radius: 0.8 }, // Dublin
  // Asia
  { lat: 35.7, lon: 139.7, bortle: 9, radius: 2.5 }, // Tokyo
  { lat: 37.6, lon: 127.0, bortle: 9, radius: 2.0 }, // Seoul
  { lat: 31.2, lon: 121.5, bortle: 9, radius: 2.5 }, // Shanghai
  { lat: 39.9, lon: 116.4, bortle: 9, radius: 3.0 }, // Beijing
  { lat: 22.3, lon: 114.2, bortle: 9, radius: 1.0 }, // Hong Kong
  { lat: 1.3, lon: 103.8, bortle: 9, radius: 0.8 }, // Singapore
  { lat: 13.8, lon: 100.5, bortle: 8, radius: 1.5 }, // Bangkok
  { lat: 28.6, lon: 77.2, bortle: 8, radius: 2.0 }, // Delhi
  { lat: 19.1, lon: 72.9, bortle: 9, radius: 2.0 }, // Mumbai
  { lat: 34.7, lon: 135.5, bortle: 9, radius: 2.0 }, // Osaka
  { lat: 35.0, lon: 136.9, bortle: 8, radius: 1.5 }, // Nagoya
  { lat: 23.1, lon: 113.3, bortle: 9, radius: 2.0 }, // Guangzhou
  { lat: 22.5, lon: 88.4, bortle: 8, radius: 1.5 }, // Kolkata
  { lat: 14.6, lon: 121.0, bortle: 8, radius: 1.5 }, // Manila
  { lat: -6.2, lon: 106.8, bortle: 8, radius: 2.0 }, // Jakarta
  { lat: 35.7, lon: 51.4, bortle: 8, radius: 1.5 }, // Tehran
  { lat: 41.0, lon: 29.0, bortle: 8, radius: 2.0 }, // Istanbul
  { lat: 24.5, lon: 54.4, bortle: 8, radius: 1.0 }, // Abu Dhabi
  // Australia & Oceania
  { lat: -33.9, lon: 151.2, bortle: 8, radius: 1.5 }, // Sydney
  { lat: -37.8, lon: 145.0, bortle: 8, radius: 1.5 }, // Melbourne
  { lat: -27.5, lon: 153.0, bortle: 7, radius: 1.0 }, // Brisbane
  { lat: -31.9, lon: 115.9, bortle: 7, radius: 1.0 }, // Perth
  { lat: -36.8, lon: 174.8, bortle: 7, radius: 0.8 }, // Auckland
  // South America
  { lat: -23.5, lon: -46.6, bortle: 9, radius: 2.5 }, // Sao Paulo
  { lat: -22.9, lon: -43.2, bortle: 8, radius: 1.5 }, // Rio
  { lat: -34.6, lon: -58.4, bortle: 8, radius: 2.0 }, // Buenos Aires
  { lat: -33.4, lon: -70.7, bortle: 7, radius: 1.0 }, // Santiago
  { lat: 4.7, lon: -74.1, bortle: 7, radius: 1.0 }, // Bogota
  { lat: -12.0, lon: -77.0, bortle: 7, radius: 1.0 }, // Lima
  // Africa
  { lat: 30.0, lon: 31.2, bortle: 8, radius: 2.0 }, // Cairo
  { lat: -1.3, lon: 36.8, bortle: 7, radius: 1.0 }, // Nairobi
  { lat: -26.2, lon: 28.0, bortle: 7, radius: 1.5 }, // Johannesburg
  { lat: -33.9, lon: 18.4, bortle: 7, radius: 1.0 }, // Cape Town
  { lat: 33.6, lon: -7.6, bortle: 7, radius: 1.0 }, // Casablanca
  { lat: 6.5, lon: 3.4, bortle: 8, radius: 1.5 }, // Lagos
];

// ─── Geographic heuristics ───────────────────────────────────────────────────

/**
 * Land mask approximation — returns true if the lat/lon is likely over ocean.
 * This is a rough heuristic; a real implementation would use a shapefile.
 */
function isLikelyOcean(lat, lon) {
  // Central Pacific
  if (lat > -30 && lat < 30 && lon > -170 && lon < -100) return true;
  // Central Atlantic
  if (lat > -30 && lat < 30 && lon > -50 && lon < -10) return true;
  // Southern Indian Ocean
  if (lat > -50 && lat < -10 && lon > 50 && lon < 100) return true;
  // Southern Ocean
  if (lat < -55) return true;
  // Arctic Ocean
  if (lat > 72 && (lon < -20 || lon > 40)) return true;
  // North Pacific
  if (lat > 10 && lat < 50 && lon > 150) return true;
  if (lat > 10 && lat < 50 && lon < -130) return true;
  return false;
}

/**
 * Estimate Bortle class for a grid cell based on distance to population centers.
 * Uses inverse-distance weighting from known reference points.
 */
function estimateBortleForCell(lat, lon) {
  // Ocean cells get Bortle 1
  if (isLikelyOcean(lat, lon)) return 1;

  // Check dark sites first (small radius, strong signal)
  for (const site of DARK_SITES) {
    const dist = haversineDistance(lat, lon, site.lat, site.lon);
    if (dist <= site.radius * 50) { // radius in ~50km units
      return site.bortle;
    }
  }

  // Check population centers (larger influence radius)
  let closestCityBortle = null;
  let closestCityDist = Infinity;

  for (const city of POPULATION_CENTERS) {
    const dist = haversineDistance(lat, lon, city.lat, city.lon);
    const influenceRadius = city.radius * 100; // radius in ~km

    if (dist < influenceRadius) {
      // Inside the city's light dome
      const falloff = dist / influenceRadius;
      const effectiveBortle = Math.max(
        4,
        Math.round(city.bortle - (city.bortle - 4) * falloff)
      );
      if (dist < closestCityDist) {
        closestCityDist = dist;
        closestCityBortle = effectiveBortle;
      }
    } else if (dist < closestCityDist) {
      closestCityDist = dist;
    }
  }

  if (closestCityBortle !== null) return closestCityBortle;

  // Latitude-based fallback for areas far from known centers
  const absLat = Math.abs(lat);
  if (absLat > 65) return 2;       // High latitude — sparse population
  if (absLat > 55) return 3;       // Sub-arctic
  if (absLat > 45) return 4;       // Mid-high latitude
  if (absLat > 25) return 5;       // Mid-latitude (suburban default)
  return 4;                         // Tropical rural
}

/**
 * Haversine distance in km between two lat/lon points.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Grid generation ─────────────────────────────────────────────────────────

function generateGrid() {
  console.log('Generating light pollution grid...');
  console.log(`  Resolution: ${RESOLUTION}°`);
  console.log(`  Coverage: ${LAT_MIN}° to ${LAT_MAX}° lat, ${LON_MIN}° to ${LON_MAX}° lon`);

  const latSteps = Math.ceil((LAT_MAX - LAT_MIN) / RESOLUTION);
  const lonSteps = Math.ceil((LON_MAX - LON_MIN) / RESOLUTION);
  console.log(`  Grid size: ${latSteps} × ${lonSteps} = ${latSteps * lonSteps} cells`);

  // Use a flat array for compactness: row-major, one byte per cell (Bortle 1-9)
  const grid = new Uint8Array(latSteps * lonSteps);
  let nonOcean = 0;

  for (let latIdx = 0; latIdx < latSteps; latIdx++) {
    const lat = LAT_MIN + (latIdx + 0.5) * RESOLUTION;
    for (let lonIdx = 0; lonIdx < lonSteps; lonIdx++) {
      const lon = LON_MIN + (lonIdx + 0.5) * RESOLUTION;
      const bortle = estimateBortleForCell(lat, lon);
      grid[latIdx * lonSteps + lonIdx] = bortle;
      if (bortle > 1) nonOcean++;
    }
  }

  console.log(`  Non-ocean cells: ${nonOcean} (${((nonOcean / grid.length) * 100).toFixed(1)}%)`);

  // Convert to a compact format: base64-encoded grid + metadata
  const gridBase64 = Buffer.from(grid).toString('base64');

  return {
    version: 1,
    resolution: RESOLUTION,
    latMin: LAT_MIN,
    latMax: LAT_MAX,
    lonMin: LON_MIN,
    lonMax: LON_MAX,
    latSteps,
    lonSteps,
    grid: gridBase64,
    generatedAt: new Date().toISOString(),
    source: 'Heuristic model based on population centers and dark sky sites',
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const data = generateGrid();
const content = JSON.stringify(data);
writeFileSync(OUTPUT_PATH, content, 'utf-8');
console.log(`\nWrote ${OUTPUT_PATH} (${(content.length / 1024).toFixed(1)} KB)`);
