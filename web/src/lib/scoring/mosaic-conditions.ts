import type {
  ImagingWindow,
  MoonGradientWarning,
  MosaicConditionAssessment,
  MosaicTip,
  MosaicTipSeverity,
  NightWeather,
} from '@/types';
import { getMosaicFootprint } from './index';

interface MosaicConditionInput {
  mosaic: { cols: number; rows: number };
  fov: { width: number; height: number };
  moonIllumination: number; // 0-100
  moonSeparation: number | null; // degrees
  weather: NightWeather | null;
  imagingWindow: ImagingWindow | null;
}

const SEVERITY_ORDER: Record<MosaicTipSeverity, number> = {
  critical: 2,
  warning: 1,
  info: 0,
};

function worstSeverity(tips: MosaicTip[]): MosaicTipSeverity {
  let worst: MosaicTipSeverity = 'info';
  for (const tip of tips) {
    if (SEVERITY_ORDER[tip.severity] > SEVERITY_ORDER[worst]) {
      worst = tip.severity;
    }
  }
  return worst;
}

function assessMoonIllumination(moonIllumination: number): MosaicTip | null {
  if (moonIllumination >= 70) {
    return {
      id: 'moon-bright',
      category: 'moon',
      severity: 'critical',
      title: 'Bright moon',
      detail: 'Only Ha/SII narrowband will produce clean mosaic panels at this moon illumination.',
    };
  }
  if (moonIllumination >= 40) {
    return {
      id: 'moon-moderate',
      category: 'moon',
      severity: 'warning',
      title: 'Moderate moon',
      detail: 'Use narrowband or dual-band filters; broadband will show gradients between panels.',
    };
  }
  return null;
}

function assessMoonGradient(
  mosaic: { cols: number; rows: number },
  fov: { width: number; height: number },
  moonIllumination: number,
  moonSeparation: number | null
): { tip: MosaicTip | null; warning: MoonGradientWarning | null } {
  if (moonSeparation === null || moonSeparation === 0 || moonIllumination < 10) {
    return { tip: null, warning: null };
  }

  // Mosaic angular extent in degrees (diagonal) — uses actual footprint with overlap
  const footprint = getMosaicFootprint(mosaic, fov);
  const mosaicWidthDeg = footprint.width / 60;
  const mosaicHeightDeg = footprint.height / 60;
  const mosaicExtentDeg = Math.sqrt(mosaicWidthDeg ** 2 + mosaicHeightDeg ** 2);

  // Estimate brightness variation: panels at different distances from moon
  // see different sky brightness. Gradient delta approximated as
  // (mosaicExtent / moonSeparation) * (moonIllumination / 100) * 100%
  const gradientDeltaPercent = (mosaicExtentDeg / moonSeparation) * moonIllumination;

  if (gradientDeltaPercent <= 10) {
    return { tip: null, warning: null };
  }

  const isCritical = (moonSeparation < 45 && mosaicExtentDeg > 3) || gradientDeltaPercent > 30;
  const severity: MosaicTipSeverity = isCritical ? 'critical' : 'warning';

  const warning: MoonGradientWarning = {
    mosaicAngularExtentDeg: Math.round(mosaicExtentDeg * 10) / 10,
    moonSeparationDeg: Math.round(moonSeparation),
    gradientDeltaPercent: Math.round(gradientDeltaPercent),
    severity,
  };

  const tip: MosaicTip = {
    id: 'moon-gradient',
    category: 'gradient',
    severity,
    title: 'Moon gradient across mosaic',
    detail: `~${warning.gradientDeltaPercent}% brightness variation across ${warning.mosaicAngularExtentDeg}° mosaic extent with moon ${warning.moonSeparationDeg}° away.`,
  };

  return { tip, warning };
}

function getHourlyDataInWindow(
  hourlyData: Map<number, { cloudCover: number; humidity: number | null }>,
  imagingWindow: ImagingWindow
): Array<{ cloudCover: number; humidity: number | null }> {
  const startMs = imagingWindow.start.getTime();
  const endMs = imagingWindow.end.getTime();
  const entries: Array<{ cloudCover: number; humidity: number | null }> = [];

  for (const [epochMs, data] of hourlyData) {
    if (epochMs >= startMs && epochMs <= endMs) {
      entries.push(data);
    }
  }
  return entries;
}

function assessWeatherVariability(
  weather: NightWeather | null,
  imagingWindow: ImagingWindow | null
): MosaicTip[] {
  const tips: MosaicTip[] = [];
  if (!weather) return tips;

  // Cloud cover variability within imaging window
  if (imagingWindow && weather.hourlyData.size > 0) {
    const windowData = getHourlyDataInWindow(weather.hourlyData, imagingWindow);

    if (windowData.length >= 2) {
      const cloudValues = windowData.map(d => d.cloudCover);
      const mean = cloudValues.reduce((a, b) => a + b, 0) / cloudValues.length;
      const variance =
        cloudValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / cloudValues.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev > 20) {
        tips.push({
          id: 'weather-variable',
          category: 'weather',
          severity: 'warning',
          title: 'Variable cloud cover',
          detail:
            'Cloud cover changes significantly during the imaging window, causing background mismatches between panels.',
        });
      }
    }
  }

  // High humidity amplifies scatter
  if (weather.avgHumidity !== null && weather.avgHumidity > 80) {
    tips.push({
      id: 'weather-humidity',
      category: 'weather',
      severity: 'info',
      title: 'High humidity',
      detail: 'Humidity above 80% amplifies light scatter, making panel matching harder.',
    });
  }

  return tips;
}

function getTechniqueTips(mosaic: { cols: number; rows: number }, hasTips: boolean): MosaicTip[] {
  // Only include technique tips when there are condition-specific tips
  if (!hasTips) return [];

  const tips: MosaicTip[] = [];
  const totalPanels = mosaic.cols * mosaic.rows;

  if (totalPanels >= 4) {
    tips.push({
      id: 'technique-cycling',
      category: 'technique',
      severity: 'info',
      title: 'Panel cycling',
      detail:
        'For large mosaics, cycle through panels rather than completing each one sequentially to minimize gradient drift.',
    });
  }

  return tips;
}

export function assessMosaicConditions(
  input: MosaicConditionInput
): MosaicConditionAssessment | null {
  const { mosaic, fov, moonIllumination, moonSeparation, weather, imagingWindow } = input;

  const tips: MosaicTip[] = [];

  // Moon illumination assessment
  const moonTip = assessMoonIllumination(moonIllumination);
  if (moonTip) tips.push(moonTip);

  // Moon gradient assessment
  const { tip: gradientTip, warning: moonGradientWarning } = assessMoonGradient(
    mosaic,
    fov,
    moonIllumination,
    moonSeparation
  );
  if (gradientTip) tips.push(gradientTip);

  // Weather variability
  const weatherTips = assessWeatherVariability(weather, imagingWindow);
  tips.push(...weatherTips);

  // Technique tips (only when there are condition-specific tips already)
  const conditionTipCount = tips.length;
  const techniqueTips = getTechniqueTips(mosaic, conditionTipCount > 0);
  tips.push(...techniqueTips);

  // No tips = no panel
  if (tips.length === 0) return null;

  // Sort by severity (critical first)
  tips.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);

  return {
    overallSeverity: worstSeverity(tips),
    tips,
    moonGradientWarning: moonGradientWarning ?? null,
  };
}
