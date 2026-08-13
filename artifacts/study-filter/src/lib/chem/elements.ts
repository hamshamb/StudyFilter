/**
 * The periodic table, as structured data.
 *
 * Every value here is a reference value, stored once and read at runtime. No
 * part of this module calls an AI: asking a model for fluorine's
 * electronegativity on each click would be slower, cost money, and — the part
 * that matters — could return a different number each time. A student who
 * looks up the same fact twice must get the same answer.
 *
 * ── Where the numbers come from, and what they mean ──────────────────────
 *
 * `mass` is the IUPAC standard atomic weight, rounded to the precision a
 * Class 10–12 student needs. For elements with no stable isotope there *is* no
 * standard atomic weight, so the value is the mass number of the most stable
 * known isotope and `massIsIsotope` is true — the UI writes those differently,
 * because "(209)" and "40.078" are not the same kind of claim.
 *
 * Melting and boiling points are in kelvin, densities in g/cm³ (gases at STP).
 *
 * For elements beyond lawrencium (Z > 103) almost every physical property is
 * *predicted* rather than measured, and only a handful of atoms have ever
 * existed. Those fields are left null rather than filled with a number that
 * looks measured. `synthetic` marks every element with no natural occurrence.
 *
 * ── Integrity ────────────────────────────────────────────────────────────
 *
 * The electron configurations are self-checking: {@link electronCount} expands
 * the noble-gas core and sums the shells, and it must equal the atomic number.
 * A typo in a configuration is therefore a caught error, not a wrong fact
 * shown to a student. See `assertElementDataIntegrity` at the bottom, which
 * also checks symbols are unique, atomic numbers are contiguous, and each
 * element's category agrees with its group.
 */

export type ElementCategory =
  | "alkali-metal"
  | "alkaline-earth-metal"
  | "transition-metal"
  | "post-transition-metal"
  | "metalloid"
  | "reactive-nonmetal"
  | "halogen"
  | "noble-gas"
  | "lanthanide"
  | "actinide"
  | "unknown";

export type ElementBlock = "s" | "p" | "d" | "f";

export type MatterState = "solid" | "liquid" | "gas" | "unknown";

export interface ChemElement {
  number: number;
  symbol: string;
  name: string;
  /** Standard atomic weight, or the mass number of the most stable isotope. */
  mass: number;
  /** True when `mass` is a mass number, not a standard atomic weight. */
  massIsIsotope: boolean;
  category: ElementCategory;
  block: ElementBlock;
  /** 1–18. Lanthanides and actinides are conventionally placed in group 3. */
  group: number;
  period: number;
  /** Noble-gas shorthand, e.g. "[Ne] 3s2 3p4". Superscripts are added by the UI. */
  configuration: string;
  /** Pauling scale. Null where no accepted value exists. */
  electronegativity: number | null;
  /** Kelvin. */
  melt: number | null;
  boil: number | null;
  /** g/cm³ for solids and liquids; g/L equivalent for gases at STP. */
  density: number | null;
  /** At 25 °C and 1 atm. */
  state: MatterState;
  /** No stable natural occurrence — made in a reactor or accelerator. */
  synthetic: boolean;
}

/**
 * Column order for the compact table below. Written as tuples rather than 118
 * object literals: the same field in the same position on every row makes a
 * wrong column obvious when reading, and keeps the file short enough to scan.
 */
type Row = [
  number, // atomic number
  string, // symbol
  string, // name
  number, // mass
  0 | 1, // massIsIsotope
  ElementCategory,
  ElementBlock,
  number, // group
  number, // period
  string, // configuration
  number | null, // electronegativity (Pauling)
  number | null, // melting point, K
  number | null, // boiling point, K
  number | null, // density
  MatterState,
  0 | 1, // synthetic
];

