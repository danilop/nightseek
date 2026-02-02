import * as Astronomy from 'astronomy-engine';
import { ChevronDown, ChevronRight, Compass, Map as MapIcon, Navigation } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SkyCalculator } from '@/lib/astronomy/calculator';
import type { Location, NightInfo, ObjectVisibility, ScoredObject } from '@/types';

interface SkyChartProps {
  nightInfo: NightInfo;
  location: Location;
  planets: ObjectVisibility[];
  scoredObjects: ScoredObject[];
}

interface ChartSettings {
  showMilkyWay: boolean;
  showGrid: boolean;
  showEcliptic: boolean;
  useCompass: boolean;
}

interface ChartObject {
  name: string;
  type: 'planet' | 'dso' | 'moon';
  x: number;
  y: number;
  color: string;
  altitude: number;
  azimuth: number;
  magnitude?: number | null;
  subtype?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  object: ChartObject | null;
}

export default function SkyChart({ nightInfo, location, planets, scoredObjects }: SkyChartProps) {
  const [expanded, setExpanded] = useState(false);
  const [settings, setSettings] = useState<ChartSettings>({
    showMilkyWay: true,
    showGrid: false,
    showEcliptic: true,
    useCompass: false,
  });
  const [selectedTime, setSelectedTime] = useState<number>(50); // 0-100 slider position
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    object: null,
  });
  const [compassHeading, setCompassHeading] = useState<number>(0);
  const [compassAvailable, setCompassAvailable] = useState<boolean | null>(null); // null = not checked yet

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const objectsRef = useRef<ChartObject[]>([]);

  // Create calculator instance
  const calculator = useMemo(
    () => new SkyCalculator(location.latitude, location.longitude),
    [location.latitude, location.longitude]
  );

  // Calculate the actual time from slider position
  const currentTime = useMemo(() => {
    const startTime = nightInfo.sunset.getTime();
    const endTime = nightInfo.sunrise.getTime();
    const timeRange = endTime - startTime;
    return new Date(startTime + (selectedTime / 100) * timeRange);
  }, [nightInfo.sunset, nightInfo.sunrise, selectedTime]);

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get top DSOs for display
  const topDSOs = useMemo(
    () => scoredObjects.filter(obj => obj.category === 'dso').slice(0, 8),
    [scoredObjects]
  );

  const toggleSetting = (key: keyof ChartSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Check compass availability on mount
  useEffect(() => {
    // Check if DeviceOrientationEvent is available
    if (!('DeviceOrientationEvent' in window)) {
      setCompassAvailable(false);
      return;
    }

    // On iOS, we need to check if requestPermission exists (iOS 13+)
    // On other devices, we need to test if we actually receive events
    const hasRequestPermission =
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === 'function';

    if (hasRequestPermission) {
      // iOS 13+ - compass might be available, user needs to grant permission
      setCompassAvailable(true);
    } else {
      // Other devices - test by listening for an event
      let receivedEvent = false;
      const testHandler = (event: DeviceOrientationEvent) => {
        if (event.alpha !== null) {
          receivedEvent = true;
          setCompassAvailable(true);
        }
        window.removeEventListener('deviceorientation', testHandler);
      };

      window.addEventListener('deviceorientation', testHandler, true);

      // After 1 second, if no event received, compass is not available
      setTimeout(() => {
        if (!receivedEvent) {
          setCompassAvailable(false);
        }
        window.removeEventListener('deviceorientation', testHandler);
      }, 1000);
    }
  }, []);

  // Handle compass/device orientation when enabled
  useEffect(() => {
    if (!settings.useCompass) {
      setCompassHeading(0);
      return;
    }

    if (compassAvailable === false) {
      // Turn off if not available
      setSettings(prev => ({ ...prev, useCompass: false }));
      return;
    }

    let mounted = true;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (!mounted) return;

      // alpha is the compass heading (0-360, 0 = North)
      // On iOS, webkitCompassHeading is more accurate
      const heading =
        (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
          .webkitCompassHeading ??
        event.alpha ??
        0;

      if (heading !== null) {
        setCompassHeading(heading);
      }
    };

    // iOS 13+ requires permission request
    const startCompass = async () => {
      try {
        if (
          typeof DeviceOrientationEvent !== 'undefined' &&
          typeof (
            DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
          ).requestPermission === 'function'
        ) {
          const permission = await (
            DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }
          ).requestPermission();
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          } else {
            // Permission denied - just turn off compass
            setSettings(prev => ({ ...prev, useCompass: false }));
          }
        } else {
          // Non-iOS - just add listener
          window.addEventListener('deviceorientation', handleOrientation, true);
        }
      } catch {
        // Could not access compass - just turn off
        setSettings(prev => ({ ...prev, useCompass: false }));
      }
    };

    startCompass();

    return () => {
      mounted = false;
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [settings.useCompass, compassAvailable]);

  // Handle canvas click/tap for tooltips
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if ('touches' in event) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else {
        clientX = event.clientX;
        clientY = event.clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Find clicked object (within 15px radius)
      const clickedObject = objectsRef.current.find(obj => {
        const dx = obj.x - x;
        const dy = obj.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 15;
      });

      if (clickedObject) {
        setTooltip({
          visible: true,
          x: clickedObject.x,
          y: clickedObject.y,
          object: clickedObject,
        });
      } else {
        setTooltip(prev => ({ ...prev, visible: false }));
      }
    },
    []
  );

  // Draw the sky chart
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: canvas drawing requires sequential operations
  useEffect(() => {
    if (!expanded) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get container dimensions
    const size = Math.min(container.clientWidth, 400);

    // Guard against zero or very small container
    if (size < 100) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 30;

    // Clear objects array
    const objects: ChartObject[] = [];

    // Compass offset for rotating the entire chart
    // When facing East (heading=90), rotate chart so East is at top
    const compassOffset = settings.useCompass ? compassHeading : 0;

    // Clear and draw background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, size, size);

    // Draw horizon circle
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw altitude circles (30°, 60°)
    if (settings.showGrid) {
      ctx.strokeStyle = '#4a90c280'; // Brighter blue with 50% opacity
      ctx.lineWidth = 1;
      for (const alt of [30, 60]) {
        const r = radius * (1 - alt / 90);
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw azimuth lines
      for (let az = 0; az < 360; az += 45) {
        const angle = ((az - compassOffset - 90) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
        ctx.stroke();
      }
    }

    // Draw Milky Way band - only visible parts above horizon
    if (settings.showMilkyWay) {
      // Sample the galactic equator at regular intervals
      // Galactic coordinates (l, b) where b=0 is the galactic equator
      // Convert galactic longitude to RA/Dec using standard transformation
      const galNorthPoleRA = 12.85; // hours (192.86° / 15)
      const galNorthPoleDec = 27.13; // degrees
      const galCenterRA = 17.76; // hours (Sgr A*)

      // Convert galactic (l, 0) to equatorial (RA, Dec)
      const galToEquatorial = (galLon: number) => {
        const l = (galLon * Math.PI) / 180;
        const b = 0; // galactic equator

        // Galactic pole position
        const alphaNGP = (galNorthPoleRA * 15 * Math.PI) / 180; // 192.86°
        const deltaNGP = (galNorthPoleDec * Math.PI) / 180;
        const lNCP = (122.93 * Math.PI) / 180; // l of north celestial pole

        // Transform
        const sinDec =
          Math.sin(b) * Math.sin(deltaNGP) + Math.cos(b) * Math.cos(deltaNGP) * Math.sin(l - lNCP);
        const dec = Math.asin(sinDec);

        const y = Math.cos(b) * Math.cos(l - lNCP);
        const x =
          Math.sin(b) * Math.cos(deltaNGP) - Math.cos(b) * Math.sin(deltaNGP) * Math.sin(l - lNCP);
        const ra = alphaNGP + Math.atan2(y, x);

        return {
          ra: ((ra * 180) / Math.PI / 15 + 24) % 24, // hours
          dec: (dec * 180) / Math.PI, // degrees
        };
      };

      // Sample galactic equator and collect ONLY visible points
      const visibleSegments: { x: number; y: number }[][] = [];
      let currentSegment: { x: number; y: number }[] = [];

      for (let galLon = 0; galLon <= 360; galLon += 5) {
        const eq = galToEquatorial(galLon);
        const { altitude, azimuth } = calculator.getAltAz(eq.ra, eq.dec, currentTime);

        // Check if point is above horizon
        if (altitude > 0) {
          const r = radius * (1 - altitude / 90);
          const angle = ((azimuth - compassOffset - 90) * Math.PI) / 180;
          currentSegment.push({
            x: centerX + r * Math.cos(angle),
            y: centerY + r * Math.sin(angle),
          });
        } else if (currentSegment.length > 0) {
          // End of visible segment - save it and start fresh
          visibleSegments.push(currentSegment);
          currentSegment = [];
        }
      }

      // Don't forget the last segment
      if (currentSegment.length > 0) {
        visibleSegments.push(currentSegment);
      }

      // Draw each visible segment
      if (visibleSegments.length > 0) {
        // Brightness based on galactic center visibility
        const gcPos = calculator.getAltAz(galCenterRA, -29.0, currentTime);
        const opacity = gcPos.altitude > 0 ? Math.min(0.2, 0.08 + gcPos.altitude / 300) : 0.08;
        const opacityHex = Math.round(opacity * 255)
          .toString(16)
          .padStart(2, '0');

        ctx.save();
        ctx.strokeStyle = `#4a5568${opacityHex}`;
        ctx.lineWidth = radius * 0.1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const segment of visibleSegments) {
          if (segment.length < 2) continue;

          ctx.beginPath();
          ctx.moveTo(segment[0].x, segment[0].y);

          // Draw smooth curve through points using quadratic curves
          for (let i = 1; i < segment.length - 1; i++) {
            const midX = (segment[i].x + segment[i + 1].x) / 2;
            const midY = (segment[i].y + segment[i + 1].y) / 2;
            ctx.quadraticCurveTo(segment[i].x, segment[i].y, midX, midY);
          }

          // Line to last point
          const last = segment[segment.length - 1];
          ctx.lineTo(last.x, last.y);

          ctx.stroke();
        }

        ctx.restore();
      }
    }

    // Draw ecliptic line (path of Sun, planets, and Moon)
    if (settings.showEcliptic) {
      const obliquity = 23.44;
      const obliquityRad = (obliquity * Math.PI) / 180;
      const sinObl = Math.sin(obliquityRad);
      const cosObl = Math.cos(obliquityRad);

      // Helper to get ecliptic point position
      const getEclipticPoint = (eclLon: number) => {
        const lonRad = (eclLon * Math.PI) / 180;
        const sinLon = Math.sin(lonRad);
        const cosLon = Math.cos(lonRad);
        const decRad = Math.asin(sinObl * sinLon);
        const raRad = Math.atan2(sinLon * cosObl, cosLon);
        let raHours = (raRad * 12) / Math.PI;
        if (raHours < 0) raHours += 24;
        const decDegrees = (decRad * 180) / Math.PI;
        const { altitude, azimuth } = calculator.getAltAz(raHours, decDegrees, currentTime);
        return { altitude, azimuth };
      };

      // Helper to convert alt/az to canvas coordinates (with compass offset)
      const toCanvas = (altitude: number, azimuth: number) => {
        const r = radius * (1 - altitude / 90);
        const angle = ((azimuth - compassOffset - 90) * Math.PI) / 180;
        return {
          x: centerX + r * Math.cos(angle),
          y: centerY + r * Math.sin(angle),
        };
      };

      // Find horizon crossings and collect the visible arc
      const horizonCrossings: { azimuth: number; rising: boolean }[] = [];
      let prevAlt = getEclipticPoint(0).altitude;
      let midPoint: { x: number; y: number } | null = null;
      let maxAlt = -90;

      for (let eclLon = 1; eclLon <= 360; eclLon += 1) {
        const { altitude, azimuth } = getEclipticPoint(eclLon % 360);

        // Detect horizon crossing
        if ((prevAlt <= 0 && altitude > 0) || (prevAlt > 0 && altitude <= 0)) {
          // Interpolate to find exact crossing azimuth
          const prevPos = getEclipticPoint(eclLon - 1);
          const t = Math.abs(prevAlt) / (Math.abs(prevAlt) + Math.abs(altitude));
          const crossAz = prevPos.azimuth + t * (azimuth - prevPos.azimuth);
          horizonCrossings.push({
            azimuth: crossAz,
            rising: altitude > 0,
          });
        }

        // Track the highest point for the middle of the arc
        if (altitude > maxAlt) {
          maxAlt = altitude;
          midPoint = toCanvas(altitude, azimuth);
        }

        prevAlt = altitude;
      }

      // Draw if we have at least one horizon crossing and a midpoint
      if (horizonCrossings.length >= 2 && midPoint && maxAlt > 0) {
        // Find rising and setting points
        const risingCross = horizonCrossings.find(c => c.rising);
        const settingCross = horizonCrossings.find(c => !c.rising);

        if (risingCross && settingCross) {
          // Endpoints are ON the horizon circle (altitude = 0, r = radius)
          const p0 = toCanvas(0, risingCross.azimuth);
          const p1 = midPoint;
          const p2 = toCanvas(0, settingCross.azimuth);

          // Calculate control point for quadratic Bézier passing through p1 at t=0.5
          const cp = {
            x: 2 * p1.x - 0.5 * p0.x - 0.5 * p2.x,
            y: 2 * p1.y - 0.5 * p0.y - 0.5 * p2.y,
          };

          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.quadraticCurveTo(cp.x, cp.y, p2.x, p2.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Draw cardinal directions (rotated with compass)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cardinalDirs = [
      { label: 'N', az: 0 },
      { label: 'E', az: 90 },
      { label: 'S', az: 180 },
      { label: 'W', az: 270 },
    ];

    for (const dir of cardinalDirs) {
      const angle = ((dir.az - compassOffset - 90) * Math.PI) / 180;
      const labelRadius = radius + 15;
      const x = centerX + labelRadius * Math.cos(angle);
      const y = centerY + labelRadius * Math.sin(angle);
      ctx.fillText(dir.label, x, y);
    }

    // Helper to convert alt/az to canvas coordinates (includes compass rotation)
    const altAzToXY = (altitude: number, azimuth: number) => {
      const r = radius * (1 - altitude / 90);
      const angle = ((azimuth - compassOffset - 90) * Math.PI) / 180;
      return {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      };
    };

    // Planet colors
    const planetColors: Record<string, string> = {
      Mercury: '#b8b8b8',
      Venus: '#ffd700',
      Mars: '#ff6347',
      Jupiter: '#daa520',
      Saturn: '#f4d03f',
      Uranus: '#87ceeb',
      Neptune: '#4169e1',
    };

    // Map planet names to Astronomy bodies
    const planetBodies: Record<string, Astronomy.Body> = {
      Mercury: Astronomy.Body.Mercury,
      Venus: Astronomy.Body.Venus,
      Mars: Astronomy.Body.Mars,
      Jupiter: Astronomy.Body.Jupiter,
      Saturn: Astronomy.Body.Saturn,
      Uranus: Astronomy.Body.Uranus,
      Neptune: Astronomy.Body.Neptune,
    };

    // Create observer for planet calculations
    const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);

    // Draw planets at their actual positions for the current time
    for (const planet of planets) {
      if (!planet.isVisible) continue;

      const body = planetBodies[planet.objectName];
      if (!body) continue;

      // Calculate actual position at current time using Astronomy library
      const equator = Astronomy.Equator(body, currentTime, observer, true, true);
      const horizon = Astronomy.Horizon(
        currentTime,
        observer,
        equator.ra * 15,
        equator.dec,
        'normal'
      );

      const altitude = horizon.altitude;
      const azimuth = horizon.azimuth;

      // Only draw if above horizon
      if (altitude < 0) continue;

      const pos = altAzToXY(altitude, azimuth);
      const color = planetColors[planet.objectName] ?? '#ffffff';

      // Draw planet marker
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Add glow for bright planets
      if (planet.magnitude !== null && planet.magnitude < 0) {
        const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 12);
        gradient.addColorStop(0, `${color}60`);
        gradient.addColorStop(1, `${color}00`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      objects.push({
        name: planet.objectName,
        type: 'planet',
        x: pos.x,
        y: pos.y,
        color,
        altitude,
        azimuth,
        magnitude: planet.magnitude,
      });
    }

    // Draw Moon at actual position
    if (nightInfo.moonIllumination > 0) {
      const moonPos = calculator.getMoonPosition(currentTime);

      if (moonPos.altitude > 0) {
        const pos = altAzToXY(moonPos.altitude, moonPos.azimuth);

        // Draw moon with phase visualization
        ctx.fillStyle = '#f5f5dc';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Phase indicator (simplified)
        const phase = nightInfo.moonPhase;
        if (phase < 0.25 || phase > 0.75) {
          // Crescent - draw dark side
          ctx.fillStyle = '#0a0a14';
          ctx.beginPath();
          const offset = phase < 0.25 ? 3 : -3;
          ctx.arc(pos.x + offset, pos.y, 6, 0, Math.PI * 2);
          ctx.fill();
        } else if (phase > 0.4 && phase < 0.6) {
          // Full moon - add glow
          const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 16);
          gradient.addColorStop(0, '#f5f5dc40');
          gradient.addColorStop(1, '#f5f5dc00');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 16, 0, Math.PI * 2);
          ctx.fill();
        }

        objects.push({
          name: 'Moon',
          type: 'moon',
          x: pos.x,
          y: pos.y,
          color: '#f5f5dc',
          altitude: moonPos.altitude,
          azimuth: moonPos.azimuth,
        });
      }
    }

    // Draw top DSOs at actual positions
    for (const dso of topDSOs) {
      const { visibility } = dso;
      if (!visibility.isVisible) continue;

      const { altitude, azimuth } = calculator.getAltAz(
        visibility.raHours,
        visibility.decDegrees,
        currentTime
      );

      if (altitude < 10) continue;

      const pos = altAzToXY(altitude, azimuth);

      // Draw DSO marker
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw ring
      ctx.strokeStyle = '#10b98180';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.stroke();

      objects.push({
        name: visibility.commonName || visibility.objectName,
        type: 'dso',
        x: pos.x,
        y: pos.y,
        color: '#10b981',
        altitude,
        azimuth,
        magnitude: dso.magnitude,
        subtype: dso.subtype ?? undefined,
      });
    }

    // Draw zenith marker
    ctx.fillStyle = '#ffffff40';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Store objects for click detection
    objectsRef.current = objects;
  }, [
    expanded,
    settings,
    nightInfo,
    planets,
    topDSOs,
    currentTime,
    calculator,
    location,
    compassHeading,
  ]);

  // Close tooltip when time changes - selectedTime is intentionally a trigger dependency
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedTime is used as a trigger, not inside the effect
  useEffect(() => {
    setTooltip(prev => ({ ...prev, visible: false }));
  }, [selectedTime]);

  return (
    <div className="bg-night-900 rounded-xl border border-night-700 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-night-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <MapIcon className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-white">Sky Chart</h3>
          <span className="text-xs text-gray-500">Interactive sky view</span>
        </div>
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-night-700 p-4">
          {/* Time Slider */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>{formatTime(nightInfo.sunset)}</span>
              <span className="text-indigo-400 font-medium">{formatTime(currentTime)}</span>
              <span>{formatTime(nightInfo.sunrise)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={selectedTime}
              onChange={e => setSelectedTime(Number(e.target.value))}
              className="w-full h-2 bg-night-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Sunset</span>
              <span>Sunrise</span>
            </div>
          </div>

          {/* Toggle buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <ToggleButton
              label="Ecliptic"
              active={settings.showEcliptic}
              onClick={() => toggleSetting('showEcliptic')}
            />
            <ToggleButton
              label="Milky Way"
              active={settings.showMilkyWay}
              onClick={() => toggleSetting('showMilkyWay')}
            />
            <ToggleButton
              label="Grid"
              active={settings.showGrid}
              onClick={() => toggleSetting('showGrid')}
            />
            {compassAvailable === true && (
              <button
                type="button"
                onClick={() => toggleSetting('useCompass')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  settings.useCompass
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-night-800 text-gray-500 border border-night-700'
                }`}
                title={`Heading: ${Math.round(compassHeading)}°`}
              >
                <Navigation className={`w-3 h-3 ${settings.useCompass ? 'animate-pulse' : ''}`} />
                Compass
                {settings.useCompass && (
                  <span className="text-[10px] opacity-75">{Math.round(compassHeading)}°</span>
                )}
              </button>
            )}
          </div>

          {/* Canvas with tooltip */}
          <div ref={containerRef} className="flex justify-center relative">
            <canvas
              ref={canvasRef}
              className="rounded-lg cursor-pointer"
              onClick={handleCanvasClick}
              onTouchStart={handleCanvasClick}
            />

            {/* Tooltip */}
            {tooltip.visible && tooltip.object && (
              <div
                className="absolute bg-night-800 border border-night-600 rounded-lg px-3 py-2 shadow-lg z-10 pointer-events-none"
                style={{
                  left: Math.min(tooltip.x, (containerRef.current?.clientWidth ?? 300) - 120),
                  top: tooltip.y > 100 ? tooltip.y - 70 : tooltip.y + 20,
                }}
              >
                <div className="text-sm font-medium text-white">{tooltip.object.name}</div>
                <div className="text-xs text-gray-400 mt-1">
                  Alt: {tooltip.object.altitude.toFixed(0)}° · Az:{' '}
                  {tooltip.object.azimuth.toFixed(0)}°
                </div>
                {tooltip.object.magnitude !== undefined && tooltip.object.magnitude !== null && (
                  <div className="text-xs text-gray-500">
                    Mag: {tooltip.object.magnitude.toFixed(1)}
                  </div>
                )}
                {tooltip.object.subtype && (
                  <div className="text-xs text-gray-500">{tooltip.object.subtype}</div>
                )}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>Planets</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span>Top DSOs</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-yellow-100" />
              <span>Moon</span>
            </div>
            {settings.showEcliptic && (
              <div className="flex items-center gap-1">
                <span className="w-4 border-t-2 border-dashed border-amber-500/50" />
                <span>Ecliptic</span>
              </div>
            )}
          </div>

          {/* Hint */}
          <p className="text-center text-xs text-gray-600 mt-2">Tap objects for details</p>

          {/* Location info */}
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-500">
            <Compass className="w-3 h-3" />
            <span>
              {location.latitude.toFixed(2)}°{location.latitude >= 0 ? 'N' : 'S'},{' '}
              {location.longitude.toFixed(2)}°{location.longitude >= 0 ? 'E' : 'W'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ToggleButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function ToggleButton({ label, active, onClick }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
          : 'bg-night-800 text-gray-500 border border-night-700'
      }`}
    >
      {label}
    </button>
  );
}
