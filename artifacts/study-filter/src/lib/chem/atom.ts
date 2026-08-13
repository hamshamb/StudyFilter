import { commonNeutrons, shellCounts, type ChemElement } from "./elements";

/**
 * The atom model, and just enough 3D maths to draw it.
 *
 * Everything here is generated from the element's own data — the shell counts
 * come from expanding its electron configuration, the proton count is its
 * atomic number, the neutron count is derived from its mass number. There is
 * no per-element 3D asset and nothing is hand-placed: change the configuration
 * and the picture changes with it.
 *
 * ── Why this is not Three.js ────────────────────────────────────────────
 *
 * A Bohr atom is spheres and rings. Three's real value — materials, lighting
 * rigs, loaders, complex geometry — is not needed for that, and a WebGL
 * context brings its own failure mode (blocked contexts, driver issues) for a
 * page whose whole job is to still work. Projecting to a 2D canvas ourselves
 * costs about a hundred lines, renders identically everywhere, keeps label
 * text sharp at any DPR, and lets colours come straight from the theme's CSS
 * variables so every StudyFilter theme is supported for free.
 *
 * ── Honesty about the model ─────────────────────────────────────────────
 *
 * This is a Bohr-style shell picture. Electrons do not travel on tidy circles
 * and an orbital is a probability cloud, not a track. The picture is the one
 * used to teach shells and valency at school level, and the UI says so on
 * screen. See {@link MODEL_CAVEAT}.
 */

export const MODEL_CAVEAT =
  "Simplified shell model, drawn for learning. Real electrons occupy orbitals — regions of probability — not circular paths.";

// ── Minimal 3D ───────────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Rotate about the X then Y axes. Two angles is all an orbit control needs. */
export function rotate(p: Vec3, pitch: number, yaw: number): Vec3 {
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const y1 = p.y * cosP - p.z * sinP;
  const z1 = p.y * sinP + p.z * cosP;

  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const x2 = p.x * cosY + z1 * sinY;
  const z2 = -p.x * sinY + z1 * cosY;

  return { x: x2, y: y1, z: z2 };
}

export interface Projected {
  x: number;
  y: number;
  /** Depth after rotation — used for painter's-algorithm sorting. */
  depth: number;
  /** Perspective scale factor at this depth. */
  scale: number;
}

/**
 * Weak perspective projection.
 *
 * `FOCAL` is deliberately large relative to the model: a wide-angle atom looks
 * like a fisheye photograph and makes the outer shells bulge. This gives just
 * enough depth cue to read as three-dimensional while keeping circles looking
 * like circles.
 */
const FOCAL = 900;

export function project(p: Vec3, cx: number, cy: number, zoom: number): Projected {
  const scale = (FOCAL / (FOCAL + p.z)) * zoom;
  return { x: cx + p.x * scale, y: cy + p.y * scale, depth: p.z, scale };
}

// ── The model ────────────────────────────────────────────────────────────

export interface Nucleon {
  kind: "proton" | "neutron";
  position: Vec3;
}

export interface Shell {
  /** 1-based shell number: 1 = K, 2 = L, … */
  index: number;
  label: string;
  electrons: number;
  /** Model-space radius. */
  radius: number;
  /** Tilt of the orbit plane, so shells do not stack into one flat disc. */
  tilt: number;
  /** Starting angle, so electrons on different shells are not aligned. */
  phase: number;
  /** Seconds per revolution. Inner shells move faster — a visual cue only. */
  period: number;
}

export interface AtomModel {
  element: ChemElement;
  protons: number;
  neutrons: number;
  /** What is actually drawn in the nucleus. May be fewer than the real count. */
  nucleons: Nucleon[];
  /** True when the nucleus is a representative sample rather than every particle. */
  nucleusSampled: boolean;
  shells: Shell[];
  /** Radius of the outermost orbit, for framing the camera. */
  extent: number;
}

export const SHELL_LABELS = ["K", "L", "M", "N", "O", "P", "Q"];