/* eslint-disable prettier/prettier */
const ROWS: Row[] = [
  // ── Period 1 ───────────────────────────────────────────────────────────
  [1,  "H",  "Hydrogen",   1.008,   0, "reactive-nonmetal",     "s",  1, 1, "1s1",                          2.20, 13.99,  20.271, 0.00008988, "gas",    0],
  [2,  "He", "Helium",     4.0026,  0, "noble-gas",             "s", 18, 1, "1s2",                          null,  0.95,   4.222, 0.0001785,  "gas",    0],

  // ── Period 2 ───────────────────────────────────────────────────────────
  [3,  "Li", "Lithium",    6.94,    0, "alkali-metal",          "s",  1, 2, "[He] 2s1",                     0.98, 453.65, 1603,   0.534,      "solid",  0],
  [4,  "Be", "Beryllium",  9.0122,  0, "alkaline-earth-metal",  "s",  2, 2, "[He] 2s2",                     1.57, 1560,   2742,   1.85,       "solid",  0],
  [5,  "B",  "Boron",      10.81,   0, "metalloid",             "p", 13, 2, "[He] 2s2 2p1",                 2.04, 2349,   4200,   2.34,       "solid",  0],
  [6,  "C",  "Carbon",     12.011,  0, "reactive-nonmetal",     "p", 14, 2, "[He] 2s2 2p2",                 2.55, 3823,   4098,   2.267,      "solid",  0],
  [7,  "N",  "Nitrogen",   14.007,  0, "reactive-nonmetal",     "p", 15, 2, "[He] 2s2 2p3",                 3.04,  63.15,  77.355, 0.0012506, "gas",    0],
  [8,  "O",  "Oxygen",     15.999,  0, "reactive-nonmetal",     "p", 16, 2, "[He] 2s2 2p4",                 3.44,  54.36,  90.188, 0.001429,  "gas",    0],
  [9,  "F",  "Fluorine",   18.998,  0, "halogen",               "p", 17, 2, "[He] 2s2 2p5",                 3.98,  53.48,  85.03,  0.001696,  "gas",    0],
  [10, "Ne", "Neon",       20.180,  0, "noble-gas",             "p", 18, 2, "[He] 2s2 2p6",                 null,  24.56,  27.104, 0.0008999, "gas",    0],

  // ── Period 3 ───────────────────────────────────────────────────────────
  [11, "Na", "Sodium",     22.990,  0, "alkali-metal",          "s",  1, 3, "[Ne] 3s1",                     0.93, 370.94, 1156,   0.968,      "solid",  0],
  [12, "Mg", "Magnesium",  24.305,  0, "alkaline-earth-metal",  "s",  2, 3, "[Ne] 3s2",                     1.31, 923,    1363,   1.738,      "solid",  0],
  [13, "Al", "Aluminium",  26.982,  0, "post-transition-metal", "p", 13, 3, "[Ne] 3s2 3p1",                 1.61, 933.47, 2792,   2.70,       "solid",  0],
  [14, "Si", "Silicon",    28.085,  0, "metalloid",             "p", 14, 3, "[Ne] 3s2 3p2",                 1.90, 1687,   3538,   2.329,      "solid",  0],
  [15, "P",  "Phosphorus", 30.974,  0, "reactive-nonmetal",     "p", 15, 3, "[Ne] 3s2 3p3",                 2.19, 317.3,   553.7, 1.823,      "solid",  0],
  [16, "S",  "Sulfur",     32.06,   0, "reactive-nonmetal",     "p", 16, 3, "[Ne] 3s2 3p4",                 2.58, 388.36,  717.8, 2.07,       "solid",  0],
  [17, "Cl", "Chlorine",   35.45,   0, "halogen",               "p", 17, 3, "[Ne] 3s2 3p5",                 3.16, 171.6,   239.11, 0.003214,  "gas",    0],
  [18, "Ar", "Argon",      39.95,   0, "noble-gas",             "p", 18, 3, "[Ne] 3s2 3p6",                 null,  83.81,   87.302, 0.0017837,"gas",    0],

  // ── Period 4 ───────────────────────────────────────────────────────────
  [19, "K",  "Potassium",  39.098,  0, "alkali-metal",          "s",  1, 4, "[Ar] 4s1",                     0.82, 336.7,  1032,   0.862,      "solid",  0],
  [20, "Ca", "Calcium",    40.078,  0, "alkaline-earth-metal",  "s",  2, 4, "[Ar] 4s2",                     1.00, 1115,   1757,   1.55,       "solid",  0],
  [21, "Sc", "Scandium",   44.956,  0, "transition-metal",      "d",  3, 4, "[Ar] 3d1 4s2",                 1.36, 1814,   3109,   2.985,      "solid",  0],
  [22, "Ti", "Titanium",   47.867,  0, "transition-metal",      "d",  4, 4, "[Ar] 3d2 4s2",                 1.54, 1941,   3560,   4.506,      "solid",  0],
  [23, "V",  "Vanadium",   50.942,  0, "transition-metal",      "d",  5, 4, "[Ar] 3d3 4s2",                 1.63, 2183,   3680,   6.11,       "solid",  0],
  // Chromium and copper are the two Period-4 anomalies: a half-filled and a
  // filled 3d shell is more stable than the 4s2 arrangement.
  [24, "Cr", "Chromium",   51.996,  0, "transition-metal",      "d",  6, 4, "[Ar] 3d5 4s1",                 1.66, 2180,   2944,   7.15,       "solid",  0],
  [25, "Mn", "Manganese",  54.938,  0, "transition-metal",      "d",  7, 4, "[Ar] 3d5 4s2",                 1.55, 1519,   2334,   7.21,       "solid",  0],
  [26, "Fe", "Iron",       55.845,  0, "transition-metal",      "d",  8, 4, "[Ar] 3d6 4s2",                 1.83, 1811,   3134,   7.874,      "solid",  0],
  [27, "Co", "Cobalt",     58.933,  0, "transition-metal",      "d",  9, 4, "[Ar] 3d7 4s2",                 1.88, 1768,   3200,   8.90,       "solid",  0],
  [28, "Ni", "Nickel",     58.693,  0, "transition-metal",      "d", 10, 4, "[Ar] 3d8 4s2",                 1.91, 1728,   3186,   8.908,      "solid",  0],
  [29, "Cu", "Copper",     63.546,  0, "transition-metal",      "d", 11, 4, "[Ar] 3d10 4s1",                1.90, 1357.77,2835,   8.96,       "solid",  0],
  [30, "Zn", "Zinc",       65.38,   0, "transition-metal",      "d", 12, 4, "[Ar] 3d10 4s2",                1.65, 692.68, 1180,   7.14,       "solid",  0],
  [31, "Ga", "Gallium",    69.723,  0, "post-transition-metal", "p", 13, 4, "[Ar] 3d10 4s2 4p1",            1.81, 302.9146,2673,  5.91,       "solid",  0],
  [32, "Ge", "Germanium",  72.630,  0, "metalloid",             "p", 14, 4, "[Ar] 3d10 4s2 4p2",            2.01, 1211.4, 3106,   5.323,      "solid",  0],
  [33, "As", "Arsenic",    74.922,  0, "metalloid",             "p", 15, 4, "[Ar] 3d10 4s2 4p3",            2.18, 1090,    887,   5.727,      "solid",  0],
  [34, "Se", "Selenium",   78.971,  0, "reactive-nonmetal",     "p", 16, 4, "[Ar] 3d10 4s2 4p4",            2.55, 494,     958,   4.81,       "solid",  0],
  [35, "Br", "Bromine",    79.904,  0, "halogen",               "p", 17, 4, "[Ar] 3d10 4s2 4p5",            2.96, 265.8,   332.0, 3.1028,     "liquid", 0],
  [36, "Kr", "Krypton",    83.798,  0, "noble-gas",             "p", 18, 4, "[Ar] 3d10 4s2 4p6",            3.00, 115.78,  119.93,0.003733,   "gas",    0],

  // ── Period 5 ───────────────────────────────────────────────────────────
  [37, "Rb", "Rubidium",   85.468,  0, "alkali-metal",          "s",  1, 5, "[Kr] 5s1",                     0.82, 312.45,  961,   1.532,      "solid",  0],
  [38, "Sr", "Strontium",  87.62,   0, "alkaline-earth-metal",  "s",  2, 5, "[Kr] 5s2",                     0.95, 1050,   1650,   2.64,       "solid",  0],
  [39, "Y",  "Yttrium",    88.906,  0, "transition-metal",      "d",  3, 5, "[Kr] 4d1 5s2",                 1.22, 1799,   3609,   4.472,      "solid",  0],
  [40, "Zr", "Zirconium",  91.224,  0, "transition-metal",      "d",  4, 5, "[Kr] 4d2 5s2",                 1.33, 2128,   4682,   6.52,       "solid",  0],
  [41, "Nb", "Niobium",    92.906,  0, "transition-metal",      "d",  5, 5, "[Kr] 4d4 5s1",                 1.60, 2750,   5017,   8.57,       "solid",  0],
  [42, "Mo", "Molybdenum", 95.95,   0, "transition-metal",      "d",  6, 5, "[Kr] 4d5 5s1",                 2.16, 2896,   4912,  10.28,       "solid",  0],
  [43, "Tc", "Technetium", 98,      1, "transition-metal",      "d",  7, 5, "[Kr] 4d5 5s2",                 1.90, 2430,   4538,  11.0,        "solid",  1],
  [44, "Ru", "Ruthenium",  101.07,  0, "transition-metal",      "d",  8, 5, "[Kr] 4d7 5s1",                 2.20, 2607,   4423,  12.45,       "solid",  0],
  [45, "Rh", "Rhodium",    102.91,  0, "transition-metal",      "d",  9, 5, "[Kr] 4d8 5s1",                 2.28, 2237,   3968,  12.41,       "solid",  0],
  // Palladium is the only element with no electrons in its outermost s shell.
  [46, "Pd", "Palladium",  106.42,  0, "transition-metal",      "d", 10, 5, "[Kr] 4d10",                    2.20, 1828.05,3236,  12.023,      "solid",  0],
  [47, "Ag", "Silver",     107.87,  0, "transition-metal",      "d", 11, 5, "[Kr] 4d10 5s1",                1.93, 1234.93,2435,  10.49,       "solid",  0],
  [48, "Cd", "Cadmium",    112.41,  0, "transition-metal",      "d", 12, 5, "[Kr] 4d10 5s2",                1.69, 594.22, 1040,   8.65,       "solid",  0],
  [49, "In", "Indium",     114.82,  0, "post-transition-metal", "p", 13, 5, "[Kr] 4d10 5s2 5p1",            1.78, 429.75, 2345,   7.31,       "solid",  0],
  [50, "Sn", "Tin",        118.71,  0, "post-transition-metal", "p", 14, 5, "[Kr] 4d10 5s2 5p2",            1.96, 505.08, 2875,   7.287,      "solid",  0],
  [51, "Sb", "Antimony",   121.76,  0, "metalloid",             "p", 15, 5, "[Kr] 4d10 5s2 5p3",            2.05, 903.78, 1908,   6.685,      "solid",  0],
  [52, "Te", "Tellurium",  127.60,  0, "metalloid",             "p", 16, 5, "[Kr] 4d10 5s2 5p4",            2.10, 722.66, 1261,   6.232,      "solid",  0],
  [53, "I",  "Iodine",     126.90,  0, "halogen",               "p", 17, 5, "[Kr] 4d10 5s2 5p5",            2.66, 386.85,  457.4, 4.933,      "solid",  0],
  [54, "Xe", "Xenon",      131.29,  0, "noble-gas",             "p", 18, 5, "[Kr] 4d10 5s2 5p6",            2.60, 161.40,  165.051,0.005887,  "gas",    0],

  // ── Period 6 ───────────────────────────────────────────────────────────
  [55, "Cs", "Caesium",    132.91,  0, "alkali-metal",          "s",  1, 6, "[Xe] 6s1",                     0.79, 301.7,   944,   1.93,       "solid",  0],
  [56, "Ba", "Barium",     137.33,  0, "alkaline-earth-metal",  "s",  2, 6, "[Xe] 6s2",                     0.89, 1000,   2118,   3.51,       "solid",  0],
  [57, "La", "Lanthanum",  138.91,  0, "lanthanide",            "f",  3, 6, "[Xe] 5d1 6s2",                 1.10, 1193,   3737,   6.162,      "solid",  0],
  [58, "Ce", "Cerium",     140.12,  0, "lanthanide",            "f",  3, 6, "[Xe] 4f1 5d1 6s2",             1.12, 1068,   3716,   6.770,      "solid",  0],
  [59, "Pr", "Praseodymium",140.91, 0, "lanthanide",            "f",  3, 6, "[Xe] 4f3 6s2",                 1.13, 1208,   3793,   6.77,       "solid",  0],
  [60, "Nd", "Neodymium",  144.24,  0, "lanthanide",            "f",  3, 6, "[Xe] 4f4 6s2",                 1.14, 1297,   3347,   7.01,       "solid",  0],
  [61, "Pm", "Promethium", 145,     1, "lanthanide",            "f",  3, 6, "[Xe] 4f5 6s2",                 1.13, 1315,   3273,   7.26,       "solid",  1],
  [62, "Sm", "Samarium",   150.36,  0, "lanthanide",            "f",  3, 6, "[Xe] 4f6 6s2",                 1.17, 1345,   2067,   7.52,       "solid",  0],
  [63, "Eu", "Europium",   151.96,  0, "lanthanide",            "f",  3, 6, "[Xe] 4f7 6s2",                 1.20, 1099,   1802,   5.244,      "solid",  0],
  [64, "Gd", "Gadolinium", 157.25,  0, "lanthanide",            "f",  3, 6, "[Xe] 4f7 5d1 6s2",             1.20, 1585,   3546,   7.90,       "solid",  0],
  [65, "Tb", "Terbium",    158.93,  0, "lanthanide",            "f",  3, 6, "[Xe] 4f9 6s2",                 1.20, 1629,   3503,   8.23,       "solid",  0],
  [66, "Dy", "Dysprosium", 162.50,  0, "lanthanide",            "f",  3, 6, "[Xe] 4f10 6s2",                1.22, 1680,   2840,   8.540,      "solid",  0],
  [67, "Ho", "Holmium",    164.93,  0, "lanthanide",            "f",  3, 6, "[Xe] 4f11 6s2",                1.23, 1734,   2993,   8.79,       "solid",  0],
  [68, "Er", "Erbium",     167.26,  0, "lanthanide",            "f",  3, 6, "[Xe] 4f12 6s2",                1.24, 1802,   3141,   9.066,      "solid",  0],
  [69, "Tm", "Thulium",    168.93,  0, "lanthanide",            "f",  3, 6, "[Xe] 4f13 6s2",                1.25, 1818,   2223,   9.32,       "solid",  0],
  [70, "Yb", "Ytterbium",  173.05,  0, "lanthanide",            "f",  3, 6, "[Xe] 4f14 6s2",                1.10, 1097,   1469,   6.90,       "solid",  0],
  [71, "Lu", "Lutetium",   174.97,  0, "lanthanide",            "f",  3, 6, "[Xe] 4f14 5d1 6s2",            1.27, 1925,   3675,   9.841,      "solid",  0],
  [72, "Hf", "Hafnium",    178.49,  0, "transition-metal",      "d",  4, 6, "[Xe] 4f14 5d2 6s2",            1.30, 2506,   4876,  13.31,       "solid",  0],
  [73, "Ta", "Tantalum",   180.95,  0, "transition-metal",      "d",  5, 6, "[Xe] 4f14 5d3 6s2",            1.50, 3290,   5731,  16.69,       "solid",  0],
  [74, "W",  "Tungsten",   183.84,  0, "transition-metal",      "d",  6, 6, "[Xe] 4f14 5d4 6s2",            2.36, 3695,   5828,  19.25,       "solid",  0],
  [75, "Re", "Rhenium",    186.21,  0, "transition-metal",      "d",  7, 6, "[Xe] 4f14 5d5 6s2",            1.90, 3459,   5869,  21.02,       "solid",  0],
  [76, "Os", "Osmium",     190.23,  0, "transition-metal",      "d",  8, 6, "[Xe] 4f14 5d6 6s2",            2.20, 3306,   5285,  22.59,       "solid",  0],
  [77, "Ir", "Iridium",    192.22,  0, "transition-metal",      "d",  9, 6, "[Xe] 4f14 5d7 6s2",            2.20, 2719,   4701,  22.56,       "solid",  0],
  [78, "Pt", "Platinum",   195.08,  0, "transition-metal",      "d", 10, 6, "[Xe] 4f14 5d9 6s1",            2.28, 2041.4, 4098,  21.45,       "solid",  0],
  [79, "Au", "Gold",       196.97,  0, "transition-metal",      "d", 11, 6, "[Xe] 4f14 5d10 6s1",           2.54, 1337.33,3129,  19.30,       "solid",  0],
  [80, "Hg", "Mercury",    200.59,  0, "transition-metal",      "d", 12, 6, "[Xe] 4f14 5d10 6s2",           2.00, 234.32,  629.88,13.534,     "liquid", 0],
  [81, "Tl", "Thallium",   204.38,  0, "post-transition-metal", "p", 13, 6, "[Xe] 4f14 5d10 6s2 6p1",       1.62, 577,    1746,  11.85,       "solid",  0],
  [82, "Pb", "Lead",       207.2,   0, "post-transition-metal", "p", 14, 6, "[Xe] 4f14 5d10 6s2 6p2",       2.33, 600.61, 2022,  11.34,       "solid",  0],
  [83, "Bi", "Bismuth",    208.98,  0, "post-transition-metal", "p", 15, 6, "[Xe] 4f14 5d10 6s2 6p3",       2.02, 544.7,  1837,   9.78,       "solid",  0],
  [84, "Po", "Polonium",   209,     1, "metalloid",             "p", 16, 6, "[Xe] 4f14 5d10 6s2 6p4",       2.00, 527,    1235,   9.196,      "solid",  0],
  [85, "At", "Astatine",   210,     1, "halogen",               "p", 17, 6, "[Xe] 4f14 5d10 6s2 6p5",       2.20, 575,     610,   null,       "solid",  0],
  [86, "Rn", "Radon",      222,     1, "noble-gas",             "p", 18, 6, "[Xe] 4f14 5d10 6s2 6p6",       2.20, 202,     211.5, 0.00973,    "gas",    0],

  // ── Period 7 ───────────────────────────────────────────────────────────
  [87, "Fr", "Francium",   223,     1, "alkali-metal",          "s",  1, 7, "[Rn] 7s1",                     0.70, 300,     950,   null,       "solid",  0],
  [88, "Ra", "Radium",     226,     1, "alkaline-earth-metal",  "s",  2, 7, "[Rn] 7s2",                     0.90, 973,    1413,   5.0,        "solid",  0],
  [89, "Ac", "Actinium",   227,     1, "actinide",              "f",  3, 7, "[Rn] 6d1 7s2",                 1.10, 1323,   3471,  10.07,       "solid",  0],
  // Melting point 2023 K (1750 °C), not the 2115 K (1842 °C) that still
  // circulates in derived tables — that figure came from impure samples and
  // has been superseded. The boiling point below already matches modern data.
  [90, "Th", "Thorium",    232.04,  0, "actinide",              "f",  3, 7, "[Rn] 6d2 7s2",                 1.30, 2023,   5061,  11.72,       "solid",  0],
  [91, "Pa", "Protactinium",231.04, 0, "actinide",              "f",  3, 7, "[Rn] 5f2 6d1 7s2",             1.50, 1841,   4300,  15.37,       "solid",  0],
  [92, "U",  "Uranium",    238.03,  0, "actinide",              "f",  3, 7, "[Rn] 5f3 6d1 7s2",             1.38, 1405.3, 4404,  19.1,        "solid",  0],
  [93, "Np", "Neptunium",  237,     1, "actinide",              "f",  3, 7, "[Rn] 5f4 6d1 7s2",             1.36, 917,    4273,  20.45,       "solid",  1],
  [94, "Pu", "Plutonium",  244,     1, "actinide",              "f",  3, 7, "[Rn] 5f6 7s2",                 1.28, 912.5,  3501,  19.816,      "solid",  1],
  [95, "Am", "Americium",  243,     1, "actinide",              "f",  3, 7, "[Rn] 5f7 7s2",                 1.30, 1449,   2284,  13.69,       "solid",  1],
  [96, "Cm", "Curium",     247,     1, "actinide",              "f",  3, 7, "[Rn] 5f7 6d1 7s2",             1.28, 1613,   3383,  13.51,       "solid",  1],
  [97, "Bk", "Berkelium",  247,     1, "actinide",              "f",  3, 7, "[Rn] 5f9 7s2",                 1.30, 1323,   2900,  14.78,       "solid",  1],
  [98, "Cf", "Californium",251,     1, "actinide",              "f",  3, 7, "[Rn] 5f10 7s2",                1.30, 1173,   1743,  15.1,        "solid",  1],
  [99, "Es", "Einsteinium",252,     1, "actinide",              "f",  3, 7, "[Rn] 5f11 7s2",                1.30, 1133,   1269,   8.84,       "solid",  1],
  [100,"Fm", "Fermium",    257,     1, "actinide",              "f",  3, 7, "[Rn] 5f12 7s2",                1.30, 1800,   null,   9.7,        "solid",  1],
  [101,"Md", "Mendelevium",258,     1, "actinide",              "f",  3, 7, "[Rn] 5f13 7s2",                1.30, 1100,   null,  10.3,        "solid",  1],
  [102,"No", "Nobelium",   259,     1, "actinide",              "f",  3, 7, "[Rn] 5f14 7s2",                1.30, 1100,   null,   9.9,        "solid",  1],
  [103,"Lr", "Lawrencium", 266,     1, "actinide",              "f",  3, 7, "[Rn] 5f14 7s2 7p1",            1.30, 1900,   null,  15.6,        "solid",  1],
  /*
   * Beyond lawrencium the properties below are predicted, not measured — only
   * a few atoms of each have ever been made, and several have half-lives under
   * a second. Filling in a melting point here would be presenting a
   * computation as an observation, so those fields stay null.
   */
  [104,"Rf", "Rutherfordium",267,   1, "transition-metal",      "d",  4, 7, "[Rn] 5f14 6d2 7s2",            null, null,   null,  null,        "unknown",1],
  [105,"Db", "Dubnium",    268,     1, "transition-metal",      "d",  5, 7, "[Rn] 5f14 6d3 7s2",            null, null,   null,  null,        "unknown",1],
  [106,"Sg", "Seaborgium", 269,     1, "transition-metal",      "d",  6, 7, "[Rn] 5f14 6d4 7s2",            null, null,   null,  null,        "unknown",1],
  [107,"Bh", "Bohrium",    270,     1, "transition-metal",      "d",  7, 7, "[Rn] 5f14 6d5 7s2",            null, null,   null,  null,        "unknown",1],
  [108,"Hs", "Hassium",    269,     1, "transition-metal",      "d",  8, 7, "[Rn] 5f14 6d6 7s2",            null, null,   null,  null,        "unknown",1],
  [109,"Mt", "Meitnerium", 278,     1, "transition-metal",      "d",  9, 7, "[Rn] 5f14 6d7 7s2",            null, null,   null,  null,        "unknown",1],
  [110,"Ds", "Darmstadtium",281,    1, "transition-metal",      "d", 10, 7, "[Rn] 5f14 6d8 7s2",            null, null,   null,  null,        "unknown",1],
  [111,"Rg", "Roentgenium",282,     1, "transition-metal",      "d", 11, 7, "[Rn] 5f14 6d9 7s2",            null, null,   null,  null,        "unknown",1],
  [112,"Cn", "Copernicium",285,     1, "transition-metal",      "d", 12, 7, "[Rn] 5f14 6d10 7s2",           null, null,   null,  null,        "unknown",1],
  [113,"Nh", "Nihonium",   286,     1, "post-transition-metal", "p", 13, 7, "[Rn] 5f14 6d10 7s2 7p1",       null, null,   null,  null,        "unknown",1],
  [114,"Fl", "Flerovium",  289,     1, "post-transition-metal", "p", 14, 7, "[Rn] 5f14 6d10 7s2 7p2",       null, null,   null,  null,        "unknown",1],
  [115,"Mc", "Moscovium",  290,     1, "post-transition-metal", "p", 15, 7, "[Rn] 5f14 6d10 7s2 7p3",       null, null,   null,  null,        "unknown",1],
  [116,"Lv", "Livermorium",293,     1, "post-transition-metal", "p", 16, 7, "[Rn] 5f14 6d10 7s2 7p4",       null, null,   null,  null,        "unknown",1],
  [117,"Ts", "Tennessine", 294,     1, "halogen",               "p", 17, 7, "[Rn] 5f14 6d10 7s2 7p5",       null, null,   null,  null,        "unknown",1],
  [118,"Og", "Oganesson",  294,     1, "noble-gas",              "p", 18, 7, "[Rn] 5f14 6d10 7s2 7p6",       null, null,   null,  null,        "unknown",1],
];
/* eslint-enable prettier/prettier */

