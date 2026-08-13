/**
 * NCERT Textbook Importer
 *
 * Source policy: official NCERT website (ncert.nic.in) ONLY.
 * Never uses SelfStudys, CBSE Academic, ePathshala, or any other site.
 *
 * What this script does:
 *   1. Fetches each Grade 10 NCERT chapter PDF from ncert.nic.in
 *   2. Validates the response is a real PDF (PDF magic bytes + Content-Type)
 *   3. Computes SHA-256 checksum
 *   4. Skips chapters whose checksum has not changed since last run
 *   5. Writes PDFs to ./output/ncert/ (replace with App Storage write in production)
 *   6. Writes a JSON manifest so the API server can reference stored files
 *
 * Run:
 *   pnpm --filter @workspace/scripts run import-ncert
 *
 * Env:
 *   NCERT_OUTPUT_DIR  — output directory (default: ./output/ncert)
 *   NCERT_STATE_FILE  — checksum state file (default: ./output/ncert-state.json)
 *   NCERT_DELAY_MS    — delay between requests in ms (default: 500)
 */

import { createHash } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

// ─── Source allowlist ─────────────────────────────────────────────────────────

const ALLOWED_ORIGIN = "https://ncert.nic.in";

function assertNcertUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.hostname !== "ncert.nic.in" && parsed.hostname !== "www.ncert.nic.in") {
    throw new Error(
      `[BLOCKED] URL is not from ncert.nic.in: ${url}\n` +
        "Only ncert.nic.in is permitted for base NCERT textbook downloads.",
    );
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`[BLOCKED] Only HTTPS is permitted. Got: ${parsed.protocol}`);
  }
  // Block private/local addresses
  const blocked = ["localhost", "127.", "192.168.", "10.", "169.254.", "::1"];
  if (blocked.some((b) => parsed.hostname.startsWith(b))) {
    throw new Error(`[BLOCKED] Private/local address: ${url}`);
  }
}

// ─── Chapter definitions ──────────────────────────────────────────────────────

const NCERT_BASE = "https://ncert.nic.in/textbook/pdf";

function ncertUrl(bookCode: string, chapter: number): string {
  return `${NCERT_BASE}/${bookCode}${String(chapter).padStart(2, "0")}.pdf`;
}

interface ChapterDef {
  subjectId: string;
  subjectName: string;
  bookName: string;
  bookCode: string;
  chapterNum: number;
  chapterTitle: string;
  url: string;
}

/**
 * All Grade 10 NCERT chapter PDFs from ncert.nic.in.
 * Book codes from the official NCERT URL scheme.
 * Only subjects supported by StudyFilter are included.
 */
