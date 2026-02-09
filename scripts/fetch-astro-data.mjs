#!/usr/bin/env node
/**
 * Pre-fetch astronomical data for static serving via GitHub Pages.
 *
 * Fetches:
 *   - NEO close approaches (NASA NeoWs) — 7-day window
 *   - Comet orbital elements (MPC CometEls.txt) — parsed to JSON
 *   - Asteroid physical data (hardcoded from JPL SBDB)
 *
 * Output: web/public/data/{neo,comets,asteroids,meta}.json
 *
 * Designed to run as a GitHub Action (daily cron) or locally.
 * Zero dependencies — plain Node.js 20+ ESM with native fetch.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'web', 'src', 'data');

// Ensure output directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

function safeWrite(filename, data) {
  const content = JSON.stringify(data, null, 2);
  const filepath = join(DATA_DIR, filename);
  writeFileSync(filepath, content, 'utf-8');
  console.log(`  wrote ${filename} (${(content.length / 1024).toFixed(1)} KB)`);
  return content;
}

// ─── NEO Close Approaches (NASA NeoWs) ─────────────────────────────────────

const NASA_API_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';
const NEOWS_URL = 'https://api.nasa.gov/neo/rest/v1/feed';
const NOTABLE_DISTANCE_LD = 20;
const MIN_DIAMETER_KM = 0.01;
const MAX_DAYS_PER_REQUEST = 7;

async function fetchNeoData() {
  console.log('Fetching NEO close approaches...');

  const today = new Date();
  // Fetch 7 days starting from today
  const startDate = new Date(today);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + MAX_DAYS_PER_REQUEST - 1);

  const params = new URLSearchParams({
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    api_key: NASA_API_KEY,
  });

  const response = await fetch(`${NEOWS_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`NeoWs API ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const result = {};

  for (const [dateStr, neos] of Object.entries(data.near_earth_objects)) {
    const approaches = [];
    for (const neo of neos) {
      const approach = neo.close_approach_data.find(ca => ca.close_approach_date === dateStr);
      if (!approach) continue;

      const missDistanceLD = parseFloat(approach.miss_distance.lunar);
      const diameterMin = neo.estimated_diameter.kilometers.estimated_diameter_min;
      const diameterMax = neo.estimated_diameter.kilometers.estimated_diameter_max;

      if (missDistanceLD > NOTABLE_DISTANCE_LD) continue;
      if (diameterMax < MIN_DIAMETER_KM) continue;

      approaches.push({
        name: neo.name.replace(/^\((.+)\)$/, '$1'),
        neoId: neo.id,
        isPotentiallyHazardous: neo.is_potentially_hazardous_asteroid,
        estimatedDiameterKm: { min: diameterMin, max: diameterMax },
        closeApproachDate: approach.close_approach_date_full,
        missDistanceLunarDistances: missDistanceLD,
        relativeVelocityKmh: parseFloat(approach.relative_velocity.kilometers_per_hour),
        absoluteMagnitude: neo.absolute_magnitude_h,
      });
    }
    approaches.sort((a, b) => a.missDistanceLunarDistances - b.missDistanceLunarDistances);
    result[dateStr] = approaches;
  }

  return {
    fetchedAt: new Date().toISOString(),
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    data: result,
  };
}

// ─── Comet Orbital Elements (MPC) ──────────────────────────────────────────

const MPC_COMET_URL = 'https://www.minorplanetcenter.net/iau/MPCORB/CometEls.txt';

/**
 * Convert calendar date to Julian date
 */
function dateToJulian(year, month, day) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

/**
 * Parse a single line of MPC comet elements (fixed-width format)
 * Replicates parseMPCCometLine() from web/src/lib/catalogs/comets.ts
 */