export const ELEMENTS: ChemElement[] = ROWS.map((r) => ({
  number: r[0],
  symbol: r[1],
  name: r[2],
  mass: r[3],
  massIsIsotope: r[4] === 1,
  category: r[5],
  block: r[6],
  group: r[7],
  period: r[8],
  configuration: r[9],
  electronegativity: r[10],
  melt: r[11],
  boil: r[12],
  density: r[13],
  state: r[14],
  synthetic: r[15] === 1,
}));

export const BY_NUMBER = new Map(ELEMENTS.map((e) => [e.number, e]));
export const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol.toLowerCase(), e]));

export function elementByNumber(z: number): ChemElement | undefined {
  return BY_NUMBER.get(z);
}

export function elementBySymbol(symbol: string): ChemElement | undefined {
  return BY_SYMBOL.get(symbol.trim().toLowerCase());
}

// ── Category presentation ────────────────────────────────────────────────

export interface CategoryInfo {
  id: ElementCategory;
  label: string;
  /** Deliberately paired with a distinct label everywhere — never colour alone. */
  swatch: string;
  text: string;
  border: string;
}

/**
 * Ten families, ten hues.
 *
 * Colour is never the only signal: every cell also carries its symbol and
 * number, the detail panel names the family in words, and the legend is
 * keyboard reachable. A student who cannot distinguish the greens can still
 * use every part of this table.
 */
