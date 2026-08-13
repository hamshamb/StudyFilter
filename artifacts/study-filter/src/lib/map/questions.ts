/**
 * CBSE Class 10 Social Science map-work items.
 *
 * Two shapes of question, matching how the board asks them:
 *
 *  - "state"  — identify a whole state. Correct anywhere inside its boundary,
 *               which is naturally forgiving without being vague.
 *  - "point"  — locate a place (a dam, port, city, movement site). Graded on
 *               distance, because nobody can place Dandi to the kilometre from
 *               memory; the intent is an educated estimate, not a survey.
 */

export type MapQuestionKind = "state" | "point";

export type MapCategory =
  | "history"
  | "resources"
  | "industry"
  | "transport"
  | "states";

export interface MapQuestion {
  id: string;
  kind: MapQuestionKind;
  category: MapCategory;
  /** What the student is asked to mark. */
  prompt: string;
  /** Shown after answering — the "why this matters" line. */
  fact: string;
  /** Target coordinate for point questions. */
  lng?: number;
  lat?: number;
  /** Expected state — the answer for "state" questions, a sanity check for "point". */
  state: string;
  /**
   * Radius in km inside which a point answer counts as correct. Larger for
   * broad regions (a coalfield), tighter for well-known cities.
   */
  toleranceKm?: number;
}