function parseMPCCometLine(line) {
  if (line.trim().length < 100 || line.startsWith('#') || line.startsWith('Num')) {
    return null;
  }

  try {
    const perihelionDateStr = line.substring(14, 29).trim();
    const qStr = line.substring(30, 40).trim();
    const eStr = line.substring(41, 52).trim();
    const omegaStr = line.substring(51, 62).trim();
    const nodeStr = line.substring(61, 72).trim();
    const incStr = line.substring(71, 82).trim();
    const epochStr = line.substring(81, 93).trim();
    const hStr = line.substring(91, 97).trim();
    const kStr = line.substring(96, 102).trim();
    const nameStr = line.substring(102).trim();

    const q = parseFloat(qStr);
    const e = parseFloat(eStr);
    const inc = parseFloat(incStr);
    const omega = parseFloat(omegaStr);
    const node = parseFloat(nodeStr);
    const H = parseFloat(hStr) || 10.0;
    const K = parseFloat(kStr) || 10.0;

    if (Number.isNaN(q) || Number.isNaN(e)) return null;

    const year = parseInt(perihelionDateStr.substring(0, 4), 10);
    const month = parseInt(perihelionDateStr.substring(4, 6), 10);
    const day = parseFloat(perihelionDateStr.substring(6));
    const perihelionJD = dateToJulian(year, month, day);

    let epochJD = perihelionJD;
    if (epochStr.length >= 8) {
      const epochYear = parseInt(epochStr.substring(0, 4), 10);
      const epochMonth = parseInt(epochStr.substring(4, 6), 10);
      const epochDay = parseFloat(epochStr.substring(6));
      if (!Number.isNaN(epochYear)) {
        epochJD = dateToJulian(epochYear, epochMonth, epochDay);
      }
    }

    // Parse designation and name
    let designation = nameStr;
    let name = nameStr;
    if (nameStr.includes('(') && nameStr.includes(')')) {
      const parenStart = nameStr.indexOf('(');
      const parenEnd = nameStr.lastIndexOf(')');
      designation = nameStr.substring(0, parenStart).trim();
      name = nameStr.substring(parenStart + 1, parenEnd);
    } else if (nameStr.includes('/')) {
      const slashIndex = nameStr.indexOf('/');
      designation = nameStr.substring(0, slashIndex);
      name = nameStr.substring(slashIndex + 1);
    }

    return {
      designation,
      name: name || designation,
      perihelionDistance: q,
      eccentricity: e,
      inclination: Number.isNaN(inc) ? 0 : inc,
      longitudeOfAscendingNode: Number.isNaN(node) ? 0 : node,
      argumentOfPerihelion: Number.isNaN(omega) ? 0 : omega,
      perihelionTime: perihelionJD,
      absoluteMagnitude: H,
      slopeParameter: K,
      isInterstellar: e > 1.0,
      epochJD,
    };
  } catch {
    return null;
  }
}