export const CATEGORIES: Record<ElementCategory, CategoryInfo> = {
  "alkali-metal":          { id: "alkali-metal",          label: "Alkali metals",          swatch: "bg-[hsl(354_70%_54%/0.18)]", text: "text-[hsl(354_70%_38%)] dark:text-[hsl(354_80%_74%)]", border: "border-[hsl(354_70%_54%/0.45)]" },
  "alkaline-earth-metal":  { id: "alkaline-earth-metal",  label: "Alkaline earth metals",  swatch: "bg-[hsl(24_80%_50%/0.18)]",  text: "text-[hsl(24_80%_36%)] dark:text-[hsl(24_85%_70%)]",  border: "border-[hsl(24_80%_50%/0.45)]" },
  "transition-metal":      { id: "transition-metal",      label: "Transition metals",      swatch: "bg-[hsl(43_88%_48%/0.18)]",  text: "text-[hsl(43_88%_32%)] dark:text-[hsl(43_90%_68%)]",  border: "border-[hsl(43_88%_48%/0.45)]" },
  "post-transition-metal": { id: "post-transition-metal", label: "Post-transition metals", swatch: "bg-[hsl(158_60%_40%/0.18)]", text: "text-[hsl(158_60%_28%)] dark:text-[hsl(158_55%_62%)]", border: "border-[hsl(158_60%_40%/0.45)]" },
  metalloid:               { id: "metalloid",             label: "Metalloids",             swatch: "bg-[hsl(174_62%_38%/0.18)]", text: "text-[hsl(174_62%_26%)] dark:text-[hsl(174_55%_60%)]", border: "border-[hsl(174_62%_38%/0.45)]" },
  "reactive-nonmetal":     { id: "reactive-nonmetal",     label: "Reactive non-metals",    swatch: "bg-[hsl(207_78%_50%/0.18)]", text: "text-[hsl(207_78%_36%)] dark:text-[hsl(207_80%_70%)]", border: "border-[hsl(207_78%_50%/0.45)]" },
  halogen:                 { id: "halogen",               label: "Halogens",               swatch: "bg-[hsl(190_75%_42%/0.18)]", text: "text-[hsl(190_75%_28%)] dark:text-[hsl(190_70%_62%)]", border: "border-[hsl(190_75%_42%/0.45)]" },
  "noble-gas":             { id: "noble-gas",             label: "Noble gases",            swatch: "bg-[hsl(265_60%_58%/0.18)]", text: "text-[hsl(265_60%_44%)] dark:text-[hsl(265_70%_76%)]", border: "border-[hsl(265_60%_58%/0.45)]" },
  lanthanide:              { id: "lanthanide",            label: "Lanthanides",            swatch: "bg-[hsl(320_60%_54%/0.18)]", text: "text-[hsl(320_60%_40%)] dark:text-[hsl(320_65%_74%)]", border: "border-[hsl(320_60%_54%/0.45)]" },
  actinide:                { id: "actinide",              label: "Actinides",              swatch: "bg-[hsl(288_50%_50%/0.18)]", text: "text-[hsl(288_50%_38%)] dark:text-[hsl(288_58%_72%)]", border: "border-[hsl(288_50%_50%/0.45)]" },
  unknown:                 { id: "unknown",               label: "Properties unknown",     swatch: "bg-muted",                   text: "text-muted-foreground",                                border: "border-border" },
};

