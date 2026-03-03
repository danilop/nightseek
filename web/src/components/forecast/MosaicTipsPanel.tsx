import { AlertTriangle, ChevronDown, Grid3X3, Lightbulb } from 'lucide-react';
import { useMemo, useState } from 'react';
import { assessMosaicConditions } from '@/lib/scoring/mosaic-conditions';
import type {
  ImagingWindow,
  MosaicConditionAssessment,
  MosaicTip,
  MosaicTipSeverity,
  NightInfo,
  NightWeather,
  ObjectVisibility,
} from '@/types';

interface MosaicTipsPanelProps {
  mosaic: { cols: number; rows: number };
  fov: { width: number; height: number };
  nightInfo: NightInfo;
  weather: NightWeather | null;
  visibility: ObjectVisibility;
}

const SEVERITY_BADGE: Record<MosaicTipSeverity, { label: string; className: string }> = {
  critical: {
    label: 'Challenging',
    className: 'bg-red-500/20 text-red-400',
  },
  warning: {
    label: 'Caution',
    className: 'bg-amber-500/20 text-amber-400',
  },
  info: {
    label: 'Good conditions',
    className: 'bg-green-500/20 text-green-400',
  },
};

function TipIcon({ severity }: { severity: MosaicTipSeverity }) {
  if (severity === 'critical') {
    return <AlertTriangle className="h-3 w-3 flex-shrink-0 text-red-400" />;
  }
  if (severity === 'warning') {
    return <AlertTriangle className="h-3 w-3 flex-shrink-0 text-amber-400" />;
  }
  return <Lightbulb className="h-3 w-3 flex-shrink-0 text-sky-400" />;
}

function TipRow({ tip }: { tip: MosaicTip }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <div className="mt-0.5">
        <TipIcon severity={tip.severity} />
      </div>
      <div className="min-w-0">
        <span className="font-medium text-gray-200">{tip.title}</span>
        <span className="text-gray-500"> — </span>
        <span className="line-clamp-2 text-gray-400">{tip.detail}</span>
      </div>
    </div>
  );
}

export default function MosaicTipsPanel({
  mosaic,
  fov,
  nightInfo,
  weather,
  visibility,
}: MosaicTipsPanelProps) {
  const assessment = useMemo<MosaicConditionAssessment | null>(
    () =>
      assessMosaicConditions({
        mosaic,
        fov,
        moonIllumination: nightInfo.moonIllumination,
        moonSeparation: visibility.moonSeparation,
        weather,
        imagingWindow: visibility.imagingWindow as ImagingWindow | null,
      }),
    [
      mosaic,
      fov,
      nightInfo.moonIllumination,
      visibility.moonSeparation,
      weather,
      visibility.imagingWindow,
    ]
  );

  const defaultExpanded = assessment !== null && assessment.overallSeverity !== 'info';
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!assessment) return null;

  const badge = SEVERITY_BADGE[assessment.overallSeverity];

  return (
    <div className="rounded-lg bg-night-800 p-3">
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex w-full items-center gap-2 text-left"
      >
        <Grid3X3 className="h-4 w-4 flex-shrink-0 text-sky-400" />
        <span className="font-medium text-gray-300 text-sm">Mosaic Tips</span>
        <span className={`rounded px-1.5 py-0.5 font-medium text-xs ${badge.className}`}>
          {badge.label}
        </span>
        <ChevronDown
          className={`ml-auto h-4 w-4 flex-shrink-0 text-gray-500 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {assessment.tips.map(tip => (
            <TipRow key={tip.id} tip={tip} />
          ))}
        </div>
      )}
    </div>
  );
}
