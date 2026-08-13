import { MAP_QUESTIONS, type MapQuestion } from "./questions";

/**
 * The atlas behind Learn, Practice and Explore.
 *
 * Three kinds of thing, because CBSE map work asks for three kinds of thing:
 *
 *  - **points**   — a dam, a port, a steel plant, a site of the national
 *                   movement. Stored as a coordinate.
 *  - **rivers**   — stored as an ordered list of *anchor points* (source,
 *                   major confluences and cities, mouth) rather than a traced
 *                   course. Drawing a river from memory would put the Godavari
 *                   through the wrong districts; naming the places it passes
 *                   is both what the syllabus asks for and something that can
 *                   be stated accurately.
 *  - **themes**   — soil types, cropping regions, climate. These are stored as
 *                   *lists of states*, not as drawn regions, and rendered by
 *                   shading the existing state boundaries. That is exactly how
 *                   the textbook teaches them ("black soil: Maharashtra,
 *                   Gujarat, Madhya Pradesh…") and it means no boundary is
 *                   ever invented.
 *
 * Every coordinate is approximate to a few kilometres, which is far finer than
 * the ~120 km tolerance practice questions grade on. Nothing here is presented
 * as survey data.
 */

export type LayerId =
  | "states"
  | "rivers"
  | "mountains"
  | "dams"
  | "ports"
  | "industry"
  | "minerals"
  | "parks"
  | "history"
  | "soils"
  | "crops";

export interface LayerInfo {
  id: LayerId;
  label: string;
  /** Which NCERT chapter this layer belongs to, for the "why am I learning this" line. */
  chapter: string;
  kind: "point" | "river" | "theme" | "state";
}

export const LAYERS: LayerInfo[] = [
  { id: "states", label: "States & capitals", chapter: "Geography — political map", kind: "state" },
  { id: "rivers", label: "Rivers", chapter: "Water Resources", kind: "river" },
  { id: "mountains", label: "Mountains & peaks", chapter: "Physical features", kind: "point" },
  { id: "dams", label: "Dams", chapter: "Water Resources", kind: "point" },
  { id: "ports", label: "Major ports", chapter: "Lifelines of National Economy", kind: "point" },
  { id: "industry", label: "Industries", chapter: "Manufacturing Industries", kind: "point" },
  { id: "minerals", label: "Minerals & energy", chapter: "Minerals and Energy Resources", kind: "point" },
  { id: "parks", label: "National parks", chapter: "Forest and Wildlife Resources", kind: "point" },
  { id: "history", label: "National movement", chapter: "Nationalism in India", kind: "point" },
  { id: "soils", label: "Soil types", chapter: "Resources and Development", kind: "theme" },
  { id: "crops", label: "Major crops", chapter: "Agriculture", kind: "theme" },
];

export interface AtlasPoint {
  id: string;
  layer: LayerId;
  name: string;
  lng: number;
  lat: number;
  state: string;
  /** One line on why it is on the syllabus. */
  fact: string;
}

export interface AtlasRiver {
  id: string;
  name: string;
  /** Ordered anchors from source to mouth. */
  anchors: { name: string; lng: number; lat: number }[];
  fact: string;
}

export interface AtlasTheme {
  id: string;
  layer: LayerId;
  name: string;
  /** State names, matching those in india-states.json. */
  states: string[];
  fact: string;
}

// ── Points ───────────────────────────────────────────────────────────────

