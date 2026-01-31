// Events module barrel export

export {
  detectConjunctions,
  hasNotableConjunction,
} from './conjunctions';
export {
  describeLunarEclipse,
  describeSolarEclipse,
  detectEclipses,
  getLunarEclipseForNight,
  getSolarEclipseForDate,
  searchNextLunarEclipse,
  searchNextSolarEclipse,
} from './eclipses';
export {
  detectMeteorShowers,
  getAdjustedHourlyRate,
  METEOR_SHOWERS,
} from './meteor-showers';

export {
  describeSeasonalMarker,
  detectSeasonalMarkers,
  getCurrentSeason,
  getNextSeasonalMarker,
  getSeasonalMarkerName,
  getSeasonsForYear,
} from './seasons';
