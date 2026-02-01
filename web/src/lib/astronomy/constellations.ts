import * as Astronomy from 'astronomy-engine';

/**
 * IAU constellation abbreviations to full names
 */
const CONSTELLATION_NAMES: Record<string, string> = {
  And: 'Andromeda',
  Ant: 'Antlia',
  Aps: 'Apus',
  Aqr: 'Aquarius',
  Aql: 'Aquila',
  Ara: 'Ara',
  Ari: 'Aries',
  Aur: 'Auriga',
  Boo: 'Boötes',
  Cae: 'Caelum',
  Cam: 'Camelopardalis',
  Cnc: 'Cancer',
  CVn: 'Canes Venatici',
  CMa: 'Canis Major',
  CMi: 'Canis Minor',
  Cap: 'Capricornus',
  Car: 'Carina',
  Cas: 'Cassiopeia',
  Cen: 'Centaurus',
  Cep: 'Cepheus',
  Cet: 'Cetus',
  Cha: 'Chamaeleon',
  Cir: 'Circinus',
  Col: 'Columba',
  Com: 'Coma Berenices',
  CrA: 'Corona Australis',
  CrB: 'Corona Borealis',
  Crv: 'Corvus',
  Crt: 'Crater',
  Cru: 'Crux',
  Cyg: 'Cygnus',
  Del: 'Delphinus',
  Dor: 'Dorado',
  Dra: 'Draco',
  Equ: 'Equuleus',
  Eri: 'Eridanus',
  For: 'Fornax',
  Gem: 'Gemini',
  Gru: 'Grus',
  Her: 'Hercules',
  Hor: 'Horologium',
  Hya: 'Hydra',
  Hyi: 'Hydrus',
  Ind: 'Indus',
  Lac: 'Lacerta',
  Leo: 'Leo',
  LMi: 'Leo Minor',
  Lep: 'Lepus',
  Lib: 'Libra',
  Lup: 'Lupus',
  Lyn: 'Lynx',
  Lyr: 'Lyra',
  Men: 'Mensa',
  Mic: 'Microscopium',
  Mon: 'Monoceros',
  Mus: 'Musca',
  Nor: 'Norma',
  Oct: 'Octans',
  Oph: 'Ophiuchus',
  Ori: 'Orion',
  Pav: 'Pavo',
  Peg: 'Pegasus',
  Per: 'Perseus',
  Phe: 'Phoenix',
  Pic: 'Pictor',
  Psc: 'Pisces',
  PsA: 'Piscis Austrinus',
  Pup: 'Puppis',
  Pyx: 'Pyxis',
  Ret: 'Reticulum',
  Sge: 'Sagitta',
  Sgr: 'Sagittarius',
  Sco: 'Scorpius',
  Scl: 'Sculptor',
  Sct: 'Scutum',
  Ser: 'Serpens',
  Sex: 'Sextans',
  Tau: 'Taurus',
  Tel: 'Telescopium',
  Tri: 'Triangulum',
  TrA: 'Triangulum Australe',
  Tuc: 'Tucana',
  UMa: 'Ursa Major',
  UMi: 'Ursa Minor',
  Vel: 'Vela',
  Vir: 'Virgo',
  Vol: 'Volans',
  Vul: 'Vulpecula',
};

/**
 * Convert 3-letter IAU abbreviation to full constellation name
 * @param abbrev 3-letter abbreviation (e.g., "Ori", "Cnc")
 * @returns Full name (e.g., "Orion", "Cancer") or original if not found
 */
export function getConstellationFullName(abbrev: string): string {
  return CONSTELLATION_NAMES[abbrev] || abbrev;
}

/**
 * Look up the constellation containing the given equatorial coordinates
 * @param raHours Right ascension in hours (0-24)
 * @param decDegrees Declination in degrees (-90 to +90)
 * @returns Constellation name (e.g., "Orion", "Leo", etc.)
 */
export function getConstellation(raHours: number, decDegrees: number): string {
  try {
    const constellation = Astronomy.Constellation(raHours * 15, decDegrees);
    return constellation.name;
  } catch (_error) {
    return 'Unknown';
  }
}

/**
 * Get constellation info with symbol
 * @param raHours Right ascension in hours (0-24)
 * @param decDegrees Declination in degrees (-90 to +90)
 * @returns Object with name and symbol
 */
export function getConstellationInfo(
  raHours: number,
  decDegrees: number
): { name: string; symbol: string } {
  try {
    const constellation = Astronomy.Constellation(raHours * 15, decDegrees);
    return {
      name: constellation.name,
      symbol: constellation.symbol,
    };
  } catch (_error) {
    return { name: 'Unknown', symbol: '?' };
  }
}

/**
 * Get constellation for a planet at a given time
 */
export function getPlanetConstellation(
  body: Astronomy.Body,
  time: Date,
  observer: Astronomy.Observer
): string {
  try {
    const equator = Astronomy.Equator(body, time, observer, true, true);
    return getConstellation(equator.ra, equator.dec);
  } catch (_error) {
    return 'Unknown';
  }
}