export const MAP_QUESTIONS: MapQuestion[] = [
  // ── History: sites of the national movement ─────────────────────────────
  {
    id: "champaran",
    kind: "point",
    category: "history",
    prompt: "Champaran — where Gandhiji's first satyagraha in India began",
    fact: "In 1917 Gandhiji went to Champaran in Bihar to support indigo peasants against the oppressive plantation system.",
    lng: 84.75, lat: 26.75, state: "Bihar", toleranceKm: 130,
  },
  {
    id: "kheda",
    kind: "point",
    category: "history",
    prompt: "Kheda — peasant satyagraha against revenue collection",
    fact: "In 1918 the peasants of Kheda, Gujarat, could not pay revenue after crop failure and plague; Gandhiji supported their demand for remission.",
    lng: 72.68, lat: 22.75, state: "Gujarat", toleranceKm: 120,
  },
  {
    id: "ahmedabad-mill",
    kind: "point",
    category: "history",
    prompt: "Ahmedabad — cotton mill workers' satyagraha of 1918",
    fact: "Gandhiji organised a satyagraha among cotton mill workers here in 1918.",
    lng: 72.58, lat: 23.03, state: "Gujarat", toleranceKm: 110,
  },
  {
    id: "amritsar",
    kind: "point",
    category: "history",
    prompt: "Amritsar — site of the Jallianwala Bagh massacre",
    fact: "On 13 April 1919 General Dyer's troops fired on a peaceful gathering at Jallianwala Bagh, killing hundreds.",
    lng: 74.87, lat: 31.63, state: "Punjab", toleranceKm: 120,
  },
  {
    id: "chauri-chaura",
    kind: "point",
    category: "history",
    prompt: "Chauri Chaura — the incident that ended Non-Cooperation",
    fact: "After a violent clash here in February 1922, Gandhiji called off the Non-Cooperation Movement.",
    lng: 83.63, lat: 26.65, state: "Uttar Pradesh", toleranceKm: 140,
  },
  {
    id: "dandi",
    kind: "point",
    category: "history",
    prompt: "Dandi — where the Salt March ended",
    fact: "Gandhiji walked 240 km from Sabarmati and broke the salt law at Dandi on 6 April 1930.",
    lng: 72.62, lat: 20.92, state: "Gujarat", toleranceKm: 120,
  },
  {
    id: "nagpur-session",
    kind: "point",
    category: "history",
    prompt: "Nagpur — Congress session of December 1920",
    fact: "The Non-Cooperation Programme was formally adopted at the Nagpur session.",
    lng: 79.09, lat: 21.15, state: "Maharashtra", toleranceKm: 130,
  },
  {
    id: "calcutta-session",
    kind: "point",
    category: "history",
    prompt: "Kolkata — Congress session of September 1920",
    fact: "The Congress met here in September 1920 and adopted the Non-Cooperation resolution.",
    lng: 88.36, lat: 22.57, state: "West Bengal", toleranceKm: 120,
  },

  // ── Resources: dams and rivers ──────────────────────────────────────────
  {
    id: "bhakra-nangal",
    kind: "point",
    category: "resources",
    prompt: "Bhakra Nangal Dam — on the Sutlej",
    fact: "One of India's largest dams, part of the Bhakra Nangal project on the Sutlej.",
    lng: 76.43, lat: 31.41, state: "Himachal Pradesh", toleranceKm: 130,
  },
  {
    id: "tehri",
    kind: "point",
    category: "resources",
    prompt: "Tehri Dam — on the Bhagirathi",
    fact: "One of the tallest dams in India, built on the Bhagirathi in Uttarakhand.",
    lng: 78.48, lat: 30.38, state: "Uttarakhand", toleranceKm: 120,
  },
  {
    id: "sardar-sarovar",
    kind: "point",
    category: "resources",
    prompt: "Sardar Sarovar Dam — on the Narmada",
    fact: "A major multipurpose project on the Narmada; the Narmada Bachao Andolan opposed the displacement it caused.",
    lng: 73.75, lat: 21.83, state: "Gujarat", toleranceKm: 130,
  },
  {
    id: "hirakud",
    kind: "point",
    category: "resources",
    prompt: "Hirakud Dam — on the Mahanadi",
    fact: "Among the longest dams in the world, on the Mahanadi in Odisha.",
    lng: 83.87, lat: 21.57, state: "Odisha", toleranceKm: 130,
  },
  {
    id: "nagarjuna-sagar",
    kind: "point",
    category: "resources",
    prompt: "Nagarjuna Sagar Dam — on the Krishna",
    fact: "A masonry dam on the Krishna, a key irrigation source for the region.",
    // The dam straddles the Telangana/Andhra Pradesh border; this point sits
    // on the Nalgonda (Telangana) side so the labelled state is unambiguous.
    lng: 79.28, lat: 16.60, state: "Telangana", toleranceKm: 130,
  },
  {
    id: "rana-pratap-sagar",
    kind: "point",
    category: "resources",
    prompt: "Rana Pratap Sagar Dam — on the Chambal",
    fact: "Part of the Chambal Valley project in Rajasthan.",
    lng: 75.58, lat: 24.92, state: "Rajasthan", toleranceKm: 130,
  },

  // ── Industry ────────────────────────────────────────────────────────────
  {
    id: "jamshedpur",
    kind: "point",
    category: "industry",
    prompt: "Jamshedpur — iron and steel plant",
    fact: "TISCO's plant here sits close to the coal and iron ore of the Chhotanagpur plateau.",
    lng: 86.20, lat: 22.80, state: "Jharkhand", toleranceKm: 120,
  },
  {
    id: "bhilai",
    kind: "point",
    category: "industry",
    prompt: "Bhilai — iron and steel plant",
    fact: "Set up with Russian collaboration, drawing on the iron ore of the region.",
    lng: 81.38, lat: 21.21, state: "Chhattisgarh", toleranceKm: 120,
  },
  {
    id: "durgapur",
    kind: "point",
    category: "industry",
    prompt: "Durgapur — iron and steel plant",
    fact: "Built with British collaboration in the Damodar valley industrial belt.",
    lng: 87.32, lat: 23.52, state: "West Bengal", toleranceKm: 120,
  },
  {
    id: "bokaro",
    kind: "point",
    category: "industry",
    prompt: "Bokaro — iron and steel plant",
    fact: "Established with Russian collaboration near the Bokaro coalfield.",
    lng: 86.15, lat: 23.67, state: "Jharkhand", toleranceKm: 110,
  },
  {
    id: "coimbatore",
    kind: "point",
    category: "industry",
    prompt: "Coimbatore — cotton textile centre",
    fact: "A major cotton textile hub in Tamil Nadu.",
    lng: 76.96, lat: 11.02, state: "Tamil Nadu", toleranceKm: 130,
  },
  {
    id: "kanpur",
    kind: "point",
    category: "industry",
    prompt: "Kanpur — cotton textile centre",
    fact: "A long-established cotton textile and leather centre on the Ganga.",
    lng: 80.35, lat: 26.45, state: "Uttar Pradesh", toleranceKm: 130,
  },

  // ── Transport: ports ────────────────────────────────────────────────────
  {
    id: "kandla",
    kind: "point",
    category: "transport",
    prompt: "Kandla (Deendayal) Port",
    fact: "A tidal port in Gujarat developed to relieve Mumbai after Partition.",
    lng: 70.22, lat: 23.03, state: "Gujarat", toleranceKm: 140,
  },
  {
    id: "mumbai-port",
    kind: "point",
    category: "transport",
    prompt: "Mumbai Port",
    fact: "India's biggest port, with a natural, well-sheltered harbour.",
    lng: 72.87, lat: 18.95, state: "Maharashtra", toleranceKm: 110,
  },
  {
    id: "marmagao",
    kind: "point",
    category: "transport",
    prompt: "Marmagao Port",
    fact: "Goa's premier port, historically a major iron ore exporter.",
    lng: 73.80, lat: 15.41, state: "Goa", toleranceKm: 90,
  },
  {
    id: "kochi-port",
    kind: "point",
    category: "transport",
    prompt: "Kochi Port",
    fact: "A natural harbour at the head of Vembanad lake.",
    lng: 76.26, lat: 9.97, state: "Kerala", toleranceKm: 110,
  },
  {
    id: "chennai-port",
    kind: "point",
    category: "transport",
    prompt: "Chennai Port",
    fact: "One of the oldest artificial ports on the east coast.",
    lng: 80.29, lat: 13.10, state: "Tamil Nadu", toleranceKm: 110,
  },
  {
    id: "visakhapatnam",
    kind: "point",
    category: "transport",
    prompt: "Visakhapatnam Port",
    fact: "A deep landlocked harbour on the east coast.",
    lng: 83.28, lat: 17.69, state: "Andhra Pradesh", toleranceKm: 120,
  },
  {
    id: "paradip",
    kind: "point",
    category: "transport",
    prompt: "Paradip Port",
    fact: "An Odisha port that exports large volumes of iron ore.",
    lng: 86.61, lat: 20.32, state: "Odisha", toleranceKm: 120,
  },
  {
    id: "haldia",
    kind: "point",
    category: "transport",
    prompt: "Haldia Port",
    fact: "Developed to ease congestion at Kolkata, on the Hooghly.",
    lng: 88.10, lat: 22.03, state: "West Bengal", toleranceKm: 110,
  },

  // ── States ──────────────────────────────────────────────────────────────
  { id: "st-maharashtra", kind: "state", category: "states", prompt: "Maharashtra", fact: "Capital Mumbai. The Deccan trap black soil here suits cotton.", state: "Maharashtra" },
  { id: "st-rajasthan", kind: "state", category: "states", prompt: "Rajasthan", fact: "India's largest state by area, dominated by the Thar Desert.", state: "Rajasthan" },
  { id: "st-kerala", kind: "state", category: "states", prompt: "Kerala", fact: "A narrow coastal state known for plantation crops and high literacy.", state: "Kerala" },
  { id: "st-assam", kind: "state", category: "states", prompt: "Assam", fact: "The Brahmaputra valley state, India's leading tea producer.", state: "Assam" },
  { id: "st-gujarat", kind: "state", category: "states", prompt: "Gujarat", fact: "India's longest coastline, and a major cotton and salt producer.", state: "Gujarat" },
  { id: "st-mp", kind: "state", category: "states", prompt: "Madhya Pradesh", fact: "The central state the Narmada flows through.", state: "Madhya Pradesh" },
  { id: "st-tn", kind: "state", category: "states", prompt: "Tamil Nadu", fact: "The southernmost mainland state, with a long east-coast plain.", state: "Tamil Nadu" },
  { id: "st-up", kind: "state", category: "states", prompt: "Uttar Pradesh", fact: "India's most populous state, in the fertile Ganga plain.", state: "Uttar Pradesh" },
  { id: "st-wb", kind: "state", category: "states", prompt: "West Bengal", fact: "Home to the Sundarbans delta and the jute industry.", state: "West Bengal" },
  { id: "st-karnataka", kind: "state", category: "states", prompt: "Karnataka", fact: "Bengaluru here is India's leading software hub.", state: "Karnataka" },
  { id: "st-odisha", kind: "state", category: "states", prompt: "Odisha", fact: "Rich in iron ore and bauxite, on the east coast.", state: "Odisha" },
  { id: "st-punjab", kind: "state", category: "states", prompt: "Punjab", fact: "A Green Revolution heartland, intensively irrigated.", state: "Punjab" },
];

export const CATEGORY_LABELS: Record<MapCategory, string> = {
  history: "History — national movement",
  resources: "Dams & water resources",
  industry: "Industries",
  transport: "Ports",
  states: "States",
};

/** Default radius when a point question does not set one. */
export const DEFAULT_TOLERANCE_KM = 120;
