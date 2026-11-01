import type { DSOCatalogEntry, NightInfo, ObjectVisibility } from '@/types';
import { getCommonName } from '../catalogs/common-names';
import type { SkyCalculator } from './calculator';
import { getConstellation, getConstellationFullName } from './constellations';

export function calculateDSOVisibility(
  dso: DSOCatalogEntry,
  calculator: SkyCalculator,
  night: NightInfo
): ObjectVisibility {
  const name = dso.commonName || getCommonName(dso.name);
  const commonName =
    dso.messierNumber === null
      ? (name ?? dso.name)
      : `M${dso.messierNumber}${name ? ` ${name}` : ''}`;
  const visibility = calculator.calculateVisibility(
    dso.raHours,
    dso.decDegrees,
    night,
    dso.name,
    'dso',
    {
      magnitude: dso.magnitude,
      subtype: dso.type,
      angularSizeArcmin: dso.majorAxisArcmin ?? 0,
      minorAxisArcmin: dso.minorAxisArcmin ?? undefined,
      surfaceBrightness: dso.surfaceBrightness,
      commonName,
      isMessier: dso.messierNumber !== null,
      constellation: dso.constellation
        ? getConstellationFullName(dso.constellation)
        : getConstellation(dso.raHours, dso.decDegrees),
    }
  );
  visibility.magnitudeSource = dso.magnitudeSource;
  if (visibility.maxAltitudeTime) {
    visibility.hourAngle = calculator.getHourAngleForRA(
      dso.raHours,
      visibility.maxAltitudeTime,
      dso.decDegrees
    );
    visibility.meridianTransitTime =
      calculator.getMeridianTransitTimeForRA(
        dso.raHours,
        night.observingWindowStart,
        dso.decDegrees
      ) ?? undefined;
  }
  visibility.sunAngle = calculator.getSunAngleForPosition(
    dso.raHours,
    dso.decDegrees,
    night.observingWindowStart
  );
  return visibility;
}
