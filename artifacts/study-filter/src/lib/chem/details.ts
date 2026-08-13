/**
 * Supplementary element data: the parts a student reads rather than looks up.
 *
 * Split from `elements.ts` on purpose. That file is the complete 118-row
 * reference table — every element has every core field. This one is
 * *deliberately incomplete*: it carries descriptions, uses, discovery notes,
 * radii and ionisation energies only where the value is well established and
 * worth a student's attention.
 *
 * The rule from the brief, applied literally: where a value is not reliably
 * known, it is absent, and the UI hides the field rather than printing "N/A".
 * A screen of N/As teaches nothing and makes the reliable values look doubtful
 * by association.
 *
 * Coverage is concentrated on the elements CBSE actually examines — roughly
 * the first thirty, plus the metals and non-metals that appear in the Class 10
 * chapters on reactions, acids and bases, metals and non-metals, carbon
 * compounds, and periodic classification.
 *
 * ── Conventions ─────────────────────────────────────────────────────────
 *
 * `RADII_PM` are **empirical** atomic radii in picometres (the Slater set).
 * Radii are convention-dependent — covalent, van der Waals, metallic and
 * calculated values differ by tens of picometres — so one convention is used
 * throughout and named wherever the number is shown. Mixing conventions across
 * a period would produce a trend line that is an artefact of the sources.
 *
 * `IONISATION_KJ` are **first** ionisation energies in kJ/mol.
 */

/** Empirical (Slater) atomic radii, picometres. */
export const RADII_PM: Record<string, number> = {
  H: 25, He: 31,
  Li: 145, Be: 105, B: 85, C: 70, N: 65, O: 60, F: 50, Ne: 38,
  Na: 180, Mg: 150, Al: 125, Si: 110, P: 100, S: 100, Cl: 100, Ar: 71,
  K: 220, Ca: 180, Sc: 160, Ti: 140, V: 135, Cr: 140, Mn: 140, Fe: 140,
  Co: 135, Ni: 135, Cu: 135, Zn: 135, Ga: 130, Ge: 125, As: 115, Se: 115,
  Br: 115, Kr: 88,
  Rb: 235, Sr: 200, Y: 180, Zr: 155, Nb: 145, Mo: 145, Tc: 135, Ru: 130,
  Rh: 135, Pd: 140, Ag: 160, Cd: 155, In: 155, Sn: 145, Sb: 145, Te: 140,
  I: 140, Xe: 108,
  Cs: 260, Ba: 215,
};

/** First ionisation energy, kJ/mol. */
export const IONISATION_KJ: Record<string, number> = {
  H: 1312, He: 2372,
  Li: 520, Be: 899, B: 801, C: 1086, N: 1402, O: 1314, F: 1681, Ne: 2081,
  Na: 496, Mg: 738, Al: 578, Si: 787, P: 1012, S: 1000, Cl: 1251, Ar: 1521,
  K: 419, Ca: 590, Sc: 633, Ti: 659, V: 651, Cr: 653, Mn: 717, Fe: 762,
  Co: 760, Ni: 737, Cu: 745, Zn: 906, Ga: 579, Ge: 762, As: 947, Se: 941,
  Br: 1140, Kr: 1351,
  Rb: 403, Sr: 549, Ag: 731, Cd: 868, In: 558, Sn: 709, Sb: 834, Te: 869,
  I: 1008, Xe: 1170,
  Cs: 376, Ba: 503,
};

/** Common oxidation states, most characteristic first. */
export const OXIDATION_STATES: Record<string, number[]> = {
  H: [1, -1], Li: [1], Be: [2], B: [3], C: [4, 2, -4], N: [-3, 3, 5], O: [-2], F: [-1],
  Na: [1], Mg: [2], Al: [3], Si: [4, -4], P: [-3, 3, 5], S: [-2, 4, 6], Cl: [-1, 1, 5, 7],
  K: [1], Ca: [2], Cr: [2, 3, 6], Mn: [2, 4, 7], Fe: [2, 3], Co: [2, 3], Ni: [2],
  Cu: [1, 2], Zn: [2], Br: [-1, 1, 5], Ag: [1], Sn: [2, 4], I: [-1, 1, 5, 7],
  Ba: [2], Pt: [2, 4], Au: [1, 3], Hg: [1, 2], Pb: [2, 4], U: [4, 6],
};

