import { useEffect, useRef } from 'react';
import type { GaiaStar } from '@/types';

interface StarFieldCanvasProps {
  stars: GaiaStar[];
  fovWidth: number; // arcminutes
  fovHeight: number; // arcminutes
  objectSizeArcmin?: number; // angular size of the target object
  centerRa: number; // degrees
  centerDec: number; // degrees
}

// Color temperature mapping based on BP-RP color index
// Negative = blue, Positive = red
function getStarColor(bpRp: number | null): string {
  if (bpRp === null) return '#ffffff'; // Default white

  // Typical range: -0.5 (blue) to 4.0 (red)
  if (bpRp < 0) {
    // Blue stars (O, B type)
    return '#aaccff';
  } else if (bpRp < 0.5) {
    // Blue-white (A type)
    return '#caddff';
  } else if (bpRp < 1.0) {
    // White (F type)
    return '#ffffff';
  } else if (bpRp < 1.5) {
    // Yellow-white (G type, like Sun)
    return '#fff4e8';
  } else if (bpRp < 2.0) {
    // Yellow-orange (K type)
    return '#ffd9a0';
  } else {
    // Red (M type)
    return '#ffaa77';
  }
}

// Calculate star radius based on magnitude
// Brighter stars (lower mag) = larger radius
function getStarRadius(magnitude: number, minMag: number, maxMag: number): number {
  const normalized = (maxMag - magnitude) / (maxMag - minMag);
  // Range from 1 to 4 pixels
  return 1 + normalized * 3;
}

export default function StarFieldCanvas({
  stars,
  fovWidth,
  fovHeight,
  objectSizeArcmin = 0,
  centerRa,
  centerDec,
}: StarFieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Canvas rendering requires multiple calculations
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get container dimensions for responsive canvas
    const containerWidth = container.clientWidth;
    const aspectRatio = fovHeight / fovWidth;
    const canvasWidth = containerWidth;
    const canvasHeight = Math.round(containerWidth * aspectRatio);

    // Set canvas size (multiply by devicePixelRatio for crisp rendering)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.scale(dpr, dpr);

    // Dark background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (stars.length === 0) {
      // No stars message
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No star data available', canvasWidth / 2, canvasHeight / 2);
      return;
    }

    // Calculate magnitude range for size scaling
    const magnitudes = stars.map(s => s.magnitude);
    const minMag = Math.min(...magnitudes);
    const maxMag = Math.max(...magnitudes);

    // FOV in degrees
    const fovWidthDeg = fovWidth / 60;
    const fovHeightDeg = fovHeight / 60;

    // Convert RA/Dec to canvas coordinates
    // RA increases to the left (west) in standard orientation
    const raDecToCanvas = (ra: number, dec: number): { x: number; y: number } | null => {
      // Calculate offset from center
      let deltaRa = ra - centerRa;
      // Handle RA wrap-around
      if (deltaRa > 180) deltaRa -= 360;
      if (deltaRa < -180) deltaRa += 360;

      // Adjust for cos(dec) projection
      deltaRa *= Math.cos((centerDec * Math.PI) / 180);

      const deltaDec = dec - centerDec;

      // Check if within FOV (with small margin)
      const margin = 0.05;
      if (Math.abs(deltaRa) > (fovWidthDeg / 2) * (1 + margin)) return null;
      if (Math.abs(deltaDec) > (fovHeightDeg / 2) * (1 + margin)) return null;

      // Map to canvas (RA inverted for correct orientation)
      const x = canvasWidth / 2 - (deltaRa / fovWidthDeg) * canvasWidth;
      const y = canvasHeight / 2 - (deltaDec / fovHeightDeg) * canvasHeight;

      return { x, y };
    };

    // Draw stars (sort by magnitude so brighter ones are on top)
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

      // Draw star
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw FOV rectangle (telescope field of view indicator)
    ctx.strokeStyle = '#3b82f6'; // sky-500
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    const margin = 10;
    ctx.strokeRect(margin, margin, canvasWidth - margin * 2, canvasHeight - margin * 2);
    ctx.setLineDash([]);

    // Draw object size circle at center (if provided)
    if (objectSizeArcmin > 0) {
      const objectSizeDeg = objectSizeArcmin / 60;
      const objectRadiusPx = ((objectSizeDeg / fovWidthDeg) * canvasWidth) / 2;

      // Check if object is larger than FOV
      const maxVisibleRadius = Math.min(canvasWidth, canvasHeight) / 2 - 15;
      const isLargerThanFOV = objectRadiusPx > maxVisibleRadius;

      ctx.strokeStyle = '#ef4444'; // red-500
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();

      if (isLargerThanFOV) {
        // Draw a partial arc at the edge to indicate large object
        ctx.arc(canvasWidth / 2, canvasHeight / 2, maxVisibleRadius, 0, Math.PI * 2);
      } else {
        ctx.arc(canvasWidth / 2, canvasHeight / 2, objectRadiusPx, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw crosshair at center
      const crossSize = 8;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(canvasWidth / 2 - crossSize, canvasHeight / 2);
      ctx.lineTo(canvasWidth / 2 + crossSize, canvasHeight / 2);
      ctx.moveTo(canvasWidth / 2, canvasHeight / 2 - crossSize);
      ctx.lineTo(canvasWidth / 2, canvasHeight / 2 + crossSize);
      ctx.stroke();

      // Show object size label
      const sizeLabel =
        objectSizeArcmin >= 60
          ? `${(objectSizeArcmin / 60).toFixed(1)}°`
          : `${objectSizeArcmin.toFixed(0)}'`;

      ctx.fillStyle = '#ef4444';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';

      if (isLargerThanFOV) {
        // Show "larger than FOV" indicator
        ctx.fillText(`⬤ ${sizeLabel} (larger than FOV)`, canvasWidth / 2, canvasHeight - 25);
      } else {
        // Show size below the circle
        const labelY = canvasHeight / 2 + objectRadiusPx + 15;
        if (labelY < canvasHeight - 20) {
          ctx.fillText(sizeLabel, canvasWidth / 2, labelY);
        }
      }
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
  }, [stars, fovWidth, fovHeight, objectSizeArcmin, centerRa, centerDec]);

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} className="w-full rounded-lg" />
    </div>
  );
}