export const ATLAS_POINTS: AtlasPoint[] = [
  // Mountains and peaks
  { id: "k2", layer: "mountains", name: "K2 (Godwin Austen)", lng: 76.51, lat: 35.88, state: "Jammu and Kashmir", fact: "The highest peak in territory claimed by India, in the Karakoram range." },
  { id: "kanchenjunga", layer: "mountains", name: "Kanchenjunga", lng: 88.15, lat: 27.70, state: "Sikkim", fact: "India's highest peak, on the Sikkim–Nepal border." },
  { id: "nanda-devi", layer: "mountains", name: "Nanda Devi", lng: 79.97, lat: 30.37, state: "Uttarakhand", fact: "The highest peak entirely within India, in the Garhwal Himalaya." },
  { id: "anai-mudi", layer: "mountains", name: "Anai Mudi", lng: 77.06, lat: 10.17, state: "Kerala", fact: "The highest peak in peninsular India, in the Western Ghats." },
  { id: "aravalli", layer: "mountains", name: "Guru Shikhar (Aravalli)", lng: 72.78, lat: 24.65, state: "Rajasthan", fact: "The highest point of the Aravallis, among the oldest fold mountains in the world." },

  // National parks and sanctuaries
  { id: "corbett", layer: "parks", name: "Jim Corbett National Park", lng: 78.94, lat: 29.53, state: "Uttarakhand", fact: "India's first national park, and where Project Tiger was launched in 1973." },
  { id: "kaziranga", layer: "parks", name: "Kaziranga National Park", lng: 93.37, lat: 26.58, state: "Assam", fact: "Holds most of the world's one-horned rhinoceroses." },
  { id: "gir", layer: "parks", name: "Gir National Park", lng: 70.80, lat: 21.13, state: "Gujarat", fact: "The only home of the Asiatic lion in the wild." },
  { id: "sundarbans", layer: "parks", name: "Sundarbans National Park", lng: 88.90, lat: 21.95, state: "West Bengal", fact: "The world's largest mangrove forest, and a tiger reserve." },
  { id: "ranthambore", layer: "parks", name: "Ranthambore National Park", lng: 76.50, lat: 26.02, state: "Rajasthan", fact: "A dry-deciduous tiger reserve in eastern Rajasthan." },
  { id: "periyar", layer: "parks", name: "Periyar National Park", lng: 77.16, lat: 9.46, state: "Kerala", fact: "A Western Ghats reserve known for elephants, around a reservoir." },

  // Minerals and energy
  { id: "jharia", layer: "minerals", name: "Jharia coalfield", lng: 86.42, lat: 23.75, state: "Jharkhand", fact: "India's most important coalfield, and the main source of coking coal for steel." },
  { id: "raniganj", layer: "minerals", name: "Raniganj coalfield", lng: 87.13, lat: 23.62, state: "West Bengal", fact: "The oldest coalfield worked in India, in the Damodar valley." },
  { id: "korba", layer: "minerals", name: "Korba coalfield", lng: 82.73, lat: 22.35, state: "Chhattisgarh", fact: "A major coalfield feeding large thermal power stations." },
  { id: "bailadila", layer: "minerals", name: "Bailadila iron ore mines", lng: 81.25, lat: 18.65, state: "Chhattisgarh", fact: "High-grade haematite, much of it exported through Visakhapatnam." },
  { id: "kudremukh", layer: "minerals", name: "Kudremukh iron ore", lng: 75.25, lat: 13.22, state: "Karnataka", fact: "One of the largest iron ore deposits in the world, in the Western Ghats." },
  { id: "digboi", layer: "minerals", name: "Digboi oilfield", lng: 95.62, lat: 27.39, state: "Assam", fact: "The oldest oilfield in India, producing since the 1890s." },
  { id: "mumbai-high", layer: "minerals", name: "Mumbai High", lng: 71.60, lat: 19.50, state: "Offshore", fact: "India's largest offshore oilfield, in the Arabian Sea." },
  { id: "khetri", layer: "minerals", name: "Khetri copper belt", lng: 75.79, lat: 28.00, state: "Rajasthan", fact: "A long-worked copper belt in the Aravalli region." },

  // Nuclear and thermal power
  { id: "tarapur", layer: "minerals", name: "Tarapur nuclear power station", lng: 72.66, lat: 19.83, state: "Maharashtra", fact: "India's first nuclear power station, commissioned in 1969." },
  { id: "kalpakkam", layer: "minerals", name: "Kalpakkam nuclear power station", lng: 80.16, lat: 12.56, state: "Tamil Nadu", fact: "A nuclear station on the Coromandel coast." },
  { id: "narora", layer: "minerals", name: "Narora nuclear power station", lng: 78.40, lat: 28.16, state: "Uttar Pradesh", fact: "A nuclear station on the Ganga in western Uttar Pradesh." },

  // Software and modern industry
  { id: "bengaluru-it", layer: "industry", name: "Bengaluru — software hub", lng: 77.59, lat: 12.97, state: "Karnataka", fact: "India's largest software technology cluster." },
  { id: "hyderabad-it", layer: "industry", name: "Hyderabad — software hub", lng: 78.49, lat: 17.39, state: "Telangana", fact: "A major IT and pharmaceutical centre." },
  { id: "pune-industry", layer: "industry", name: "Pune — automobile industry", lng: 73.86, lat: 18.52, state: "Maharashtra", fact: "A centre of vehicle manufacturing and engineering." },
  { id: "salem", layer: "industry", name: "Salem steel plant", lng: 78.15, lat: 11.66, state: "Tamil Nadu", fact: "A stainless steel plant in northern Tamil Nadu." },
  { id: "vizag-steel", layer: "industry", name: "Visakhapatnam steel plant", lng: 83.20, lat: 17.66, state: "Andhra Pradesh", fact: "India's first shore-based integrated steel plant." },
];

// ── Rivers, as anchor sequences ──────────────────────────────────────────

