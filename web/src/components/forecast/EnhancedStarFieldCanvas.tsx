import { useEffect, useRef, useState } from 'react';
import { getExtragalacticTypeInfo, getVariableTypeInfo } from '@/lib/gaia/enhanced-queries';
import type { EnhancedGaiaStarField, GaiaExtragalactic, GaiaVariableStar } from '@/types';

interface EnhancedStarFieldCanvasProps {
  starField: EnhancedGaiaStarField;
  fovWidth: number; // arcminutes
  fovHeight: number; // arcminutes
  objectSizeArcmin?: number; // angular size of the target object
  mosaic?: { cols: number; rows: number } | null;
}

interface OverlaySettings {
  showStars: boolean;
  showVariables: boolean;
  showGalaxies: boolean;
  showQSOs: boolean;
  showMosaic: boolean;
}

interface SelectedObject {
  type: 'variable' | 'extragalactic';
  data: GaiaVariableStar | GaiaExtragalactic;
  x: number;
  y: number;
}

// Color temperature mapping based on BP-RP color index
function getStarColor(bpRp: number | null): string {
  if (bpRp === null) return '#ffffff';
  if (bpRp < 0) return '#aaccff';
  if (bpRp < 0.5) return '#caddff';
  if (bpRp < 1.0) return '#ffffff';
  if (bpRp < 1.5) return '#fff4e8';
  if (bpRp < 2.0) return '#ffd9a0';
  return '#ffaa77';
}

// Calculate star radius based on magnitude
function getStarRadius(magnitude: number, minMag: number, maxMag: number): number {
  const normalized = (maxMag - magnitude) / (maxMag - minMag);
  return 1 + normalized * 3;
}

