declare module 'd3-celestial' {
  interface CelestialConfig {
    container?: string;
    width?: number;
    projection?: string;
    transform?: string;
    center?: [number, number, number] | null;
    geopos?: [number, number] | null;
    follow?: string;
    zoomlevel?: number | null;
    zoomextend?: number;
    interactive?: boolean;
    form?: boolean;
    controls?: boolean;
    lang?: string;
    culture?: string;
    daterange?: unknown[];
    orientationfixed?: boolean;
    background?: {
      fill?: string;
      opacity?: number;
      stroke?: string;
      width?: number;
    };
    horizon?: {
      show?: boolean;
      stroke?: string;
      width?: number;
      fill?: string;
      opacity?: number;
    };
    daylight?: {
      show?: boolean;
    };
    planets?: {
      show?: boolean;
      which?: string[];
      symbols?: Record<string, unknown>;
      names?: boolean;
      nameStyle?: Record<string, unknown>;
      namesType?: string;
    };
    stars?: {
      show?: boolean;
      limit?: number;
      colors?: boolean;
      style?: { fill?: string; opacity?: number };
      designation?: boolean;
      designationType?: string;
      designationStyle?: Record<string, unknown>;
      designationLimit?: number;
      propername?: boolean;
      propernameType?: string;
      propernameStyle?: Record<string, unknown>;
      propernameLimit?: number;
      size?: number;
      exponent?: number;
      data?: string;
    };
    dsos?: {
      show?: boolean;
      limit?: number;
      colors?: boolean;
      style?: { fill?: string; stroke?: string; width?: number; opacity?: number };
      names?: boolean;
      namesType?: string;
      nameStyle?: Record<string, unknown>;
      nameLimit?: number;
      size?: number | null;
      exponent?: number;
      data?: string;
    };
    constellations?: {
      show?: boolean;
      names?: boolean;
      namesType?: string;
      nameStyle?: {
        fill?: string;
        align?: string;
        baseline?: string;
        font?: string | string[];
      };
      lines?: boolean;
      lineStyle?: { stroke?: string; width?: number };
      bounds?: boolean;
      boundStyle?: { stroke?: string; width?: number; opacity?: number; dash?: number[] };
    };
    mw?: {
      show?: boolean;
      style?: { fill?: string; opacity?: number };
    };
    lines?: {
      graticule?: {
        show?: boolean;
        stroke?: string;
        width?: number;
        opacity?: number;
        lon?: { pos?: string[]; fill?: string; font?: string };
        lat?: { pos?: string[]; fill?: string; font?: string };
      };
      equatorial?: { show?: boolean; stroke?: string; width?: number; opacity?: number };
      ecliptic?: { show?: boolean; stroke?: string; width?: number; opacity?: number };
      galactic?: { show?: boolean; stroke?: string; width?: number; opacity?: number };
      supergalactic?: { show?: boolean; stroke?: string; width?: number; opacity?: number };
    };
  }

  interface CelestialAddOptions {
    type: string;
    callback: (error: Error | null) => void;
    redraw?: () => void;
  }

  interface SkyviewOptions {
    date?: Date;
    location?: [number, number];
    timezone?: number;
  }

  interface Celestial {
    display(config: CelestialConfig): void;
    date(date?: Date, timezone?: number): Date | undefined;
    location(coords?: [number, number]): [number, number] | undefined;
    rotate(options: { center?: [number, number, number] }): void;
    apply(config: Partial<CelestialConfig>): void;
    redraw(): void;
    add(options: CelestialAddOptions): void;
    clear(): void;
    skyview(options?: SkyviewOptions): SkyviewOptions | undefined;
    mapProjection(coords: [number, number]): [number, number] | null;
    container: HTMLElement;
    context: CanvasRenderingContext2D;
  }

  const Celestial: Celestial;
  export default Celestial;
}