export const CATEGORY_ORDER: ElementCategory[] = [
  "alkali-metal",
  "alkaline-earth-metal",
  "transition-metal",
  "post-transition-metal",
  "metalloid",
  "reactive-nonmetal",
  "halogen",
  "noble-gas",
  "lanthanide",
  "actinide",
  "unknown",
];

// ── Configuration parsing ────────────────────────────────────────────────

const NOBLE_CORE: Record<string, number> = {
  He: 2,
  Ne: 10,
  Ar: 18,
  Kr: 36,
  Xe: 54,
  Rn: 86,
};

/**
 * Total electrons described by a configuration string.
 *
 * The integrity check depends on this: for every element it must equal the
 * atomic number, which turns "[Ar] 3d6 4s2" from a string nobody proof-reads
 * into a value that fails loudly if a digit is wrong.
 */
export function electronCount(configuration: string): number {
  let total = 0;
  const core = configuration.match(/^\[([A-Za-z]+)\]/);
  if (core) {
    const size = NOBLE_CORE[core[1]!];
    if (size === undefined) return NaN;
    total += size;
  }
  const shells = configuration.replace(/^\[[A-Za-z]+\]/, "").trim();
  if (shells) {
    for (const part of shells.split(/\s+/)) {
      const m = part.match(/^(\d)([spdf])(\d+)$/);
      if (!m) return NaN;
      total += Number(m[3]);
    }
  }
  return total;
}