export interface ElementUse {
  /** A short category the student will recognise. */
  area: string;
  note: string;
}

export interface ElementDetail {
  /** One or two sentences. Never more — this is a study tool. */
  summary: string;
  uses?: ElementUse[];
  discoveredBy?: string;
  discoveryYear?: number;
  /** Where the name comes from. Often the most memorable fact about it. */
  nameOrigin?: string;
  /** How it behaves chemically, in a line. */
  reactivity?: string;
}

export const DETAILS: Record<string, ElementDetail> = {
  H: {
    summary:
      "The lightest element and by far the most abundant in the universe. It has a single proton and a single electron.",
    uses: [
      { area: "Fuel", note: "Burns with oxygen to give only water, which is why it is studied as a clean fuel." },
      { area: "Fertiliser", note: "Combined with nitrogen to make ammonia, the basis of most fertilisers." },
      { area: "Food industry", note: "Hydrogenation turns liquid vegetable oils into solid fats." },
    ],
    discoveredBy: "Henry Cavendish",
    discoveryYear: 1766,
    nameOrigin: "Greek hydro (water) and genes (forming) — it forms water when it burns.",
    reactivity: "Reacts with oxygen explosively when ignited, and with metals to form hydrides.",
  },
  He: {
    summary: "The second most abundant element in the universe, and completely unreactive.",
    uses: [
      { area: "Balloons and airships", note: "Lighter than air and, unlike hydrogen, will not burn." },
      { area: "Medicine", note: "Cools the superconducting magnets in MRI scanners." },
    ],
    discoveredBy: "Pierre Janssen and Norman Lockyer",
    discoveryYear: 1868,
    nameOrigin: "Greek helios (sun) — it was found in the Sun's spectrum before it was found on Earth.",
    reactivity: "Effectively inert; its outer shell is full with two electrons.",
  },
  Li: {
    summary: "The lightest metal, soft enough to cut with a knife, and stored in oil because it reacts with air.",
    uses: [
      { area: "Batteries", note: "Lithium-ion cells power phones, laptops and electric vehicles." },
      { area: "Medicine", note: "Lithium salts are used to treat bipolar disorder." },
    ],
    discoveredBy: "Johan August Arfwedson",
    discoveryYear: 1817,
    nameOrigin: "Greek lithos (stone) — it was first found in a mineral.",
    reactivity: "Reacts with water to give hydrogen and an alkaline solution, less violently than sodium.",
  },
  C: {
    summary:
      "The element life is built from. Its ability to bond to itself in chains and rings gives rise to millions of compounds.",
    uses: [
      { area: "Fuel", note: "Coal, petroleum and natural gas are all carbon compounds." },
      { area: "Materials", note: "Diamond cuts and drills; graphite lubricates and conducts." },
      { area: "Electronics", note: "Graphite electrodes and carbon fibre composites." },
    ],
    nameOrigin: "Latin carbo (charcoal).",
    reactivity: "Burns in air to carbon dioxide. Catenation — bonding to itself — is its defining property.",
  },
  N: {
    summary: "Makes up about 78% of the air. Its triple bond is very strong, which makes the gas unreactive.",
    uses: [
      { area: "Fertiliser", note: "Converted to ammonia and then to nitrates that plants can absorb." },
      { area: "Food packaging", note: "Displaces oxygen so food does not oxidise." },
    ],
    discoveredBy: "Daniel Rutherford",
    discoveryYear: 1772,
    reactivity: "Very unreactive as N₂ because the triple bond is hard to break.",
  },
  O: {
    summary:
      "The most abundant element in the Earth's crust, and the one respiration depends on. It makes up about 21% of the air.",
    uses: [
      { area: "Medicine", note: "Oxygen therapy supports patients who cannot breathe enough on their own." },
      { area: "Steel making", note: "Blown through molten iron to burn off excess carbon." },
      { area: "Space", note: "Liquid oxygen is the oxidiser in most rocket engines." },
    ],
    discoveredBy: "Carl Wilhelm Scheele and Joseph Priestley",
    discoveryYear: 1774,
    nameOrigin: "Greek oxys (acid) and genes (forming) — from a mistaken belief that all acids contain it.",
    reactivity: "Supports combustion and oxidises most elements; highly reactive.",
  },
  F: {
    summary: "The most reactive element and the most electronegative. It attacks almost everything it touches.",
    uses: [
      { area: "Dental care", note: "Fluoride in toothpaste hardens tooth enamel against decay." },
      { area: "Materials", note: "Used to make PTFE, the non-stick coating on pans." },
    ],
    discoveredBy: "Henri Moissan",
    discoveryYear: 1886,
    reactivity: "The strongest oxidising element; reacts with nearly all other elements.",
  },
  Ne: {
    summary: "An inert noble gas that glows orange-red when an electric current passes through it.",
    uses: [{ area: "Lighting", note: "The original neon sign — the colour is the element's own emission spectrum." }],
    discoveredBy: "William Ramsay and Morris Travers",
    discoveryYear: 1898,
    nameOrigin: "Greek neos (new).",
  },
  Na: {
    summary:
      "A soft, silvery metal so reactive it is stored under kerosene. Essential to nerve function as the sodium ion.",
    uses: [
      { area: "Food", note: "As sodium chloride — common salt." },
      { area: "Industry", note: "Sodium hydroxide is used to make soap, paper and textiles." },
      { area: "Lighting", note: "Sodium vapour lamps give the yellow glow of older street lights." },
    ],
    discoveredBy: "Humphry Davy",
    discoveryYear: 1807,
    reactivity:
      "Reacts vigorously with water, giving hydrogen and sodium hydroxide, with enough heat to ignite the hydrogen. Stored in kerosene to keep air and moisture away.",
  },
  Mg: {
    summary: "A light metal that burns with a brilliant white flame. The central atom of chlorophyll.",
    uses: [
      { area: "Alloys", note: "Light, strong magnesium alloys are used in aircraft and car parts." },
      { area: "Medicine", note: "Magnesium hydroxide is the antacid milk of magnesia." },
    ],
    discoveredBy: "Humphry Davy",
    discoveryYear: 1808,
    reactivity: "Burns in air with an intense white light, forming magnesium oxide.",
  },
  Al: {
    summary:
      "The most abundant metal in the Earth's crust. Light, corrosion-resistant, and extracted from bauxite by electrolysis.",
    uses: [
      { area: "Construction", note: "Window frames and structural panels — light and does not rust." },
      { area: "Packaging", note: "Foil and drinks cans." },
      { area: "Electricity", note: "Overhead power lines, because it is light for its conductivity." },
    ],
    discoveredBy: "Hans Christian Ørsted",
    discoveryYear: 1825,
    reactivity: "Forms a thin oxide layer immediately in air, which then protects the metal beneath.",
  },
  Si: {
    summary: "A metalloid, second only to oxygen in the Earth's crust, and the basis of the semiconductor industry.",
    uses: [
      { area: "Electronics", note: "Silicon chips — its semiconducting behaviour is the foundation of computing." },
      { area: "Construction", note: "As silica in glass, cement and concrete." },
      { area: "Space", note: "Solar cells convert sunlight to electricity using silicon." },
    ],
    discoveredBy: "Jöns Jacob Berzelius",
    discoveryYear: 1824,
  },
  P: {
    summary: "Essential to life — it is in DNA and in bone. White phosphorus ignites spontaneously in air.",
    uses: [
      { area: "Agriculture", note: "Phosphate fertilisers." },
      { area: "Everyday", note: "Red phosphorus on the striking surface of a matchbox." },
    ],
    discoveredBy: "Hennig Brand",
    discoveryYear: 1669,
    nameOrigin: "Greek phosphoros (light-bringer) — white phosphorus glows in the dark.",
  },
  S: {
    summary: "A yellow non-metal known since antiquity, found near volcanoes and used to make sulfuric acid.",
    uses: [
      { area: "Industry", note: "Sulfuric acid is the most produced industrial chemical in the world." },
      { area: "Agriculture", note: "Fungicides and fertilisers." },
      { area: "Materials", note: "Vulcanising rubber to make it hard-wearing." },
    ],
    reactivity: "Burns in air with a blue flame to give sulfur dioxide, a choking gas.",
  },
  Cl: {
    summary: "A poisonous green-yellow gas, and one of the most useful disinfectants ever found.",
    uses: [
      { area: "Water treatment", note: "Kills bacteria in drinking water and swimming pools." },
      { area: "Materials", note: "Used to make PVC." },
      { area: "Household", note: "The active ingredient in bleach." },
    ],
    discoveredBy: "Carl Wilhelm Scheele",
    discoveryYear: 1774,
    reactivity: "A strong oxidising agent; reacts with most metals to form chlorides.",
  },
  Ar: {
    summary: "The most common noble gas in the atmosphere, at just under 1% of the air.",
    uses: [
      { area: "Welding", note: "Shields hot metal from oxygen so it does not oxidise." },
      { area: "Lighting", note: "Fills incandescent bulbs to stop the filament burning away." },
    ],
    nameOrigin: "Greek argos (lazy) — because it refuses to react.",
  },
  K: {
    summary: "A very reactive alkali metal, and an essential nutrient for both plants and nerves.",
    uses: [
      { area: "Agriculture", note: "Potash fertilisers supply potassium to crops." },
      { area: "Biology", note: "The potassium ion is essential to nerve impulses and heart rhythm." },
    ],
    discoveredBy: "Humphry Davy",
    discoveryYear: 1807,
    reactivity: "More reactive than sodium — it ignites on contact with water, burning lilac.",
  },
  Ca: {
    summary: "The metal in bones, teeth, limestone and cement. Fifth most abundant element in the crust.",
    uses: [
      { area: "Construction", note: "As limestone and cement, the basis of most building." },
      { area: "Biology", note: "Builds bone and teeth, and is needed for muscles to contract." },
    ],
    discoveredBy: "Humphry Davy",
    discoveryYear: 1808,
  },
  Fe: {
    summary: "The most used metal on Earth, and the main component of steel. Also the metal at the centre of haemoglobin.",
    uses: [
      { area: "Construction", note: "Steel is iron alloyed with carbon — beams, rails, reinforcement." },
      { area: "Biology", note: "Haemoglobin uses iron to carry oxygen in the blood." },
      { area: "Transport", note: "Vehicle bodies, ships and machinery." },
    ],
    reactivity: "Rusts in the presence of both air and water — iron oxide, which flakes away rather than protecting.",
  },
  Cu: {
    summary: "One of the first metals worked by humans. An excellent conductor of heat and electricity.",
    uses: [
      { area: "Electricity", note: "Wiring and motor windings — second only to silver in conductivity." },
      { area: "Plumbing", note: "Water pipes, because it resists corrosion." },
      { area: "Alloys", note: "Bronze with tin, brass with zinc." },
    ],
    reactivity: "Slowly forms a green carbonate layer in damp air — the patina on old copper roofs.",
  },
  Zn: {
    summary: "A bluish-white metal used mainly to protect iron from rusting.",
    uses: [
      { area: "Construction", note: "Galvanising — coating iron with zinc so the zinc corrodes instead." },
      { area: "Batteries", note: "The casing and anode of dry cells." },
    ],
    reactivity: "Reacts with dilute acids to give hydrogen — the standard laboratory preparation.",
  },
  Ag: {
    summary: "The best electrical and thermal conductor of all the elements, and a precious metal.",
    uses: [
      { area: "Electronics", note: "Contacts and conductors where the best conductivity is needed." },
      { area: "Medicine", note: "Silver compounds are antibacterial." },
    ],
    reactivity: "Tarnishes black in air containing sulfur compounds, forming silver sulfide.",
  },
  Au: {
    summary: "Unreactive, dense and easily worked, which is why it has been used as money and ornament for millennia.",
    uses: [
      { area: "Electronics", note: "Plated onto connectors because it does not tarnish." },
      { area: "Medicine", note: "Some gold compounds treat rheumatoid arthritis." },
    ],
    reactivity: "Does not react with oxygen, water or most acids — only aqua regia dissolves it.",
  },
  Hg: {
    summary: "The only metal that is liquid at room temperature. Toxic, and now being phased out of most uses.",
    uses: [{ area: "Instruments", note: "Historically in thermometers and barometers; largely replaced on safety grounds." }],
    reactivity: "Dissolves many metals to form amalgams.",
  },
  Pb: {
    summary: "A soft, dense, toxic metal used for thousands of years and now avoided wherever possible.",
    uses: [
      { area: "Batteries", note: "Lead-acid car batteries remain its largest use." },
      { area: "Radiation shielding", note: "Its density blocks X-rays and gamma rays." },
    ],
  },
  U: {
    summary: "The heaviest element found in any quantity in nature, and the fuel of nuclear reactors.",
    uses: [{ area: "Nuclear energy", note: "Uranium-235 undergoes fission, releasing energy used to generate electricity." }],
    discoveredBy: "Martin Heinrich Klaproth",
    discoveryYear: 1789,
    nameOrigin: "Named after the planet Uranus, discovered eight years earlier.",
  },
  Ti: {
    summary: "As strong as steel but far lighter, and highly resistant to corrosion.",
    uses: [
      { area: "Aerospace", note: "Airframes and jet engine parts." },
      { area: "Medicine", note: "Implants and joint replacements — the body tolerates it well." },
    ],
  },
  Sn: {
    summary: "A soft metal known since the Bronze Age, when alloying it with copper produced bronze.",
    uses: [
      { area: "Packaging", note: "Tin plating protects steel food cans from corrosion." },
      { area: "Electronics", note: "The main component of solder." },
    ],
  },
  I: {
    summary: "A dark solid that sublimes to a violet vapour. Essential in the diet for thyroid function.",
    uses: [
      { area: "Medicine", note: "Iodine solutions are antiseptics; iodised salt prevents goitre." },
    ],
    nameOrigin: "Greek iodes (violet) — from the colour of its vapour.",
  },
  Br: {
    summary: "One of only two elements that are liquid at room temperature, and a corrosive, sharp-smelling one.",
    uses: [{ area: "Materials", note: "Brominated compounds have been widely used as flame retardants." }],
    nameOrigin: "Greek bromos (stench).",
  },
};

