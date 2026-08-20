import { geoAlbers, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Venue } from "./types.ts";
import type { ProjectedVenue } from "./pins.ts";

// Static imports, not createRequire. Next's build tracer cannot follow a
// runtime require into node_modules, so `output: standalone` silently shipped
// without these files and the map crashed with MODULE_NOT_FOUND in the
// container while building and running fine locally.
import statesTopo from "us-atlas/states-10m.json";
import countriesTopo from "world-atlas/countries-110m.json";

export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 500;

/**
 * geoAlbers rather than geoAlbersUsa, deliberately.
 *
 * albersUsa is the obvious choice for US data and it is wrong here: it returns
 * null for any point outside the United States, so Rogers Centre in Toronto
 * silently disappears. Its Alaska and Hawaii insets buy nothing either, since
 * no MLB club plays in those states. A plain conic projection with the usual
 * US parallels renders the lower 48 identically and keeps Toronto.
 */
const projection = geoAlbers()
  .rotate([96, 0])
  .center([-0.6, 38.7])
  .parallels([29.5, 45.5]);

const path = geoPath(projection);

// Alaska and Hawaii are dropped before fitting: no clubs there, and leaving
// them in drags the fit until the lower 48 is a postage stamp.
const SKIP_STATES = new Set(["02", "15", "72", "78", "60", "66", "69"]);

function loadStates() {
  const topo = statesTopo as never;
  const fc = feature(topo, (statesTopo as { objects: { states: unknown } }).objects.states as never) as unknown as {
    features: { id: string; properties: { name: string } }[];
  };
  return { ...fc, features: fc.features.filter((f) => !SKIP_STATES.has(String(f.id))) };
}

function loadNeighbours() {
  const topo = countriesTopo as never;
  const fc = feature(topo, (countriesTopo as { objects: { countries: unknown } }).objects.countries as never) as unknown as {
    features: { properties: { name: string } }[];
  };
  return fc.features.filter((f) => ["Canada", "Mexico"].includes(f.properties?.name));
}

const states = loadStates();
projection.fitExtent(
  [
    [24, 24],
    [MAP_WIDTH - 24, MAP_HEIGHT - 24],
  ],
  states as never,
);

export interface MapGeometry {
  statePaths: string[];
  neighbourPaths: string[];
}

/**
 * Projected once, then cached. The geometry never changes at runtime, and
 * re-walking the topojson on every request is pure waste.
 */
let cachedGeometry: MapGeometry | null = null;

export function mapGeometry(): MapGeometry {
  if (!cachedGeometry) {
    cachedGeometry = {
      statePaths: states.features.map((f) => path(f as never) ?? "").filter(Boolean),
      neighbourPaths: loadNeighbours()
        .map((f) => path(f as never) ?? "")
        .filter(Boolean),
    };
  }
  return cachedGeometry;
}

export type { ProjectedVenue } from "./pins.ts";
export { separatePins } from "./pins.ts";

export function projectVenue(venue: Venue): ProjectedVenue | null {
  const p = projection([venue.lng, venue.lat]);
  if (!p) return null;
  const [x, y] = p;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { id: venue.id, x, y, anchorX: x, anchorY: y, nudged: false };
}