const CHAPTERS: ChapterDef[] = [
  // ── Science — "Science" textbook, code "jesc1", 13 chapters ───────────────
  ...[
    "Chemical Reactions and Equations",
    "Acids, Bases and Salts",
    "Metals and Non-metals",
    "Carbon and its Compounds",
    "Life Processes",
    "Control and Coordination",
    "How do Organisms Reproduce?",
    "Heredity",
    "Light — Reflection and Refraction",
    "The Human Eye and the Colourful World",
    "Electricity",
    "Magnetic Effects of Electric Current",
    "Our Environment",
  ].map((title, idx) => ({
    subjectId: "science",
    subjectName: "Science",
    bookName: "Science",
    bookCode: "jesc1",
    chapterNum: idx + 1,
    chapterTitle: title,
    url: ncertUrl("jesc1", idx + 1),
  })),

  // ── Mathematics — "Mathematics" textbook, code "jemh1", 14 chapters ───────
  ...[
    "Real Numbers",
    "Polynomials",
    "Pair of Linear Equations in Two Variables",
    "Quadratic Equations",
    "Arithmetic Progressions",
    "Triangles",
    "Coordinate Geometry",
    "Introduction to Trigonometry",
    "Some Applications of Trigonometry",
    "Circles",
    "Constructions",
    "Areas Related to Circles",
    "Surface Areas and Volumes",
    "Statistics",
    "Probability",
  ].map((title, idx) => ({
    subjectId: "mathematics",
    subjectName: "Mathematics",
    bookName: "Mathematics",
    bookCode: "jemh1",
    chapterNum: idx + 1,
    chapterTitle: title,
    url: ncertUrl("jemh1", idx + 1),
  })),

  // ── Social Science — 4 books, 22 chapters total ────────────────────────────
  // History "India and the Contemporary World – II", code "jehis1"
  ...[
    "The Rise of Nationalism in Europe",
    "Nationalism in India",
    "The Making of a Global World",
    "The Age of Industrialisation",
    "Print Culture and the Modern World",
  ].map((title, idx) => ({
    subjectId: "social-science",
    subjectName: "Social Science",
    bookName: "India and the Contemporary World – II (History)",
    bookCode: "jehis1",
    chapterNum: idx + 1,
    chapterTitle: title,
    url: ncertUrl("jehis1", idx + 1),
  })),

  // Geography "Contemporary India – II", code "jegy1"
  ...[
    "Resources and Development",
    "Forest and Wildlife Resources",
    "Water Resources",
    "Agriculture",
    "Minerals and Energy Resources",
    "Manufacturing Industries",
    "Lifelines of National Economy",
  ].map((title, idx) => ({
    subjectId: "social-science",
    subjectName: "Social Science",
    bookName: "Contemporary India – II (Geography)",
    bookCode: "jegy1",
    chapterNum: idx + 1,
    chapterTitle: title,
    url: ncertUrl("jegy1", idx + 1),
  })),

  // Political Science "Democratic Politics – II", code "jdps1"
  ...[
    "Power Sharing",
    "Federalism",
    "Democracy and Diversity",
    "Gender, Religion and Caste",
    "Popular Struggles and Movements",
    "Political Parties",
    "Outcomes of Democracy",
    "Challenges to Democracy",
  ].map((title, idx) => ({
    subjectId: "social-science",
    subjectName: "Social Science",
    bookName: "Democratic Politics – II (Political Science)",
    bookCode: "jdps1",
    chapterNum: idx + 1,
    chapterTitle: title,
    url: ncertUrl("jdps1", idx + 1),
  })),

  // Economics "Understanding Economic Development", code "juen1"
  ...[
    "Development",
    "Sectors of the Indian Economy",
    "Money and Credit",
    "Globalisation and the Indian Economy",
    "Consumer Rights",
  ].map((title, idx) => ({
    subjectId: "social-science",
    subjectName: "Social Science",
    bookName: "Understanding Economic Development (Economics)",
    bookCode: "juen1",
    chapterNum: idx + 1,
    chapterTitle: title,
    url: ncertUrl("juen1", idx + 1),
  })),

  // ── English — 2 books ──────────────────────────────────────────────────────
  // "First Flight", code "jefl1"
  ...[
    "A Letter to God",
    "Nelson Mandela: Long Walk to Freedom",
    "Two Stories About Flying",
    "From the Diary of Anne Frank",
    "The Hundred Dresses – I",
    "The Hundred Dresses – II",
    "Glimpses of India",
    "Mijbil the Otter",
    "Madam Rides the Bus",
    "The Sermon at Benares",
    "The Proposal",
  ].map((title, idx) => ({
    subjectId: "english",
    subjectName: "English",
    bookName: "First Flight",
    bookCode: "jefl1",
    chapterNum: idx + 1,
    chapterTitle: title,
    url: ncertUrl("jefl1", idx + 1),
  })),

  // "Footprints Without Feet", code "jefwf1"
  ...[
    "A Triumph of Surgery",
    "The Thief's Story",
    "The Midnight Visitor",
    "A Question of Trust",
    "Footprints Without Feet",
    "The Making of a Scientist",
    "The Necklace",
    "The Hack Driver",
    "Bholi",
    "The Book That Saved the Earth",
  ].map((title, idx) => ({
    subjectId: "english",
    subjectName: "English",
    bookName: "Footprints Without Feet",
    bookCode: "jefwf1",
    chapterNum: idx + 1,
    chapterTitle: title,
    url: ncertUrl("jefwf1", idx + 1),
  })),

  // ── Hindi Course B — 2 books ───────────────────────────────────────────────
  // "Sparsh", code "jhsp1"
  ...[
    "साखी",
    "पद",
    "दोहे",
    "मनुष्यता",
    "पर्वत प्रदेश में पावस",
    "मधुर-मधुर मेरे दीपक जल",
    "तोप",
    "कर चले हम फ़िदा",
    "आत्मत्राण",
    "बड़े भाई साहब",
    "डायरी का एक पन्ना",
    "तताँरा-वामीरो कथा",
    "तीसरी कसम के शिल्पकार शैलेंद्र",
    "गिरगिट",
    "अब कहाँ दूसरे के दुख से दुखी होने वाले",
    "पतझर में टूटी पत्तियाँ",
    "कारतूस",
  ].map((title, idx) => ({
    subjectId: "hindi",
    subjectName: "Hindi",
    bookName: "Sparsh (Hindi Course B)",
    bookCode: "jhsp1",
    chapterNum: idx + 1,
    chapterTitle: title,
    url: ncertUrl("jhsp1", idx + 1),
  })),

  // "Sanchayan", code "jhsc1"
  ...[
    "हरिहर काका",
    "सपनों के-से दिन",
    "टोपी शुक्ला",
  ].map((title, idx) => ({
    subjectId: "hindi",
    subjectName: "Hindi",
    bookName: "Sanchayan (Hindi Course B)",
    bookCode: "jhsc1",
    chapterNum: idx + 1,
    chapterTitle: title,
    url: ncertUrl("jhsc1", idx + 1),
  })),
];