/**
 * Drawing 146 neutrons produces a grey blob, not a nucleus, and costs frames
 * for no understanding. Above this we draw a representative cluster in the
 * correct proton:neutron ratio and label the true counts beside it.
 */
const MAX_DRAWN_NUCLEONS = 44;

/**
 * Packs n particles roughly evenly inside a sphere.
 *
 * A Fibonacci spiral on nested shells, rather than random placement: random
 * looks lumpy and changes every render, which makes the nucleus appear to
 * boil. This is deterministic, so the same element always looks the same.
 */
function packSphere(count: number, radius: number): Vec3[] {
  if (count === 1) return [{ x: 0, y: 0, z: 0 }];
  const points: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    // Distribute across a few concentric layers so it fills, not just shells.
    const layer = Math.cbrt((i + 0.5) / count);
    const y = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push({
      x: Math.cos(theta) * r * radius * layer,
      y: y * radius * layer,
      z: Math.sin(theta) * r * radius * layer,
    });
  }
  return points;
}

export function buildAtom(element: ChemElement): AtomModel {
  const protons = element.number;
  const neutrons = Math.max(0, commonNeutrons(element));
  const total = protons + neutrons;

  const drawn = Math.min(total, MAX_DRAWN_NUCLEONS);
  const drawnProtons = total === 0 ? 0 : Math.max(1, Math.round((protons / total) * drawn));
  const nucleusRadius = 10 + Math.cbrt(drawn) * 6;
  const positions = packSphere(drawn, nucleusRadius);

  const nucleons: Nucleon[] = positions.map((position, i) => ({
    kind: i < drawnProtons ? "proton" : "neutron",
    position,
  }));

  const counts = shellCounts(element);
  const shells: Shell[] = counts.map((electrons, i) => ({
    index: i + 1,
    label: SHELL_LABELS[i] ?? `Shell ${i + 1}`,
    electrons,
    // Spacing grows sub-linearly so seven shells still fit the frame.
    radius: nucleusRadius + 46 + i * 34,
    // A different tilt per shell is what makes the picture read as 3D at all.
    tilt: (i % 3) * 0.5 - 0.42 + i * 0.12,
    phase: (i * Math.PI) / 3,
    period: 7 + i * 3.5,
  }));

  return {
    element,
    protons,
    neutrons,
    nucleons,
    nucleusSampled: drawn < total,
    shells,
    extent: shells.length > 0 ? shells[shells.length - 1]!.radius : nucleusRadius,
  };
}

/** Where one electron sits at time `t`, in model space before camera rotation. */
export function electronPosition(shell: Shell, index: number, t: number): Vec3 {
  const angle =
    shell.phase + (index / shell.electrons) * Math.PI * 2 + (t / shell.period) * Math.PI * 2;
  const x = Math.cos(angle) * shell.radius;
  const flat = Math.sin(angle) * shell.radius;
  // Tilt the orbit plane about the X axis.
  return {
    x,
    y: flat * Math.sin(shell.tilt),
    z: flat * Math.cos(shell.tilt),
  };
}

/** Points along one orbit path, for stroking the ring. */
export function orbitPath(shell: Shell, segments = 96): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * shell.radius;
    const flat = Math.sin(angle) * shell.radius;
    points.push({ x, y: flat * Math.sin(shell.tilt), z: flat * Math.cos(shell.tilt) });
  }
  return points;
}

/**
 * The spoken-word version of the picture.
 *
 * Not an afterthought: this is the accessible equivalent, and it is also what
 * the fallback renders. Anything the canvas shows, this sentence says.
 */
export function describeAtom(model: AtomModel): string {
  const { element } = model;
  const shells = model.shells.map((s) => `${s.label} shell ${s.electrons}`).join(", ");
  const outer = model.shells[model.shells.length - 1];
  return (
    `${element.name}, symbol ${element.symbol}, atomic number ${element.number}. ` +
    `${model.protons} protons and ${model.neutrons} neutrons in the nucleus, ` +
    `with ${element.number} electrons arranged as ${shells}. ` +
    (outer ? `The outermost ${outer.label} shell holds ${outer.electrons}. ` : "") +
    MODEL_CAVEAT
  );
}
