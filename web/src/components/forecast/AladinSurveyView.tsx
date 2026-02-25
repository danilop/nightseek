import type { AladinInstance } from 'aladin-lite';
import { useEffect, useRef, useState } from 'react';

interface AladinSurveyViewProps {
  ra: number; // hours
  dec: number; // degrees
  fovArcmin: number;
  objectName: string;
}

function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

export default function AladinSurveyView({
  ra,
  dec,
  fovArcmin,
  objectName,
}: AladinSurveyViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const aladinRef = useRef<AladinInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  const raDeg = ra * 15;
  const fovDeg = fovArcmin / 60;

  useEffect(() => {
    if (!containerRef.current || initRef.current) return;
    initRef.current = true;

    if (!hasWebGL2()) {
      setError('Your browser does not support WebGL2');
      setLoading(false);
      return;
    }

    let destroyed = false;
    const container = containerRef.current;

    async function initAladin() {
      try {
        const A = (await import('aladin-lite')).default;
        await A.init;

        if (destroyed) return;

        const aladin = A.aladin(container, {
          survey: 'P/DSS2/color',
          fov: fovDeg,
          showCooGridControl: false,
          showSimbadPointerControl: false,
          showCooGrid: false,
          showShareControl: false,
          showSettingsControl: false,
          showLayersControl: false,
          showGotoControl: false,
          showZoomControl: false,
          showFullscreenControl: false,
          showFrame: false,
          showFov: false,
          showCooLocation: false,
          showProjectionControl: false,
          showContextMenu: false,
          showReticle: true,
          backgroundColor: 'rgb(15, 23, 42)',
        });

        aladin.gotoRaDec(raDeg, dec);
        aladinRef.current = aladin;
        setLoading(false);
      } catch {
        if (!destroyed) {
          setError('Failed to load sky survey viewer');
          setLoading(false);
        }
      }
    }

    initAladin();

    return () => {
      destroyed = true;
      if (aladinRef.current) {
        try {
          aladinRef.current.destroy();
        } catch {
          // Aladin may not support destroy cleanly
        }
        aladinRef.current = null;
      }
    };
  }, [raDeg, dec, fovDeg]);

  // Update position and FOV when props change (without re-initializing)
  useEffect(() => {
    if (!aladinRef.current) return;
    aladinRef.current.gotoRaDec(raDeg, dec);
    aladinRef.current.setFov(fovDeg);
  }, [raDeg, dec, fovDeg]);

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-night-900 py-16">
        <div className="text-center">
          <p className="text-gray-400 text-sm">{error}</p>
          <p className="mt-1 text-gray-500 text-xs">
            Survey viewer requires a browser with WebGL2 support
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-night-900">
          <div className="text-center">
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-sky-500 border-b-2" />
            <p className="text-gray-500 text-sm">Loading sky survey...</p>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        role="img"
        className="w-full overflow-hidden rounded-lg"
        style={{ height: 280 }}
        aria-label={`Sky survey image of ${objectName}`}
      />
    </div>
  );
}