export default function EnhancedStarFieldCanvas({
  starField,
  fovWidth,
  fovHeight,
  objectSizeArcmin = 0,
  mosaic,
}: EnhancedStarFieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [overlays, setOverlays] = useState<OverlaySettings>({
    showStars: true,
    showVariables: true,
    showGalaxies: true,
    showQSOs: true,
    showMosaic: true,
  });
  const [selectedObject, setSelectedObject] = useState<SelectedObject | null>(null);

  // Toggle overlay visibility
  const toggleOverlay = (key: keyof OverlaySettings) => {
    setOverlays(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Canvas rendering requires multiple calculations
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get container dimensions — bail out if layout isn't ready
    const containerWidth = container.clientWidth;
    if (containerWidth <= 0 || fovWidth <= 0 || fovHeight <= 0) return;

    // When mosaic is active, zoom out so the full mosaic grid is visible
    const mosaicView = mosaic && overlays.showMosaic;
    const viewPadding = 1.15; // 15% padding around mosaic
    const viewWidthArcmin = mosaicView ? fovWidth * mosaic.cols * viewPadding : fovWidth;
    const viewHeightArcmin = mosaicView ? fovHeight * mosaic.rows * viewPadding : fovHeight;

    const aspectRatio = viewHeightArcmin / viewWidthArcmin;
    const canvasWidth = containerWidth;
    const canvasHeight = Math.round(containerWidth * aspectRatio);

    if (canvasWidth < 20 || canvasHeight < 20 || !Number.isFinite(canvasHeight)) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.scale(dpr, dpr);

    // Dark background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const { stars, variableStars, extragalacticObjects, centerRa, centerDec } = starField;

    if (stars.length === 0) {
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No star data available', canvasWidth / 2, canvasHeight / 2);
      return;
    }

    // Calculate magnitude range
    const magnitudes = stars.map(s => s.magnitude);
    const minMag = Math.min(...magnitudes);
    const maxMag = Math.max(...magnitudes);

    // View area in degrees (what the canvas represents)
    const viewWidthDeg = viewWidthArcmin / 60;
    const viewHeightDeg = viewHeightArcmin / 60;

    // RA/Dec to canvas coordinate converter (uses view dimensions)
    const raDecToCanvas = (ra: number, dec: number): { x: number; y: number } | null => {
      let deltaRa = ra - centerRa;
      if (deltaRa > 180) deltaRa -= 360;
      if (deltaRa < -180) deltaRa += 360;
      deltaRa *= Math.cos((centerDec * Math.PI) / 180);

      const deltaDec = dec - centerDec;

      const margin = 0.05;
      if (Math.abs(deltaRa) > (viewWidthDeg / 2) * (1 + margin)) return null;
      if (Math.abs(deltaDec) > (viewHeightDeg / 2) * (1 + margin)) return null;

      const x = canvasWidth / 2 - (deltaRa / viewWidthDeg) * canvasWidth;
      const y = canvasHeight / 2 - (deltaDec / viewHeightDeg) * canvasHeight;

      return { x, y };
    };

    // Draw stars
    if (overlays.showStars) {
      const sortedStars = [...stars].sort((a, b) => b.magnitude - a.magnitude);

      for (const star of sortedStars) {
        const pos = raDecToCanvas(star.ra, star.dec);
        if (!pos) continue;

        const radius = getStarRadius(star.magnitude, minMag, maxMag);
        const color = getStarColor(star.bpRp);

        // Draw glow for bright stars
        if (star.magnitude < minMag + 1) {
          const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius * 3);
          gradient.addColorStop(0, `${color}80`);
          gradient.addColorStop(1, `${color}00`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw variable stars overlay
    if (overlays.showVariables && variableStars.length > 0) {
      for (const varStar of variableStars) {
        const pos = raDecToCanvas(varStar.ra, varStar.dec);
        if (!pos) continue;

        const typeInfo = getVariableTypeInfo(varStar.variabilityType);

        // Draw pulsing ring
        ctx.strokeStyle = typeInfo.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.stroke();

        // Draw inner dot
        ctx.fillStyle = typeInfo.color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw extragalactic objects overlay
    if (extragalacticObjects.length > 0) {
      for (const obj of extragalacticObjects) {
        // Filter by type based on overlay settings
        if (obj.type === 'galaxy' && !overlays.showGalaxies) continue;
        if (obj.type === 'qso' && !overlays.showQSOs) continue;

        const pos = raDecToCanvas(obj.ra, obj.dec);
        if (!pos) continue;

        const typeInfo = getExtragalacticTypeInfo(obj.type);

        if (obj.type === 'qso') {
          // Draw diamond for QSO
          ctx.fillStyle = typeInfo.color;
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y - 5);
          ctx.lineTo(pos.x + 4, pos.y);
          ctx.lineTo(pos.x, pos.y + 5);
          ctx.lineTo(pos.x - 4, pos.y);
          ctx.closePath();
          ctx.fill();
        } else {
          // Draw ellipse for galaxy
          ctx.fillStyle = `${typeInfo.color}80`;
          ctx.strokeStyle = typeInfo.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(pos.x, pos.y, 6, 4, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // Pixel sizes for FOV and mosaic in current view
    const fovPixelW = (fovWidth / viewWidthArcmin) * canvasWidth;
    const fovPixelH = (fovHeight / viewHeightArcmin) * canvasHeight;

    // Draw mosaic grid (fully visible in zoomed-out view)
    if (mosaicView) {
      const mosaicW = mosaic.cols * fovPixelW;
      const mosaicH = mosaic.rows * fovPixelH;
      const mosaicX = (canvasWidth - mosaicW) / 2;
      const mosaicY = (canvasHeight - mosaicH) / 2;

      // Outer boundary
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(mosaicX, mosaicY, mosaicW, mosaicH);

      // Internal grid lines
      ctx.lineWidth = 0.75;
      for (let i = 1; i < mosaic.cols; i++) {
        const x = mosaicX + i * fovPixelW;
        ctx.beginPath();
        ctx.moveTo(x, mosaicY);
        ctx.lineTo(x, mosaicY + mosaicH);
        ctx.stroke();
      }
      for (let j = 1; j < mosaic.rows; j++) {
        const y = mosaicY + j * fovPixelH;
        ctx.beginPath();
        ctx.moveTo(mosaicX, y);
        ctx.lineTo(mosaicX + mosaicW, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Draw FOV rectangle
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    if (mosaicView) {
      // FOV is one panel, centered within the mosaic
      const fovX = (canvasWidth - fovPixelW) / 2;
      const fovY = (canvasHeight - fovPixelH) / 2;
      ctx.strokeRect(fovX, fovY, fovPixelW, fovPixelH);
    } else {
      const margin = 10;
      ctx.strokeRect(margin, margin, canvasWidth - margin * 2, canvasHeight - margin * 2);
    }
    ctx.setLineDash([]);

    // Draw object size circle at true scale (skip when mosaic view is active
    // since the mosaic grid already conveys the coverage)
    if (objectSizeArcmin > 0 && !mosaicView) {
      const objectSizeDeg = objectSizeArcmin / 60;
      const objectRadiusPx = ((objectSizeDeg / viewWidthDeg) * canvasWidth) / 2;

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(canvasWidth / 2, canvasHeight / 2, objectRadiusPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Crosshair
      const crossSize = 8;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(canvasWidth / 2 - crossSize, canvasHeight / 2);
      ctx.lineTo(canvasWidth / 2 + crossSize, canvasHeight / 2);
      ctx.moveTo(canvasWidth / 2, canvasHeight / 2 - crossSize);
      ctx.lineTo(canvasWidth / 2, canvasHeight / 2 + crossSize);
      ctx.stroke();
    }

    // Draw cardinal directions
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', canvasWidth / 2, 20);
    ctx.fillText('S', canvasWidth / 2, canvasHeight - 10);
    ctx.textAlign = 'left';
    ctx.fillText('E', 8, canvasHeight / 2);
    ctx.textAlign = 'right';
    ctx.fillText('W', canvasWidth - 8, canvasHeight / 2);
  }, [starField, fovWidth, fovHeight, objectSizeArcmin, mosaic, overlays]);

  const hasVariables = starField.variableStars.length > 0;
  const galaxyCount = starField.extragalacticObjects.filter(o => o.type === 'galaxy').length;
  const qsoCount = starField.extragalacticObjects.filter(o => o.type === 'qso').length;

  return (
    <div className="space-y-3">
      {/* Overlay Toggle Pills */}
      <div className="flex flex-wrap gap-2">
        <TogglePill
          label={`Stars (${starField.stars.length})`}
          active={overlays.showStars}
          onClick={() => toggleOverlay('showStars')}
          color="#ffffff"
        />
        {hasVariables && (
          <TogglePill
            label={`Variables (${starField.variableStars.length})`}
            active={overlays.showVariables}
            onClick={() => toggleOverlay('showVariables')}
            color="#fbbf24"
          />
        )}
        {galaxyCount > 0 && (
          <TogglePill
            label={`Galaxies (${galaxyCount})`}
            active={overlays.showGalaxies}
            onClick={() => toggleOverlay('showGalaxies')}
            color="#c084fc"
          />
        )}
        {qsoCount > 0 && (
          <TogglePill
            label={`QSOs (${qsoCount})`}
            active={overlays.showQSOs}
            onClick={() => toggleOverlay('showQSOs')}
            color="#22d3ee"
          />
        )}
        {mosaic && (
          <TogglePill
            label={`Mosaic (${mosaic.cols}\u00d7${mosaic.rows})`}
            active={overlays.showMosaic}
            onClick={() => toggleOverlay('showMosaic')}
            color="#f59e0b"
          />
        )}
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="w-full relative">
        <canvas ref={canvasRef} className="w-full rounded-lg" />

        {/* Selected Object Info Panel */}
        {selectedObject && (
          <ObjectInfoPanel object={selectedObject} onClose={() => setSelectedObject(null)} />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        {hasVariables && (
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full border-2 border-amber-400" />
            <span>Variable star</span>
          </div>
        )}
        {galaxyCount > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-purple-400">🌀</span>
            <span>Galaxy</span>
          </div>
        )}
        {qsoCount > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-cyan-400">◆</span>
            <span>Quasar</span>
          </div>
        )}
        {mosaic && (
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 border border-amber-500 border-dashed" />
            <span>Mosaic grid</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface TogglePillProps {
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
}

function TogglePill({ label, active, onClick, color }: TogglePillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-night-700 text-white border border-night-600'
          : 'bg-night-800 text-gray-500 border border-night-700'
      }`}
    >
      <span
        className="inline-block w-2 h-2 rounded-full mr-1.5"
        style={{ backgroundColor: active ? color : '#4b5563' }}
      />
      {label}
    </button>
  );
}

interface ObjectInfoPanelProps {
  object: SelectedObject;
  onClose: () => void;
}

function ObjectInfoPanel({ object, onClose }: ObjectInfoPanelProps) {
  if (object.type === 'variable') {
    const varStar = object.data as GaiaVariableStar;
    const typeInfo = getVariableTypeInfo(varStar.variabilityType);

    return (
      <div
        className="absolute bg-night-800 border border-night-600 rounded-lg p-3 shadow-lg z-10"
        style={{ left: object.x + 10, top: object.y - 40 }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-1 right-2 text-gray-500 hover:text-white"
        >
          ×
        </button>
        <div className="text-sm font-medium" style={{ color: typeInfo.color }}>
          {typeInfo.label}
        </div>
        {varStar.magnitude > 0 && (
          <div className="text-xs text-gray-400 mt-1">
            Magnitude: {varStar.magnitude.toFixed(1)}
          </div>
        )}
        {varStar.period && (
          <div className="text-xs text-gray-400">Period: {varStar.period.toFixed(2)} days</div>
        )}
        {varStar.amplitude && (
          <div className="text-xs text-gray-400">Amplitude: {varStar.amplitude.toFixed(2)} mag</div>
        )}
        <div className="text-xs text-gray-500 mt-1">{typeInfo.description}</div>
      </div>
    );
  }

  const extObj = object.data as GaiaExtragalactic;
  const typeInfo = getExtragalacticTypeInfo(extObj.type);

  return (
    <div
      className="absolute bg-night-800 border border-night-600 rounded-lg p-3 shadow-lg z-10"
      style={{ left: object.x + 10, top: object.y - 40 }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-1 right-2 text-gray-500 hover:text-white"
      >
        ×
      </button>
      <div className="text-sm font-medium" style={{ color: typeInfo.color }}>
        {typeInfo.label}
      </div>
      {extObj.magnitude > 0 && (
        <div className="text-xs text-gray-400 mt-1">Magnitude: {extObj.magnitude.toFixed(1)}</div>
      )}
      <div className="text-xs text-gray-400">
        Confidence: {(extObj.probability * 100).toFixed(0)}%
      </div>
      {extObj.redshift && (
        <div className="text-xs text-gray-400">Redshift: {extObj.redshift.toFixed(3)}</div>
      )}
      <div className="text-xs text-gray-500 mt-1">{typeInfo.description}</div>
    </div>
  );
}