async function fetchCometData() {
  console.log('Fetching comet orbital elements...');

  const response = await fetch(MPC_COMET_URL);
  if (!response.ok) {
    throw new Error(`MPC CometEls ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.split('\n');
  const comets = [];

  for (const line of lines) {
    const comet = parseMPCCometLine(line);
    if (comet) {
      comets.push(comet);
    }
  }

  console.log(`  parsed ${comets.length} comets from ${lines.length} lines`);
  return comets;
}

// ─── Asteroid Physical Data (hardcoded from JPL SBDB) ──────────────────────

function getAsteroidData() {
  console.log('Writing asteroid physical data...');
  return {
    vesta: { diameter: 525.4, albedo: 0.4228, spectralType: 'V', rotationPeriod: 5.3421 },
    pallas: { diameter: 513, albedo: 0.101, spectralType: 'B', rotationPeriod: 7.8132 },
    juno: { diameter: 233.92, albedo: 0.2383, spectralType: 'S', rotationPeriod: 7.21 },
    hygiea: { diameter: 433, albedo: 0.0717, spectralType: 'C', rotationPeriod: 27.659 },
  };
}

// ─── DONKI Space Weather (NASA) ─────────────────────────────────────────────

const DONKI_BASE_URL = 'https://api.nasa.gov/DONKI';

async function fetchDonkiData() {
  console.log('Fetching DONKI space weather data...');

  const today = new Date();
  const pastWeek = new Date(today);
  pastWeek.setDate(pastWeek.getDate() - 7);
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + 3);

  const gstUrl = `${DONKI_BASE_URL}/GST?startDate=${formatDate(pastWeek)}&endDate=${formatDate(futureDate)}&api_key=${NASA_API_KEY}`;
  const flrUrl = `${DONKI_BASE_URL}/FLR?startDate=${formatDate(pastWeek)}&endDate=${formatDate(today)}&api_key=${NASA_API_KEY}`;

  const [gstResponse, flrResponse] = await Promise.all([fetch(gstUrl), fetch(flrUrl)]);

  if (!gstResponse.ok && !flrResponse.ok) {
    throw new Error(
      `DONKI API failed: GST ${gstResponse.status}, FLR ${flrResponse.status}`
    );
  }

  const gstData = gstResponse.ok ? await gstResponse.json() : [];
  const flrData = flrResponse.ok ? await flrResponse.json() : [];

  const geomagneticStorms = Array.isArray(gstData)
    ? gstData.map((gst) => ({
        gstID: gst.gstID,
        startTime: gst.startTime,
        kpIndexes: (gst.allKpIndex || []).map((kp) => ({
          observedTime: kp.observedTime,
          kpIndex: kp.kpIndex,
          source: kp.source,
        })),
        maxKp: Math.max(0, ...(gst.allKpIndex || []).map((kp) => kp.kpIndex)),
      }))
    : [];

  const solarFlares = Array.isArray(flrData)
    ? flrData
        .filter((flr) => {
          const cls = flr.classType || '';
          return cls.startsWith('M') || cls.startsWith('X');
        })
        .map((flr) => ({
          flrID: flr.flrID,
          classType: flr.classType,
          beginTime: flr.beginTime,
          peakTime: flr.peakTime || flr.beginTime,
        }))
    : [];

  console.log(
    `  ${geomagneticStorms.length} storms, ${solarFlares.length} M/X-class flares`
  );

  return {
    geomagneticStorms,
    solarFlares,
    fetchedAt: new Date().toISOString(),
  };
}

// ─── JPL Horizons Ephemeris (high-precision planet positions) ────────────────

const HORIZONS_API_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';

/**
 * JPL Horizons body IDs for planets + Pluto + notable asteroids
 */
const HORIZONS_TARGETS = [
  { id: '199', name: 'Mercury' },
  { id: '299', name: 'Venus' },
  { id: '499', name: 'Mars' },
  { id: '599', name: 'Jupiter' },
  { id: '699', name: 'Saturn' },
  { id: '799', name: 'Uranus' },
  { id: '899', name: 'Neptune' },
  { id: '999', name: 'Pluto' },
  { id: '4', name: 'Vesta' },       // asteroid
  { id: '2', name: 'Pallas' },      // asteroid
];

/**
 * Fetch ephemeris from JPL Horizons for a single body.
 * Returns hourly RA/Dec/magnitude/illumination for the next 30 days.
 * Horizons API has a one-request-at-a-time limit, so we serialize calls.
 */
async function fetchHorizonsBody(bodyId, bodyName, startDate, stopDate) {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: `'${bodyId}'`,
    EPHEM_TYPE: 'OBSERVER',
    CENTER: "'500'",            // geocentric (no specific site)
    START_TIME: `'${formatDate(startDate)}'`,
    STOP_TIME: `'${formatDate(stopDate)}'`,
    STEP_SIZE: "'1 h'",
    QUANTITIES: "'1,9'",        // 1=RA/Dec, 9=visual magnitude
  });

  const response = await fetch(`${HORIZONS_API_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Horizons API ${response.status} for ${bodyName}`);
  }

  const json = await response.json();
  const result = json.result;
  if (!result) {
    throw new Error(`No result field for ${bodyName}`);
  }

  // Parse the ephemeris table from the text result
  const soeIndex = result.indexOf('$$SOE');
  const eoeIndex = result.indexOf('$$EOE');
  if (soeIndex < 0 || eoeIndex < 0) {
    throw new Error(`No ephemeris data block for ${bodyName}`);
  }

  const dataBlock = result.substring(soeIndex + 5, eoeIndex).trim();
  const dataLines = dataBlock.split('\n').filter((l) => l.trim().length > 0);

  const entries = [];
  for (const line of dataLines) {
    // Horizons columns vary; parse positionally
    // Typical format: date, RA(h m s), DEC(d m s), mag, ...
    const parts = line.trim().split(/\s+/);
    if (parts.length < 8) continue;

    // Date is in first two columns (YYYY-Mon-DD HH:MM)
    const dateStr = `${parts[0]} ${parts[1]}`;

    // RA in hours, minutes, seconds (cols 2,3,4)
    const raH = parseFloat(parts[2]);
    const raM = parseFloat(parts[3]);
    const raS = parseFloat(parts[4]);
    if (Number.isNaN(raH) || Number.isNaN(raM) || Number.isNaN(raS)) continue;
    const ra = raH + raM / 60 + raS / 3600; // hours

    // Dec in degrees, minutes, seconds (cols 5,6,7)
    const decD = parseFloat(parts[5]);
    const decM = parseFloat(parts[6]);
    const decS = parseFloat(parts[7]);
    if (Number.isNaN(decD) || Number.isNaN(decM) || Number.isNaN(decS)) continue;
    const decSign = parts[5].startsWith('-') ? -1 : 1;
    const dec = decSign * (Math.abs(decD) + decM / 60 + decS / 3600); // degrees

    // Magnitude (col 8, may be 'n.a.')
    const mag = parseFloat(parts[8]);

    entries.push({
      date: dateStr,
      ra: Math.round(ra * 10000) / 10000,
      dec: Math.round(dec * 10000) / 10000,
      mag: Number.isNaN(mag) ? null : Math.round(mag * 100) / 100,
    });
  }

  return {
    name: bodyName,
    bodyId,
    entries,
  };
}

async function fetchHorizonsData() {
  console.log('Fetching JPL Horizons ephemerides...');

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 30);

  const ephemerides = [];

  // Serialize requests (Horizons has one-at-a-time limit)
  for (const target of HORIZONS_TARGETS) {
    try {
      console.log(`  fetching ${target.name}...`);
      const data = await fetchHorizonsBody(target.id, target.name, today, endDate);
      ephemerides.push(data);
      console.log(`    got ${data.entries.length} data points`);

      // Small delay to be polite to JPL servers
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`    ${target.name} failed: ${err.message}`);
      // Continue with other targets
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    startDate: formatDate(today),
    endDate: formatDate(endDate),
    bodies: ephemerides,
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== NightSeek Astronomy Data Fetch ===\n');

  const hashes = {};
  const errors = [];

  // NEO data
  try {
    const neo = await fetchNeoData();
    const content = safeWrite('neo.json', neo);
    hashes['neo.json'] = sha256(content);
  } catch (err) {
    console.error(`  NEO fetch failed: ${err.message}`);
    errors.push(`neo: ${err.message}`);
  }

  // Comet data
  try {
    const comets = await fetchCometData();
    const content = safeWrite('comets.json', comets);
    hashes['comets.json'] = sha256(content);
  } catch (err) {
    console.error(`  Comet fetch failed: ${err.message}`);
    errors.push(`comets: ${err.message}`);
  }

  // DONKI space weather data
  try {
    const donki = await fetchDonkiData();
    const content = safeWrite('donki.json', donki);
    hashes['donki.json'] = sha256(content);
  } catch (err) {
    console.error(`  DONKI fetch failed: ${err.message}`);
    errors.push(`donki: ${err.message}`);
  }

  // Asteroid data (never fails — hardcoded)
  const asteroids = getAsteroidData();
  const asteroidContent = safeWrite('asteroids.json', asteroids);
  hashes['asteroids.json'] = sha256(asteroidContent);

  // JPL Horizons ephemeris data
  try {
    const ephemeris = await fetchHorizonsData();
    const content = safeWrite('ephemeris.json', ephemeris);
    hashes['ephemeris.json'] = sha256(content);
  } catch (err) {
    console.error(`  Horizons fetch failed: ${err.message}`);
    errors.push(`horizons: ${err.message}`);
  }

  // Write meta
  const meta = {
    fetchedAt: new Date().toISOString(),
    hashes,
    errors: errors.length > 0 ? errors : undefined,
  };
  safeWrite('meta.json', meta);

  console.log(`\nDone. ${errors.length > 0 ? `${errors.length} error(s).` : 'All sources succeeded.'}`);

  // Exit with error if most sources failed (partial success is OK)
  if (errors.length >= 4) {
    process.exit(1);
  }
}

main();
