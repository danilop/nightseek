/** Human-readable credits complement the notices generated from bundled dependencies. */
export interface Credit {
  name: string;
  url: string;
  contribution: string;
  notice?: string;
  noticeUrl?: string;
}

export const LIBRARY_CREDITS: Credit[] = [
  {
    name: 'Astronomy Engine',
    url: 'https://github.com/cosinekitty/astronomy',
    contribution: 'Don Cross and contributors · celestial positions and astronomical events.',
    notice: 'MIT',
    noticeUrl: 'https://github.com/cosinekitty/astronomy/blob/master/LICENSE',
  },
  {
    name: 'Aladin Lite',
    url: 'https://aladin.cds.unistra.fr/AladinLite/',
    contribution:
      'CDS, Strasbourg · interactive sky surveys. Survey images have their own provider credits.',
    notice: 'LGPL-3.0-or-later · source & license',
    noticeUrl: 'https://github.com/cds-astro/aladin-lite',
  },
  {
    name: 'satellite.js',
    url: 'https://github.com/shashwatak/satellite-js',
    contribution: 'Satellite propagation and observing geometry.',
    notice: 'MIT',
  },
  {
    name: 'D3 & D3 Celestial',
    url: 'https://github.com/ofrohn/d3-celestial',
    contribution: 'Mike Bostock, Olaf Frohn and contributors · sky charts and chart catalogues.',
    notice: 'BSD-3-Clause · chart credits',
    noticeUrl: 'https://github.com/ofrohn/d3-celestial/blob/master/LICENSE',
  },
  {
    name: 'React & React DOM',
    url: 'https://react.dev/',
    contribution: 'The shared web and mobile interface.',
    notice: 'MIT',
  },
  {
    name: 'Capacitor & plugins',
    url: 'https://capacitorjs.com/',
    contribution: 'The native app, location, notifications, sharing and device features.',
    notice: 'MIT',
  },
  {
    name: 'Tailwind CSS',
    url: 'https://tailwindcss.com/',
    contribution: 'Responsive layout and styling.',
    notice: 'MIT',
  },
  {
    name: 'Lucide',
    url: 'https://lucide.dev/',
    contribution: 'Interface icons, including contributions from the Feather icon project.',
    notice: 'ISC · icon notices',
    noticeUrl: 'https://lucide.dev/license',
  },
  {
    name: 'dnd kit',
    url: 'https://dndkit.com/',
    contribution: 'Reordering target categories.',
    notice: 'MIT',
  },
  {
    name: 'date-fns & date-fns-tz',
    url: 'https://github.com/marnusw/date-fns-tz',
    contribution: 'Date formatting and observing-site time zones.',
    notice: 'MIT',
  },
  {
    name: 'idb-keyval',
    url: 'https://github.com/jakearchibald/idb-keyval',
    contribution: 'Local IndexedDB storage and caching.',
    notice: 'Apache-2.0',
  },
  {
    name: 'Vite, Vite PWA & Workbox',
    url: 'https://vite-pwa-org.netlify.app/',
    contribution: 'App builds, installation and offline caching.',
  },
  {
    name: 'TypeScript, Vitest, Testing Library, Playwright & Biome',
    url: 'https://www.typescriptlang.org/',
    contribution: 'The tools and communities that help us build and check NightSeek.',
  },
];

export const DATA_CREDITS: Credit[] = [
  {
    name: 'Open-Meteo',
    url: 'https://open-meteo.com/',
    contribution:
      'Weather, air quality and historical cloud data, with thanks to the contributing weather services. NightSeek aggregates these into observing windows and estimates.',
    notice: 'CC BY 4.0 · provider attribution',
    noticeUrl: 'https://open-meteo.com/en/licence',
  },
  {
    name: 'OpenNGC',
    url: 'https://github.com/mattiaverga/OpenNGC',
    contribution:
      'Mattia Verga and contributors · deep-sky catalogue. NightSeek selects, reformats and derives observing information from its entries.',
    notice: 'CC BY-SA 4.0',
    noticeUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    name: 'NASA & JPL',
    url: 'https://ssd.jpl.nasa.gov/',
    contribution:
      'Horizons and the Small-Body Database, plus NASA NeoWs and DONKI data for small bodies and space-weather context.',
  },
  {
    name: 'NOAA Space Weather Prediction Center',
    url: 'https://www.swpc.noaa.gov/',
    contribution: 'Geomagnetic measurements, Kp forecast periods and space-weather outlooks.',
  },
  {
    name: 'Minor Planet Center',
    url: 'https://www.minorplanetcenter.net/',
    contribution: 'Published comet orbital elements.',
  },
  {
    name: 'CelesTrak',
    url: 'https://celestrak.org/',
    contribution: 'Satellite orbital elements and their epochs.',
  },
  {
    name: 'ESA / Gaia / DPAC',
    url: 'https://www.cosmos.esa.int/gaia',
    contribution:
      'Gaia star data, processed by the Gaia Data Processing and Analysis Consortium, supported by national institutions participating in the Gaia Multilateral Agreement.',
    notice: 'Gaia acknowledgements',
    noticeUrl:
      'https://gea.esac.esa.int/archive/documentation/GDR3/Miscellaneous/sec_credit_and_citation_instructions/',
  },
  {
    name: 'CDS / VizieR & DSS',
    url: 'https://cds.unistra.fr/',
    contribution:
      'VizieR catalogue access and Aladin survey delivery. DSS imagery originates from the Digitized Sky Survey at STScI, based on photographic sky surveys.',
    notice: 'DSS acknowledgements',
    noticeUrl: 'https://archive.stsci.edu/dss/acknowledging.html',
  },
  {
    name: 'AAVSO / VSX',
    url: 'https://www.aavso.org/vsx/',
    contribution:
      'Reference information for notable variable stars. NightSeek derives approximate phases and brightness estimates.',
  },
  {
    name: 'IAU Meteor Data Center',
    url: 'https://www.ta3.sk/IAUC22DB/MDC2007/',
    contribution:
      'Meteor-shower reference information used in NightSeek’s curated shower catalogue.',
  },
  {
    name: 'OpenStreetMap contributors / Nominatim',
    url: 'https://www.openstreetmap.org/',
    contribution: 'Place search and reverse geocoding.',
    notice: '© OpenStreetMap contributors · ODbL',
    noticeUrl: 'https://www.openstreetmap.org/copyright',
  },
  {
    name: 'Where the ISS at?',
    url: 'https://wheretheiss.at/',
    contribution: 'Current ISS position information.',
  },
  {
    name: 'ipapi.co',
    url: 'https://ipapi.co/',
    contribution: 'Approximate location lookup when used by the web app.',
  },
  {
    name: 'ipwho.is',
    url: 'https://ipwho.is/',
    contribution: 'Fallback approximate location lookup when used by the web app.',
  },
];
