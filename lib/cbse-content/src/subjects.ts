import type { Chapter, Subject, SubjectId } from "./types";

/** The grade this content model currently covers. */
export const GRADE = 10;

function ch(number: number, title: string, unit?: string): Chapter {
  const id = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return unit ? { id, number, title, unit } : { id, number, title };
}

// ── Science (Class 10, NCERT) ─────────────────────────────────────────────
const SCIENCE_CHAPTERS: Chapter[] = [
  ch(1, "Chemical Reactions and Equations"),
  ch(2, "Acids, Bases and Salts"),
  ch(3, "Metals and Non-metals"),
  ch(4, "Carbon and its Compounds"),
  ch(5, "Life Processes"),
  ch(6, "Control and Coordination"),
  ch(7, "How do Organisms Reproduce?"),
  ch(8, "Heredity and Evolution"),
  ch(9, "Light – Reflection and Refraction"),
  ch(10, "The Human Eye and the Colourful World"),
  ch(11, "Electricity"),
  ch(12, "Magnetic Effects of Electric Current"),
  ch(13, "Our Environment"),
];

// ── Mathematics (Class 10, NCERT) ─────────────────────────────────────────
const MATHEMATICS_CHAPTERS: Chapter[] = [
  ch(1, "Real Numbers"),
  ch(2, "Polynomials"),
  ch(3, "Pair of Linear Equations in Two Variables"),
  ch(4, "Quadratic Equations"),
  ch(5, "Arithmetic Progressions"),
  ch(6, "Triangles"),
  ch(7, "Coordinate Geometry"),
  ch(8, "Introduction to Trigonometry"),
  ch(9, "Some Applications of Trigonometry"),
  ch(10, "Circles"),
  ch(11, "Areas Related to Circles"),
  ch(12, "Surface Areas and Volumes"),
  ch(13, "Statistics"),
  ch(14, "Probability"),
];

// ── Social Science (Class 10, NCERT) ──────────────────────────────────────
const SOCIAL_SCIENCE_CHAPTERS: Chapter[] = [
  ch(1, "The Rise of Nationalism in Europe", "History"),
  ch(2, "Nationalism in India", "History"),
  ch(3, "The Making of a Global World", "History"),
  ch(4, "The Age of Industrialisation", "History"),
  ch(5, "Print Culture and the Modern World", "History"),
  ch(6, "Resources and Development", "Geography"),
  ch(7, "Forest and Wildlife Resources", "Geography"),
  ch(8, "Water Resources", "Geography"),
  ch(9, "Agriculture", "Geography"),
  ch(10, "Minerals and Energy Resources", "Geography"),
  ch(11, "Manufacturing Industries", "Geography"),
  ch(12, "Lifelines of National Economy", "Geography"),
  ch(13, "Power Sharing", "Political Science"),
  ch(14, "Federalism", "Political Science"),
  ch(15, "Gender, Religion and Caste", "Political Science"),
  ch(16, "Political Parties", "Political Science"),
  ch(17, "Outcomes of Democracy", "Political Science"),
  ch(18, "Development", "Economics"),
  ch(19, "Sectors of the Indian Economy", "Economics"),
  ch(20, "Money and Credit", "Economics"),
  ch(21, "Globalisation and the Indian Economy", "Economics"),
  ch(22, "Consumer Rights", "Economics"),
];

// ── English (Class 10, NCERT — First Flight & Footprints Without Feet) ─────
const ENGLISH_CHAPTERS: Chapter[] = [
  ch(1, "A Letter to God", "First Flight — Prose"),
  ch(2, "Nelson Mandela: Long Walk to Freedom", "First Flight — Prose"),
  ch(3, "Two Stories about Flying", "First Flight — Prose"),
  ch(4, "From the Diary of Anne Frank", "First Flight — Prose"),
  ch(5, "Glimpses of India", "First Flight — Prose"),
  ch(6, "Mijbil the Otter", "First Flight — Prose"),
  ch(7, "Madam Rides the Bus", "First Flight — Prose"),
  ch(8, "The Sermon at Benares", "First Flight — Prose"),
  ch(9, "The Proposal", "First Flight — Prose"),
  ch(10, "Dust of Snow & Fire and Ice", "First Flight — Poetry"),
  ch(11, "A Tiger in the Zoo", "First Flight — Poetry"),
  ch(12, "How to Tell Wild Animals", "First Flight — Poetry"),
  ch(13, "The Ball Poem", "First Flight — Poetry"),
  ch(14, "Amanda!", "First Flight — Poetry"),
  ch(15, "The Trees", "First Flight — Poetry"),
  ch(16, "Fog", "First Flight — Poetry"),
  ch(17, "The Tale of Custard the Dragon", "First Flight — Poetry"),
  ch(18, "For Anne Gregory", "First Flight — Poetry"),
  ch(19, "A Triumph of Surgery", "Footprints Without Feet"),
  ch(20, "The Thief's Story", "Footprints Without Feet"),
  ch(21, "The Midnight Visitor", "Footprints Without Feet"),
  ch(22, "A Question of Trust", "Footprints Without Feet"),
  ch(23, "Footprints Without Feet", "Footprints Without Feet"),
  ch(24, "The Making of a Scientist", "Footprints Without Feet"),
  ch(25, "The Necklace", "Footprints Without Feet"),
  ch(26, "Bholi", "Footprints Without Feet"),
  ch(27, "The Book That Saved the Earth", "Footprints Without Feet"),
];