// ─── Validation ───────────────────────────────────────────────────────────────

/** Checks the first 4 bytes for the %PDF magic number. */
function isPdf(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46    // F
  );
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

// ─── State (checksum cache) ───────────────────────────────────────────────────

interface ChapterState {
  checksum: string;
  importedAt: string;
  lastVerifiedAt: string;
  size: number;
  outputPath: string;
  sourceUrl: string;
}

type StateFile = Record<string, ChapterState>; // key: bookCode+chapter

async function loadState(stateFile: string): Promise<StateFile> {
  if (!existsSync(stateFile)) return {};
  try {
    const raw = await readFile(stateFile, "utf-8");
    return JSON.parse(raw) as StateFile;
  } catch {
    console.warn(`[WARN] Could not parse state file ${stateFile} — starting fresh.`);
    return {};
  }
}

async function saveState(stateFile: string, state: StateFile): Promise<void> {
  await writeFile(stateFile, JSON.stringify(state, null, 2), "utf-8");
}

// ─── Fetch with redirect validation ──────────────────────────────────────────

async function fetchPdf(url: string, delayMs: number): Promise<Buffer | null> {
  assertNcertUrl(url);

  await new Promise((r) => setTimeout(r, delayMs));

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "StudyFilter-NCERT-Importer/1.0 (educational use; contact: studyfilter@example.com)",
      Accept: "application/pdf,*/*",
      Referer: ALLOWED_ORIGIN,
    },
    redirect: "follow",
  });

  // Validate redirect destination is still on ncert.nic.in
  const finalUrl = res.url;
  try {
    assertNcertUrl(finalUrl);
  } catch {
    console.error(`[ERROR] Redirect to non-NCERT domain blocked: ${finalUrl}`);
    return null;
  }

  if (!res.ok) {
    console.warn(`[SKIP] HTTP ${res.status} for ${url}`);
    return null;
  }

  const contentType = res.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await res.arrayBuffer());

  if (!isPdf(buffer)) {
    // NCERT sometimes returns an HTML error page with 200 status
    console.warn(`[SKIP] Not a valid PDF (content-type: ${contentType}): ${url}`);
    return null;
  }

  return buffer;
}

