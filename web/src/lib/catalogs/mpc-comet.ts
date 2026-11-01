/**
 * Parsed comet from MPC data
 */
export interface ParsedComet {
  designation: string;
  name: string;
  perihelionDistance: number; // q in AU
  eccentricity: number;
  inclination: number; // degrees
  longitudeOfAscendingNode: number; // degrees
  argumentOfPerihelion: number; // degrees
  perihelionTime: number; // Julian date
  absoluteMagnitude: number | null; // total absolute magnitude H
  slopeParameter: number | null; // MPC brightness exponent n, typically 4
  isInterstellar: boolean;
  epochJD: number;
  dataRetrievedAt?: string;
}

/** MPC interstellar designations use a numbered I/ prefix (for example 2I/Borisov). */
export function isInterstellarDesignation(designation: string): boolean {
  return /^\d+I(?:\/|$)/i.test(designation.trim());
}

/**
 * Parse MPC comet designation and name
 * Examples:
 *   "C/2023 A3 (Tsuchinshan-ATLAS)" -> code="C/2023 A3", name="Tsuchinshan-ATLAS"
 *   "12P/Pons-Brooks" -> code="12P", name="Pons-Brooks"
 */
function parseCometName(fullDesignation: string): { designation: string; name: string } {
  // MPC appends a publication reference in a distant fixed-width column.
  const catalogName = fullDesignation.trim().split(/\s{2,}/, 1)[0];

  // Check for name in parentheses
  if (catalogName.includes('(') && catalogName.includes(')')) {
    const parenStart = catalogName.indexOf('(');
    const parenEnd = catalogName.lastIndexOf(')');
    const code = catalogName.substring(0, parenStart).trim();
    const name = catalogName.substring(parenStart + 1, parenEnd);
    return { designation: code, name };
  }

  // Unnamed provisional objects must retain their full unique designation.
  if (/^[ACPID]\/\d{4}\s+[A-Z]\d+/i.test(catalogName)) {
    return { designation: catalogName, name: catalogName };
  }

  // Check for periodic comet format (e.g., "12P/Pons-Brooks")
  if (catalogName.includes('/')) {
    const slashIndex = catalogName.indexOf('/');
    const code = catalogName.substring(0, slashIndex);
    const name = catalogName.substring(slashIndex + 1);
    return { designation: code, name };
  }

  return { designation: catalogName, name: catalogName };
}

/**
 * Parse MPC comet elements format
 * Shared by the browser and the Node 24 catalogue updater.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: fixed-width MPC parsing validates each independent field
export function parseMPCCometLine(line: string): ParsedComet | null {
  try {
    // Skip header lines and empty lines
    if (line.trim().length < 100 || line.startsWith('#') || line.startsWith('Num')) {
      return null;
    }

    // Zero-based bounds from https://minorplanetcenter.net/iau/info/CometOrbitFormat.html
    const perihelionDateStr = line.substring(14, 29).trim();
    const qStr = line.substring(30, 39).trim();
    const eStr = line.substring(41, 49).trim();
    const omegaStr = line.substring(51, 59).trim();
    const nodeStr = line.substring(61, 69).trim();
    const incStr = line.substring(71, 79).trim();
    const epochStr = line.substring(81, 89).trim();
    const hStr = line.substring(91, 95).trim();
    const kStr = line.substring(96, 100).trim();
    const nameStr = line.substring(102).trim();

    const q = parseFloat(qStr);
    const e = parseFloat(eStr);
    const inc = parseFloat(incStr);
    const omega = parseFloat(omegaStr);
    const node = parseFloat(nodeStr);
    const parsedH = parseFloat(hStr);
    const parsedK = parseFloat(kStr);
    const H = Number.isFinite(parsedH) ? parsedH : null;
    const K = Number.isFinite(parsedK) ? parsedK : null;

    if (Number.isNaN(q) || Number.isNaN(e)) {
      return null;
    }

    // Parse perihelion date (YYYYMMDD.dddd format)
    const perihelionParts = perihelionDateStr.split(/\s+/);
    if (perihelionParts.length !== 3) return null;
    const year = parseInt(perihelionParts[0], 10);
    const month = parseInt(perihelionParts[1], 10);
    const day = parseFloat(perihelionParts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

    // Convert the fractional calendar day to Julian date.
    const perihelionJD = dateToJulian(year, month, day);

    // Parse epoch
    let epochJD = perihelionJD;
    if (epochStr.length >= 8) {
      const epochYear = parseInt(epochStr.substring(0, 4), 10);
      const epochMonth = parseInt(epochStr.substring(4, 6), 10);
      const epochDay = parseFloat(epochStr.substring(6));
      if (Number.isFinite(epochYear) && Number.isFinite(epochMonth) && Number.isFinite(epochDay)) {
        epochJD = dateToJulian(epochYear, epochMonth, epochDay);
      }
    }

    const { designation, name } = parseCometName(nameStr);

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
      isInterstellar: isInterstellarDesignation(designation),
      epochJD,
    };
  } catch {
    return null;
  }
}

/**
 * Convert date to Julian date
 */
function dateToJulian(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}
