// Events module barrel export

export {
  detectConjunctions,
  hasNotableConjunction,
} from './conjunctions';

export {
  detectMeteorShowers,
  getAdjustedHourlyRate,
  METEOR_SHOWERS,
} from './meteor-showers';

export {
  searchNextLunarEclipse,
  searchNextSolarEclipse,
  getLunarEclipseForNight,
  getSolarEclipseForDate,
  describeLunarEclipse,
  describeSolarEclipse,
  detectEclipses,
} from './eclipses';

export {
  getSeasonsForYear,
  getNextSeasonalMarker,
  getCurrentSeason,
  describeSeasonalMarker,
  getSeasonalMarkerName,
  detectSeasonalMarkers,
} from './seasons';