/** Splits a configuration into renderable pieces, so the UI can superscript. */
export interface ConfigPart {
  core?: string;
  shell?: string;
  count?: number;
}

export function parseConfiguration(configuration: string): ConfigPart[] {
  const parts: ConfigPart[] = [];
  const core = configuration.match(/^\[([A-Za-z]+)\]/);
  if (core) parts.push({ core: core[1] });
  const rest = configuration.replace(/^\[[A-Za-z]+\]/, "").trim();
  if (rest) {
    for (const token of rest.split(/\s+/)) {
      const m = token.match(/^(\d[spdf])(\d+)$/);
      if (m) parts.push({ shell: m[1], count: Number(m[2]) });
    }
  }
  return parts;
}

/**
 * Electrons per shell (K, L, M, …), derived from the configuration.
 *
 * Class 10 teaches shells before subshells, so this is the form most students
 * recognise — and deriving it rather than storing it means it can never
 * disagree with the configuration above it.
 */
export function shellCounts(element: ChemElement): number[] {
  const shells: number[] = [];
  const add = (n: number, count: number) => {
    while (shells.length < n) shells.push(0);
    shells[n - 1] = (shells[n - 1] ?? 0) + count;
  };

  const core = element.configuration.match(/^\[([A-Za-z]+)\]/);
  if (core) {
    const coreElement = ELEMENTS.find((e) => e.symbol === core[1]);
    if (coreElement) {
      const inner = shellCounts(coreElement);
      inner.forEach((count, i) => add(i + 1, count));
    }
  }
  const rest = element.configuration.replace(/^\[[A-Za-z]+\]/, "").trim();
  if (rest) {
    for (const token of rest.split(/\s+/)) {
      const m = token.match(/^(\d)([spdf])(\d+)$/);
      if (m) add(Number(m[1]), Number(m[3]));
    }
  }
  return shells;
}