/**
 * Which Class 10 chapters an element actually turns up in.
 *
 * Used by CBSE Focus, and taken from the chapter list in the content model
 * rather than chosen for effect — the point of the mode is that a student
 * revising "Metals and Non-metals" sees the elements that chapter uses, not a
 * plausible-looking selection.
 */
export const CBSE_TAGS: Record<string, string[]> = {
  H: ["Chemical Reactions and Equations", "Acids, Bases and Salts", "Metals and Non-metals"],
  O: ["Chemical Reactions and Equations", "Metals and Non-metals", "Life Processes"],
  C: ["Carbon and its Compounds", "Metals and Non-metals"],
  N: ["Our Environment", "Life Processes"],
  Na: ["Acids, Bases and Salts", "Metals and Non-metals", "Periodic Classification"],
  Cl: ["Acids, Bases and Salts", "Metals and Non-metals"],
  Mg: ["Chemical Reactions and Equations", "Metals and Non-metals"],
  Ca: ["Acids, Bases and Salts", "Chemical Reactions and Equations"],
  Fe: ["Chemical Reactions and Equations", "Metals and Non-metals"],
  Cu: ["Chemical Reactions and Equations", "Metals and Non-metals"],
  Zn: ["Chemical Reactions and Equations", "Metals and Non-metals", "Acids, Bases and Salts"],
  Al: ["Metals and Non-metals"],
  S: ["Metals and Non-metals", "Acids, Bases and Salts"],
  Ag: ["Metals and Non-metals"],
  Au: ["Metals and Non-metals"],
  Pb: ["Metals and Non-metals"],
  K: ["Metals and Non-metals", "Periodic Classification"],
  Li: ["Periodic Classification"],
  He: ["Periodic Classification"],
  Ne: ["Periodic Classification"],
  Ar: ["Periodic Classification"],
  Si: ["Periodic Classification"],
  P: ["Metals and Non-metals"],
  Br: ["Periodic Classification"],
  I: ["Periodic Classification"],
  Be: ["Periodic Classification"],
  B: ["Periodic Classification"],
  F: ["Periodic Classification"],
};

/** Every element CBSE Focus can highlight, derived rather than hand-listed. */
export const CBSE_SYMBOLS = Object.keys(CBSE_TAGS);

export function cbseChapters(): string[] {
  return [...new Set(Object.values(CBSE_TAGS).flat())].sort();
}

export function symbolsForChapter(chapter: string): string[] {
  return Object.entries(CBSE_TAGS)
    .filter(([, chapters]) => chapters.includes(chapter))
    .map(([symbol]) => symbol);
}
