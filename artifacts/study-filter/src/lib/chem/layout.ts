import { ELEMENTS, type ChemElement } from "./elements";

/**
 * Where each element sits on screen.
 *
 * The standard 18×7 grid, with the f-block lifted out into two rows
 * underneath — the layout every CBSE textbook prints, so a student can match
 * what is on the wall of their classroom.
 *
 * Lanthanum and actinium are drawn in the f-block rows rather than in group 3.
 * Both conventions exist and neither is wrong; this one is what NCERT shows.
 */

export const GRID_COLUMNS = 18;
export const F_BLOCK_COLUMNS = 15;

export interface Placement {
  element: ChemElement;
  /** 1-based column in the main grid, or in the f-block strip. */
  column: number;
  /** 1-based row. For f-block elements this is 1 (lanthanides) or 2 (actinides). */
  row: number;
  region: "main" | "f-block";
}

export const PLACEMENTS: Placement[] = ELEMENTS.map((element) => {
  if (element.number >= 57 && element.number <= 71) {
    return { element, column: element.number - 57 + 1, row: 1, region: "f-block" as const };
  }
  if (element.number >= 89 && element.number <= 103) {
    return { element, column: element.number - 89 + 1, row: 2, region: "f-block" as const };
  }
  return { element, column: element.group, row: element.period, region: "main" as const };
});

export const MAIN_GRID = PLACEMENTS.filter((p) => p.region === "main");
export const F_BLOCK = PLACEMENTS.filter((p) => p.region === "f-block");

/** The two placeholder cells in group 3 that stand in for the f-block rows. */
export const F_BLOCK_MARKERS = [
  { row: 6, column: 3, label: "57–71", title: "Lanthanides" },
  { row: 7, column: 3, label: "89–103", title: "Actinides" },
];

// ── Groups and periods, as teachable units ──────────────────────────────

export interface GroupInfo {
  group: number;
  /** The traditional name, where one is in common use. */
  name: string | null;
  summary: string;
}

/**
 * Only the groups with a real identity get a name. Groups 3–12 are the
 * transition series and are taught as a block, not as ten separate families,
 * so inventing names for them would be inventing curriculum.
 */
export const GROUPS: GroupInfo[] = [
  { group: 1, name: "Alkali metals", summary: "One electron in the outermost shell, given up easily. Soft, very reactive metals — reactivity increases down the group. Hydrogen sits here by configuration but is not an alkali metal." },
  { group: 2, name: "Alkaline earth metals", summary: "Two outer electrons. Harder and less reactive than group 1, and they form 2+ ions." },
  { group: 3, name: null, summary: "The start of the transition series, and where the lanthanides and actinides are pulled out from." },
  { group: 4, name: null, summary: "Transition metals — hard, high-melting, several oxidation states." },
  { group: 5, name: null, summary: "Transition metals, including vanadium and tantalum." },
  { group: 6, name: null, summary: "Transition metals. Chromium's half-filled d shell makes it an exception to the filling order." },
  { group: 7, name: null, summary: "Transition metals, including manganese." },
  { group: 8, name: null, summary: "The first column of the iron triad." },
  { group: 9, name: null, summary: "The second column of the iron triad." },
  { group: 10, name: null, summary: "The third column of the iron triad — nickel, palladium, platinum." },
  { group: 11, name: "Coinage metals", summary: "Copper, silver and gold. A filled d shell with one s electron; excellent conductors and unusually unreactive." },
  { group: 12, name: null, summary: "Zinc, cadmium, mercury. A full d shell, so they behave less like typical transition metals." },
  { group: 13, name: "Boron group", summary: "Three outer electrons. Boron is a metalloid; the rest are metals, aluminium most importantly." },
  { group: 14, name: "Carbon group", summary: "Four outer electrons, so they share rather than transfer. Carbon's catenation is the basis of organic chemistry." },
  { group: 15, name: "Nitrogen group", summary: "Five outer electrons. Nitrogen and phosphorus are essential to life and to fertilisers." },
  { group: 16, name: "Chalcogens", summary: "Six outer electrons, needing two more. Oxygen and sulfur dominate the group's chemistry." },
  { group: 17, name: "Halogens", summary: "Seven outer electrons — one short of a full shell, which makes them the most reactive non-metals. Reactivity decreases down the group." },
  { group: 18, name: "Noble gases", summary: "A full outermost shell, so they barely react at all. This stability is what every other element's bonding is trying to reach." },
];

export interface PeriodInfo {
  period: number;
  summary: string;
}

export const PERIODS: PeriodInfo[] = [
  { period: 1, summary: "Just two elements. The first shell holds only 2 electrons, so it fills immediately." },
  { period: 2, summary: "Lithium to neon — the 2s and 2p subshells fill, giving 8 elements." },
  { period: 3, summary: "Sodium to argon. Another 8, filling 3s and 3p." },
  { period: 4, summary: "18 elements: the 3d subshell fills between calcium and gallium, which is where the transition metals first appear." },
  { period: 5, summary: "18 elements, mirroring period 4 with 4d filling." },
  { period: 6, summary: "32 elements — the 4f subshell fills first, producing the 15 lanthanides." },
  { period: 7, summary: "32 elements, including the actinides. Everything past uranium is made artificially." },
];

/** Elements in one group, top to bottom — the "learn by group" reading order. */
export function elementsInGroup(group: number): ChemElement[] {
  return ELEMENTS.filter((e) => e.group === group && e.block !== "f").sort(
    (a, b) => a.number - b.number,
  );
}

export function elementsInPeriod(period: number): ChemElement[] {
  return ELEMENTS.filter((e) => e.period === period).sort((a, b) => a.number - b.number);
}