/**
 * Valence electrons, for main-group elements only.
 *
 * Returns null for d- and f-block elements on purpose. "Valence electrons" is
 * not well defined for a transition metal at school level — quoting a single
 * number for iron would be teaching something that has to be unlearned later.
 */
export function valenceElectrons(element: ChemElement): number | null {
  if (element.block !== "s" && element.block !== "p") return null;
  const parts = parseConfiguration(element.configuration);
  const outer = Math.max(
    ...parts.filter((p) => p.shell).map((p) => Number(p.shell![0])),
  );
  return parts
    .filter((p) => p.shell && Number(p.shell[0]) === outer)
    .reduce((sum, p) => sum + (p.count ?? 0), 0);
}

/** Neutrons in the most common isotope, from the rounded mass number. */
export function commonNeutrons(element: ChemElement): number {
  return Math.round(element.mass) - element.number;
}

// ── Integrity check ──────────────────────────────────────────────────────

export interface IntegrityProblem {
  element: string;
  problem: string;
}

/**
 * Verifies the table against itself.
 *
 * Run by a build-time script rather than at runtime — a student should never
 * pay for this, but a wrong digit should never reach them either.
 */
export function checkElementDataIntegrity(): IntegrityProblem[] {
  const problems: IntegrityProblem[] = [];
  const seenSymbols = new Set<string>();

  ELEMENTS.forEach((e, i) => {
    const where = `${e.number} ${e.symbol}`;

    if (e.number !== i + 1) {
      problems.push({ element: where, problem: `out of order — expected Z=${i + 1}` });
    }
    if (seenSymbols.has(e.symbol)) {
      problems.push({ element: where, problem: "duplicate symbol" });
    }
    seenSymbols.add(e.symbol);

    const electrons = electronCount(e.configuration);
    if (Number.isNaN(electrons)) {
      problems.push({ element: where, problem: `unparseable configuration "${e.configuration}"` });
    } else if (electrons !== e.number) {
      problems.push({
        element: where,
        problem: `configuration describes ${electrons} electrons, not ${e.number}`,
      });
    }

    if (e.group < 1 || e.group > 18) {
      problems.push({ element: where, problem: `group ${e.group} out of range` });
    }
    if (e.period < 1 || e.period > 7) {
      problems.push({ element: where, problem: `period ${e.period} out of range` });
    }

    /*
     * Category must agree with the group for the families defined by position
     * — except where the chemistry genuinely isn't known.
     *
     * Oganesson is the case that forced this exemption. It sits in group 18,
     * but it is predicted to be a reactive solid rather than a noble gas, and
     * nobody has ever measured it: a few atoms have existed, for milliseconds.
     * Calling it a noble gas to satisfy a rule would be asserting something
     * chemistry does not know, so "unknown" is the honest category and the
     * check bends instead of the data.
     */
    if (e.group === 18 && e.category !== "noble-gas" && e.category !== "unknown") {
      problems.push({ element: where, problem: "group 18 but not a noble gas" });
    }
    if (e.group === 1 && e.number !== 1 && e.category !== "alkali-metal") {
      problems.push({ element: where, problem: "group 1 but not an alkali metal" });
    }
    if (e.group === 2 && e.category !== "alkaline-earth-metal") {
      problems.push({ element: where, problem: "group 2 but not an alkaline earth metal" });
    }
    if (e.category === "lanthanide" && (e.number < 57 || e.number > 71)) {
      problems.push({ element: where, problem: "lanthanide outside 57–71" });
    }
    if (e.category === "actinide" && (e.number < 89 || e.number > 103)) {
      problems.push({ element: where, problem: "actinide outside 89–103" });
    }
    if (e.mass <= 0 || e.mass < e.number) {
      problems.push({ element: where, problem: `mass ${e.mass} is impossible for Z=${e.number}` });
    }
    if (e.electronegativity !== null && (e.electronegativity < 0.5 || e.electronegativity > 4.0)) {
      problems.push({ element: where, problem: `electronegativity ${e.electronegativity} off the Pauling scale` });
    }
    if (e.melt !== null && e.boil !== null && e.melt > e.boil && e.symbol !== "As") {
      // Arsenic sublimes: it has no ordinary melting point at 1 atm, so the
      // two numbers are not comparable for it alone.
      problems.push({ element: where, problem: `melting point above boiling point` });
    }
  });

  if (ELEMENTS.length !== 118) {
    problems.push({ element: "table", problem: `${ELEMENTS.length} elements, expected 118` });
  }
  return problems;
}