// ─── Manifest ─────────────────────────────────────────────────────────────────

interface ManifestEntry {
  subjectId: string;
  subjectName: string;
  bookName: string;
  bookCode: string;
  chapterNum: number;
  chapterTitle: string;
  sourceUrl: string;
  outputPath: string;
  checksum: string;
  size: number;
  importedAt: string;
  status: "imported" | "skipped_unchanged" | "unavailable";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const outputDir =
    process.env["NCERT_OUTPUT_DIR"] ?? join(process.cwd(), "output", "ncert");
  const stateFile =
    process.env["NCERT_STATE_FILE"] ??
    join(process.cwd(), "output", "ncert-state.json");
  const delayMs = Number(process.env["NCERT_DELAY_MS"] ?? 500);

  await mkdir(outputDir, { recursive: true });

  const state = await loadState(stateFile);
  const manifest: ManifestEntry[] = [];

  let imported = 0;
  let skipped = 0;
  let unavailable = 0;

  console.log(
    `\nNCERT Textbook Importer — Grade 10 (${CHAPTERS.length} chapters)\n` +
      `Output: ${outputDir}\n` +
      `Source: ncert.nic.in ONLY\n`,
  );

  for (const ch of CHAPTERS) {
    const key = `${ch.bookCode}:${String(ch.chapterNum).padStart(2, "0")}`;
    const label = `[${ch.bookCode} ch${ch.chapterNum}] ${ch.chapterTitle}`;

    process.stdout.write(`  ${label} ... `);

    const buffer = await fetchPdf(ch.url, delayMs);

    if (!buffer) {
      console.log("UNAVAILABLE");
      manifest.push({
        ...ch,
        sourceUrl: ch.url,
        outputPath: "",
        checksum: "",
        size: 0,
        importedAt: new Date().toISOString(),
        status: "unavailable",
      });
      unavailable++;
      continue;
    }

    const checksum = sha256(buffer);
    const existing = state[key];

    if (existing && existing.checksum === checksum) {
      console.log(`UNCHANGED (${(buffer.length / 1024).toFixed(0)} KB)`);
      manifest.push({
        ...ch,
        sourceUrl: ch.url,
        outputPath: existing.outputPath,
        checksum,
        size: buffer.length,
        importedAt: existing.importedAt,
        status: "skipped_unchanged",
      });
      skipped++;
      continue;
    }

    // Write to output dir
    const filename = `${ch.bookCode}_ch${String(ch.chapterNum).padStart(2, "0")}.pdf`;
    const outputPath = join(outputDir, filename);
    await writeFile(outputPath, buffer);

    const now = new Date().toISOString();
    state[key] = {
      checksum,
      importedAt: now,
      lastVerifiedAt: now,
      size: buffer.length,
      outputPath,
      sourceUrl: ch.url,
    };

    manifest.push({
      ...ch,
      sourceUrl: ch.url,
      outputPath,
      checksum,
      size: buffer.length,
      importedAt: now,
      status: "imported",
    });

    console.log(`OK (${(buffer.length / 1024).toFixed(0)} KB, ${checksum.slice(0, 8)}…)`);
    imported++;
  }

  await saveState(stateFile, state);

  const manifestPath = join(outputDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`
Done.
  Imported:    ${imported}
  Unchanged:   ${skipped}
  Unavailable: ${unavailable}
  Manifest:    ${manifestPath}
  State:       ${stateFile}

Next step: upload PDFs in ./output/ncert/ to App Storage and record
storedFileKey values in the database ncert_books table.
`);
}

main().catch((err: unknown) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
