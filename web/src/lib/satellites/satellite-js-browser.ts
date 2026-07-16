// satellite.js 7's root entrypoint also re-exports its optional WASM workers.
// Vite must not traverse those Node/pthread-only modules for the browser bundle,
// so expose only the JavaScript APIs NightSeek uses.
export type {
  GeodeticLocation,
  LookAngles,
} from '../../../node_modules/satellite.js/dist/common-types.js';
export { jday } from '../../../node_modules/satellite.js/dist/ext.js';
export { twoline2satrec } from '../../../node_modules/satellite.js/dist/io.js';
export type { SatRec } from '../../../node_modules/satellite.js/dist/propagation/SatRec.js';
export { gstime, propagate } from '../../../node_modules/satellite.js/dist/propagation.js';
export { sunPos } from '../../../node_modules/satellite.js/dist/sun.js';
export {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  radiansToDegrees,
} from '../../../node_modules/satellite.js/dist/transforms.js';