// ── Hindi (Class 10, NCERT — Sparsh & Sanchayan, Course B) ────────────────
const HINDI_CHAPTERS: Chapter[] = [
  ch(1, "साखी – कबीर", "स्पर्श — काव्य"),
  ch(2, "पद – मीरा", "स्पर्श — काव्य"),
  ch(3, "दोहे – बिहारी", "स्पर्श — काव्य"),
  ch(4, "मनुष्यता – मैथिलीशरण गुप्त", "स्पर्श — काव्य"),
  ch(5, "पर्वत प्रदेश में पावस – सुमित्रानंदन पंत", "स्पर्श — काव्य"),
  ch(6, "मधुर-मधुर मेरे दीपक जल – महादेवी वर्मा", "स्पर्श — काव्य"),
  ch(7, "तोप – वीरेन डंगवाल", "स्पर्श — काव्य"),
  ch(8, "कर चले हम फ़िदा – कैफ़ी आज़मी", "स्पर्श — काव्य"),
  ch(9, "आत्मत्राण – रवींद्रनाथ ठाकुर", "स्पर्श — काव्य"),
  ch(10, "बड़े भाई साहब – प्रेमचंद", "स्पर्श — गद्य"),
  ch(11, "डायरी का एक पन्ना – सीताराम सेकसरिया", "स्पर्श — गद्य"),
  ch(12, "तताँरा-वामीरो कथा – लीलाधर मंडलोई", "स्पर्श — गद्य"),
  ch(13, "तीसरी कसम के शिल्पकार शैलेंद्र – प्रहलाद अग्रवाल", "स्पर्श — गद्य"),
  ch(14, "गिरगिट – अंतोन चेखव", "स्पर्श — गद्य"),
  ch(15, "अब कहाँ दूसरे के दुख से दुखी होने वाले – निदा फ़ाज़ली", "स्पर्श — गद्य"),
  ch(16, "पतझर में टूटी पत्तियाँ – रवींद्र केलेकर", "स्पर्श — गद्य"),
  ch(17, "कारतूस – हबीब तनवीर", "स्पर्श — गद्य"),
  ch(18, "हरिहर काका – मिथिलेश्वर", "संचयन"),
  ch(19, "सपनों के-से दिन – गुरदयाल सिंह", "संचयन"),
  ch(20, "टोपी शुक्ला – राही मासूम रज़ा", "संचयन"),
];

export const SUBJECTS: Subject[] = [
  {
    id: "science",
    name: "Science",
    shortName: "Science",
    description:
      "Physics, Chemistry and Biology — definitions, processes, diagrams and numericals.",
    accent: "emerald",
    chapters: SCIENCE_CHAPTERS,
  },
  {
    id: "mathematics",
    name: "Mathematics",
    shortName: "Maths",
    description:
      "Step-by-step working, formulas and proofs across algebra, geometry and statistics.",
    accent: "blue",
    chapters: MATHEMATICS_CHAPTERS,
  },
  {
    id: "social-science",
    name: "Social Science",
    shortName: "SST",
    description:
      "History, Geography, Political Science and Economics with dates, causes and effects.",
    accent: "orange",
    chapters: SOCIAL_SCIENCE_CHAPTERS,
  },
  {
    id: "english",
    name: "English",
    shortName: "English",
    description:
      "Prose, poetry, themes, characters and the writing formats expected in the board exam.",
    accent: "purple",
    chapters: ENGLISH_CHAPTERS,
  },
  {
    id: "hindi",
    name: "Hindi",
    shortName: "Hindi",
    description:
      "काव्य, गद्य एवं लेखन — सारांश, भाव, पात्र तथा अपेक्षित लेखन प्रारूप।",
    accent: "rose",
    chapters: HINDI_CHAPTERS,
  },
];

export function getSubject(id: SubjectId): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

export function getChapter(
  subjectId: SubjectId,
  chapterId: string,
): Chapter | undefined {
  return getSubject(subjectId)?.chapters.find((c) => c.id === chapterId);
}
