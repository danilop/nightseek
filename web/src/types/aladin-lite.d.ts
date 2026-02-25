declare module 'aladin-lite' {
  interface AladinOptions {
    survey?: string;
    fov?: number;
    target?: string;
    cooFrame?: string;
    showCooGridControl?: boolean;
    showSimbadPointerControl?: boolean;
    showCooGrid?: boolean;
    showShareControl?: boolean;
    showSettingsControl?: boolean;
    showLayersControl?: boolean;
    showGotoControl?: boolean;
    showZoomControl?: boolean;
    showFullscreenControl?: boolean;
    showFrame?: boolean;
    showFov?: boolean;
    showCooLocation?: boolean;
    showProjectionControl?: boolean;
    showContextMenu?: boolean;
    showReticle?: boolean;
    backgroundColor?: string;
  }

  export interface AladinInstance {
    gotoRaDec(ra: number, dec: number): void;
    setFov(fov: number): void;
    setImageSurvey(survey: string): void;
    getSize(): [number, number];
    destroy(): void;
  }

  interface AladinStatic {
    aladin(element: HTMLElement | string, options?: AladinOptions): AladinInstance;
    init: Promise<void>;
  }

  const A: AladinStatic;
  export default A;
}