export const ATLAS_RIVERS: AtlasRiver[] = [
  {
    id: "ganga",
    name: "Ganga",
    fact: "Formed at Devprayag where the Bhagirathi meets the Alaknanda; it drains the largest river basin in India.",
    anchors: [
      { name: "Gangotri (source region)", lng: 78.94, lat: 30.99 },
      { name: "Devprayag", lng: 78.60, lat: 30.15 },
      { name: "Haridwar", lng: 78.16, lat: 29.95 },
      { name: "Prayagraj (Sangam)", lng: 81.85, lat: 25.43 },
      { name: "Varanasi", lng: 83.01, lat: 25.32 },
      { name: "Patna", lng: 85.14, lat: 25.59 },
      { name: "Farakka", lng: 87.92, lat: 24.80 },
      { name: "Sagar Island (mouth)", lng: 88.09, lat: 21.65 },
    ],
  },
  {
    id: "yamuna",
    name: "Yamuna",
    fact: "The largest tributary of the Ganga, joining it at Prayagraj.",
    anchors: [
      { name: "Yamunotri (source region)", lng: 78.45, lat: 31.01 },
      { name: "Delhi", lng: 77.23, lat: 28.66 },
      { name: "Agra", lng: 78.01, lat: 27.18 },
      { name: "Prayagraj (confluence)", lng: 81.85, lat: 25.43 },
    ],
  },
  {
    id: "brahmaputra",
    name: "Brahmaputra",
    fact: "Rises in Tibet as the Tsangpo, enters India in Arunachal Pradesh, and braids across the Assam valley.",
    anchors: [
      { name: "Enters India (Arunachal)", lng: 95.35, lat: 28.10 },
      { name: "Dibrugarh", lng: 94.90, lat: 27.48 },
      { name: "Guwahati", lng: 91.75, lat: 26.18 },
      { name: "Enters Bangladesh", lng: 89.70, lat: 25.18 },
    ],
  },
  {
    id: "narmada",
    name: "Narmada",
    fact: "Flows west through a rift valley between the Vindhyas and Satpuras into the Gulf of Khambhat.",
    anchors: [
      { name: "Amarkantak (source)", lng: 81.75, lat: 22.67 },
      { name: "Jabalpur", lng: 79.93, lat: 23.17 },
      { name: "Sardar Sarovar", lng: 73.75, lat: 21.83 },
      { name: "Gulf of Khambhat (mouth)", lng: 72.62, lat: 21.72 },
    ],
  },
  {
    id: "godavari",
    name: "Godavari",
    fact: "The longest river of peninsular India, often called the Dakshin Ganga.",
    anchors: [
      { name: "Triambakeshwar (source)", lng: 73.53, lat: 19.94 },
      { name: "Nashik", lng: 73.79, lat: 20.01 },
      { name: "Nanded", lng: 77.32, lat: 19.16 },
      { name: "Rajahmundry", lng: 81.78, lat: 17.00 },
      { name: "Bay of Bengal (delta)", lng: 82.30, lat: 16.55 },
    ],
  },
  {
    id: "krishna",
    name: "Krishna",
    fact: "Rises near Mahabaleshwar and crosses the Deccan to the Bay of Bengal.",
    anchors: [
      { name: "Mahabaleshwar (source)", lng: 73.66, lat: 17.92 },
      { name: "Sangli", lng: 74.57, lat: 16.85 },
      { name: "Nagarjuna Sagar", lng: 79.28, lat: 16.60 },
      { name: "Bay of Bengal (delta)", lng: 80.90, lat: 15.90 },
    ],
  },
  {
    id: "kaveri",
    name: "Kaveri",
    fact: "Rises in Coorg and supports the delta of Tamil Nadu; its waters are long disputed between states.",
    anchors: [
      { name: "Talakaveri (source)", lng: 75.49, lat: 12.38 },
      { name: "Srirangapatna", lng: 76.69, lat: 12.42 },
      { name: "Tiruchirappalli", lng: 78.70, lat: 10.80 },
      { name: "Bay of Bengal (delta)", lng: 79.85, lat: 11.00 },
    ],
  },
  {
    id: "mahanadi",
    name: "Mahanadi",
    fact: "Dammed at Hirakud; its delta is a densely farmed part of Odisha.",
    anchors: [
      { name: "Source (Chhattisgarh)", lng: 82.00, lat: 20.10 },
      { name: "Hirakud", lng: 83.87, lat: 21.57 },
      { name: "Cuttack", lng: 85.88, lat: 20.46 },
      { name: "Bay of Bengal (delta)", lng: 86.70, lat: 20.28 },
    ],
  },
  {
    id: "sutlej",
    name: "Sutlej",
    fact: "The easternmost of the five Punjab rivers; the Bhakra Nangal project is built on it.",
    anchors: [
      { name: "Enters India (Shipki La)", lng: 78.75, lat: 31.82 },
      { name: "Bhakra", lng: 76.43, lat: 31.41 },
      { name: "Ludhiana", lng: 75.85, lat: 30.90 },
      { name: "Enters Pakistan", lng: 74.10, lat: 30.20 },
    ],
  },
];

