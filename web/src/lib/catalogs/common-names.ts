/**
 * Common names for well-known NGC/IC objects
 * Merged from both CLI and Web to ensure consistent search results
 */
const COMMON_NAMES: Record<string, string> = {
  // Galaxies
  'NGC 224': 'Andromeda Galaxy',
  'NGC 253': 'Sculptor Galaxy',
  'NGC 598': 'Triangulum Galaxy',
  'NGC 2683': 'UFO Galaxy',
  'NGC 3031': "Bode's Galaxy",
  'NGC 3034': 'Cigar Galaxy',
  'NGC 3556': 'Surfboard Galaxy',
  'NGC 4038': 'Antennae Galaxies',
  'NGC 4039': 'Antennae Galaxies',
  'NGC 4258': 'Messier 106',
  'NGC 4486': 'Virgo A',
  'NGC 4565': 'Needle Galaxy',
  'NGC 4594': 'Sombrero Galaxy',
  'NGC 4631': 'Whale Galaxy',
  'NGC 4656': 'Hockey Stick Galaxy',
  'NGC 4736': "Cat's Eye Galaxy",
  'NGC 4826': 'Black Eye Galaxy',
  'NGC 5128': 'Centaurus A',
  'NGC 5194': 'Whirlpool Galaxy',
  'NGC 5195': 'Whirlpool Galaxy Companion',
  'NGC 5457': 'Pinwheel Galaxy',
  'NGC 5866': 'Spindle Galaxy',

  // Nebulae - Emission/Reflection
  'NGC 281': 'Pacman Nebula',
  'NGC 1333': 'NGC 1333 Nebula',
  'NGC 1499': 'California Nebula',
  'NGC 1952': 'Crab Nebula',
  'NGC 1976': 'Orion Nebula',
  'NGC 1982': "De Mairan's Nebula",
  'NGC 2024': 'Flame Nebula',
  'NGC 2070': 'Tarantula Nebula',
  'NGC 2174': 'Monkey Head Nebula',
  'NGC 2237': 'Rosette Nebula',
  'NGC 2264': 'Cone Nebula',
  'NGC 2359': "Thor's Helmet",
  'NGC 3372': 'Carina Nebula',
  'NGC 6188': 'Fighting Dragons Nebula',
  'NGC 6302': 'Bug Nebula',
  'NGC 6334': "Cat's Paw Nebula",
  'NGC 6357': 'War and Peace Nebula',
  'NGC 6514': 'Trifid Nebula',
  'NGC 6523': 'Lagoon Nebula',
  'NGC 6611': 'Eagle Nebula',
  'NGC 6618': 'Omega Nebula',
  'NGC 6888': 'Crescent Nebula',
  'NGC 6960': 'Western Veil Nebula',
  'NGC 6992': 'Eastern Veil Nebula',
  'NGC 6995': 'Network Nebula',
  'NGC 7000': 'North America Nebula',
  'NGC 7380': 'Wizard Nebula',
  'NGC 7635': 'Bubble Nebula',

  // Planetary Nebulae
  'NGC 650': 'Little Dumbbell Nebula',
  'NGC 2392': 'Eskimo Nebula',
  'NGC 3132': 'Eight-Burst Nebula',
  'NGC 3242': 'Ghost of Jupiter',
  'NGC 3587': 'Owl Nebula',
  'NGC 6210': 'Turtle Nebula',
  'NGC 6543': "Cat's Eye Nebula",
  'NGC 6720': 'Ring Nebula',
  'NGC 6751': 'Glowing Eye Nebula',
  'NGC 6826': 'Blinking Planetary',
  'NGC 6853': 'Dumbbell Nebula',
  'NGC 7009': 'Saturn Nebula',
  'NGC 7027': 'Magic Carpet Nebula',
  'NGC 7293': 'Helix Nebula',
  'NGC 7662': 'Blue Snowball Nebula',

  // Open Clusters
  'NGC 869': 'Double Cluster (h)',
  'NGC 884': 'Double Cluster (chi)',
  'NGC 1912': 'Starfish Cluster',
  'NGC 1960': 'Pinwheel Cluster',
  'NGC 2099': 'Salt and Pepper Cluster',
  'NGC 2244': 'Rosette Cluster',
  'NGC 2632': 'Beehive Cluster',
  'NGC 3603': 'NGC 3603 Cluster',
  'NGC 6405': 'Butterfly Cluster',
  'NGC 6530': 'Lagoon Cluster',
  'NGC 6705': 'Wild Duck Cluster',

  // Globular Clusters
  'NGC 104': '47 Tucanae',
  'NGC 362': 'NGC 362 Cluster',
  'NGC 5139': 'Omega Centauri',
  'NGC 6093': 'Messier 80',
  'NGC 6205': 'Hercules Cluster',
  'NGC 6341': 'Messier 92',
  'NGC 6397': 'Caldwell 86',
  'NGC 6752': 'Caldwell 93',
  'NGC 6779': 'Messier 56',
  'NGC 6809': 'Messier 55',
  'NGC 7078': 'Great Pegasus Cluster',
  'NGC 7331': 'Deer Lick Group',
  'NGC 7789': "Caroline's Rose",

  // IC Objects
  'IC 434': 'Horsehead Nebula',
  'IC 1318': 'Sadr Region',
  'IC 1396': "Elephant's Trunk Nebula",
  'IC 1805': 'Heart Nebula',
  'IC 1848': 'Soul Nebula',
  'IC 2118': 'Witch Head Nebula',
  'IC 2177': 'Seagull Nebula',
  'IC 4604': 'Rho Ophiuchi Complex',
  'IC 4703': 'Eagle Nebula',
  'IC 5067': 'Pelican Nebula',
  'IC 5070': 'Pelican Nebula',
  'IC 5146': 'Cocoon Nebula',
};

/**
 * Get common name for an object, or return the original name
 * Handles various formats: "NGC3031", "NGC 3031", "NGC0224", "NGC 224"
 */
export function getCommonName(ngcName: string): string | null {
  // Try exact match first
  if (COMMON_NAMES[ngcName]) {
    return COMMON_NAMES[ngcName];
  }

  // Normalize: add space after NGC/IC if missing, and remove leading zeros
  const normalized = ngcName
    .replace(/^(NGC|IC)(\d)/, '$1 $2') // Add space: NGC3031 -> NGC 3031
    .replace(/^(NGC|IC) 0+(\d)/, '$1 $2'); // Remove leading zeros: NGC 0224 -> NGC 224

  return COMMON_NAMES[normalized] ?? null;
}

/**
 * Messier objects not in NGC/IC catalog
 */
export const MESSIER_EXTRAS = [
  {
    name: 'M45',
    commonName: 'Pleiades',
    raHours: 3.7833,
    decDegrees: 24.1167,
    magnitude: 1.6,
    type: 'OCl',
    sizeArcmin: 110,
  },
  {
    name: 'M40',
    commonName: 'Winnecke 4',
    raHours: 12.3667,
    decDegrees: 58.0833,
    magnitude: 8.4,
    type: '**',
    sizeArcmin: 0.8,
  },
];
