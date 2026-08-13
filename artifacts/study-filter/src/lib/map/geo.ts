import rawStates from "./india-states.json";

/**
 * Geometry helpers for the map practice feature.
 *
 * Boundaries come from a district-level dataset dissolved to state level only
 * for hit testing — districts of the same state are simply tested together,
 * which avoids running a polygon-union algorithm and the topology bugs that
 * come with it. Rings are simplified (Douglas–Peucker, ~0.05°) and rounded to
 * 3 decimal places: roughly 110 m of precision, far finer than the tolerance
 * any question uses, and small enough to ship in a lazily-loaded route.
 */

export interface StateShape {
  name: string;
  /** Outer rings only, as [lng, lat] pairs. Holes are irrelevant to hit tests. */
  rings: [number, number][][];
}

export const INDIA_STATES = rawStates as StateShape[];

/** Bounding box of the whole dataset, used to fit the map to a viewBox. */
export const INDIA_BOUNDS = (() => {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const s of INDIA_STATES) {
    for (const ring of s.rings) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return { minLng, minLat, maxLng, maxLat };
})();

/**
 * Equirectangular projection, with longitudes scaled by cos(mean latitude).
 *
 * A raw lng/lat plot stretches India noticeably east–west, because a degree of
 * longitude is shorter than a degree of latitude away from the equator. One
 * cosine factor fixes the aspect ratio well enough for a country this size and
 * keeps the inverse trivial, which matters because clicks must map back to
 * coordinates exactly.
 */
const MEAN_LAT = (INDIA_BOUNDS.minLat + INDIA_BOUNDS.maxLat) / 2;
const LNG_SCALE = Math.cos((MEAN_LAT * Math.PI) / 180);

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = (() => {
  const w = (INDIA_BOUNDS.maxLng - INDIA_BOUNDS.minLng) * LNG_SCALE;
  const h = INDIA_BOUNDS.maxLat - INDIA_BOUNDS.minLat;
  return Math.round((h / w) * MAP_WIDTH);
})();

export function project(lng: number, lat: number): { x: number; y: number } {
  const w = (INDIA_BOUNDS.maxLng - INDIA_BOUNDS.minLng) * LNG_SCALE;
  const h = INDIA_BOUNDS.maxLat - INDIA_BOUNDS.minLat;
  return {
    x: ((lng - INDIA_BOUNDS.minLng) * LNG_SCALE / w) * MAP_WIDTH,
    // SVG y grows downward; latitude grows upward.
    y: ((INDIA_BOUNDS.maxLat - lat) / h) * MAP_HEIGHT,
  };
}

export function unproject(x: number, y: number): { lng: number; lat: number } {
  const w = (INDIA_BOUNDS.maxLng - INDIA_BOUNDS.minLng) * LNG_SCALE;
  const h = INDIA_BOUNDS.maxLat - INDIA_BOUNDS.minLat;
  return {
    lng: INDIA_BOUNDS.minLng + ((x / MAP_WIDTH) * w) / LNG_SCALE,
    lat: INDIA_BOUNDS.maxLat - (y / MAP_HEIGHT) * h,
  };
}

/** SVG path data for one state, all its rings combined. */
export function statePath(state: StateShape): string {
  return state.rings
    .map((ring) => {
      const pts = ring.map(([lng, lat]) => {
        const { x, y } = project(lng, lat);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      return `M${pts.join("L")}Z`;
    })
    .join("");
}

function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Which state contains this coordinate, or null if it falls outside India. */
export function stateAt(lng: number, lat: number): string | null {
  for (const s of INDIA_STATES) {
    for (const ring of s.rings) {
      if (pointInRing(lng, lat, ring)) return s.name;
    }
  }
  return null;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance, used for the "close enough" tolerance. */
export function distanceKm(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}