// ── Thematic layers, over existing state boundaries ─────────────────────

export const ATLAS_THEMES: AtlasTheme[] = [
  { id: "alluvial", layer: "soils", name: "Alluvial soil", states: ["Uttar Pradesh", "Bihar", "West Bengal", "Punjab", "Haryana", "Assam"], fact: "Deposited by rivers across the northern plains. The most fertile and most widely cultivated soil in India." },
  { id: "black", layer: "soils", name: "Black soil (regur)", states: ["Maharashtra", "Madhya Pradesh", "Gujarat", "Telangana"], fact: "Formed from Deccan lava. It holds moisture well, which is why it suits cotton." },
  { id: "red", layer: "soils", name: "Red and yellow soil", states: ["Odisha", "Chhattisgarh", "Jharkhand", "Karnataka", "Tamil Nadu"], fact: "Develops on crystalline igneous rock; red from the iron in it." },
  { id: "laterite", layer: "soils", name: "Laterite soil", states: ["Kerala", "Karnataka", "Tamil Nadu", "Odisha"], fact: "Forms in high rainfall with alternating wet and dry seasons. Suits tea, coffee and cashew." },
  { id: "arid", layer: "soils", name: "Arid soil", states: ["Rajasthan", "Gujarat"], fact: "Sandy and saline, with low humus. Needs irrigation before it can be cultivated." },

  { id: "rice", layer: "crops", name: "Rice", states: ["West Bengal", "Uttar Pradesh", "Punjab", "Bihar", "Odisha", "Assam", "Tamil Nadu"], fact: "A kharif crop needing high temperature and over 100 cm of rain, or irrigation." },
  { id: "wheat", layer: "crops", name: "Wheat", states: ["Uttar Pradesh", "Punjab", "Haryana", "Madhya Pradesh", "Rajasthan"], fact: "The main rabi crop, needing a cool growing season and bright sunshine when ripening." },
  { id: "cotton", layer: "crops", name: "Cotton", states: ["Maharashtra", "Gujarat", "Madhya Pradesh", "Telangana", "Punjab", "Haryana"], fact: "Grows on the black soil of the Deccan; needs high temperature and a frost-free period." },
  { id: "tea", layer: "crops", name: "Tea", states: ["Assam", "West Bengal", "Tamil Nadu", "Kerala"], fact: "A plantation crop needing deep, well-drained soil on slopes and frequent showers." },
  { id: "sugarcane", layer: "crops", name: "Sugarcane", states: ["Uttar Pradesh", "Maharashtra", "Karnataka", "Tamil Nadu", "Bihar"], fact: "Needs hot, humid conditions and heavy irrigation; the main source of sugar and gur." },
  { id: "jute", layer: "crops", name: "Jute", states: ["West Bengal", "Bihar", "Assam", "Odisha"], fact: "Grown on the well-drained alluvial soil of the flood plains, renewed every year." },
];

// ── Practice pool, derived from everything above ────────────────────────

/**
 * Practice questions come from the atlas plus the original question set, so
 * there is one place to add a location and it appears in Learn, Explore and
 * Practice at once. The original list is kept because it carries the
 * carefully-worded prompts and per-question tolerances the board expects.
 */
export function practiceItems(layers: Set<LayerId> | null): MapQuestion[] {
  const fromAtlas: MapQuestion[] = ATLAS_POINTS.filter(
    (p) => !layers || layers.has(p.layer),
  ).map((p) => ({
    id: p.id,
    kind: "point",
    // The original categories are a coarser grouping; map onto the closest.
    category:
      p.layer === "history"
        ? "history"
        : p.layer === "ports"
          ? "transport"
          : p.layer === "industry"
            ? "industry"
            : "resources",
    prompt: p.name,
    fact: p.fact,
    lng: p.lng,
    lat: p.lat,
    state: p.state,
    toleranceKm: 130,
  }));

  const legacy = MAP_QUESTIONS.filter((q) => {
    if (!layers) return true;
    if (q.category === "history") return layers.has("history");
    if (q.category === "transport") return layers.has("ports");
    if (q.category === "industry") return layers.has("industry");
    if (q.category === "states") return layers.has("states");
    return layers.has("dams");
  });

  // De-duplicate by id — the two sources overlap on a few well-known places.
  const seen = new Set<string>();
  return [...legacy, ...fromAtlas].filter((q) => {
    if (seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  });
}

export const ALL_POINTS_BY_LAYER = (layer: LayerId): AtlasPoint[] =>
  ATLAS_POINTS.filter((p) => p.layer === layer);
