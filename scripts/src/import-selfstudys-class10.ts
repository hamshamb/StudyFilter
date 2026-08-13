/**
 * SelfStudys Class 10 CBSE Importer
 *
 * Source policy: www.selfstudys.com ONLY.
 * Never uses cbseacademic.nic.in, cbse.gov.in, ncert.nic.in (for supplementary),
 * ePathshala, or any other site.
 *
 * Discovery approach:
 *   PYQs    — listing page renders individual paper links server-side (easy grep)
 *   Samples — listing page is JS-rendered; we crawl year-specific pages instead
 *   Exemplar— chapter listing pages are server-rendered (easy grep)
 *
 * Run:
 *   pnpm --filter @workspace/scripts run import-selfstudys
 *
 * Env (required):
 *   DATABASE_URL
 *
 * Env (optional):
 *   SS_OUTPUT_DIR  — PDF base dir (default: artifacts/api-server/data/pdfs/selfstudys)
 *   SS_STATE_FILE  — checksum state (default: scripts/output/selfstudys-state.json)
 *   SS_DELAY_MS    — delay between requests (default: 700)
 *   SS_MAX_PYQ     — cap PYQs per subject (default: 60)
 *   SS_MAX_SAMPLE  — cap sample papers per subject (default: 20)
 *   SS_MAX_EXEMPLAR— cap exemplar chapters per subject (default: 20)
 */

import { createHash } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and } from "drizzle-orm";
import { examPapersTable, ncertBooksTable } from "@workspace/db";

const { Pool } = pg;

// ─── Allowed origins ──────────────────────────────────────────────────────────

const ALLOWED_DOMAINS = new Set(["www.selfstudys.com", "selfstudys.com"]);

function assertSelfStudysUrl(url: string): void {
  const p = new URL(url);
  if (!ALLOWED_DOMAINS.has(p.hostname))
    throw new Error(`[BLOCKED] Not selfstudys.com: ${url}`);
  if (p.protocol !== "https:")
    throw new Error(`[BLOCKED] Only HTTPS: ${p.protocol}`);
  const blocked = ["localhost", "127.", "192.168.", "10.", "169.254.", "::1"];
  if (blocked.some((b) => p.hostname.startsWith(b)))
    throw new Error(`[BLOCKED] Private address: ${url}`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ResourceType = "previous_year" | "sample_paper" | "ncert_exemplar";
type ImportStatus = "available" | "review_required" | "failed" | "unavailable" | "login_required" | "prime_access_required" | "invalid_pdf";
type Confidence = "high" | "medium" | "low";

interface DiscoveredItem {
  subject: string;
  course?: string;
  resourceType: ResourceType;
  title: string;
  pageUrl: string;
  advancedViewerUrl: string;
  year?: number;
  setName?: string;
  series?: string;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchHtml(url: string, delayMs: number): Promise<string | null> {
  assertSelfStudysUrl(url);
  await sleep(delayMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    if (res.url && res.url !== url) {
      try { assertSelfStudysUrl(res.url); } catch { return null; }
    }
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    return res.text();
  } catch { return null; }
}

async function fetchPdf(url: string, delayMs: number): Promise<{ buffer: Buffer; status: ImportStatus; reason?: string }> {
  assertSelfStudysUrl(url);
  await sleep(delayMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/pdf,*/*", Referer: "https://www.selfstudys.com/" },
      signal: AbortSignal.timeout(20_000),
      redirect: "follow",
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) return { buffer: Buffer.alloc(0), status: "login_required" };
      if (res.status === 402) return { buffer: Buffer.alloc(0), status: "prime_access_required" };
      return { buffer: Buffer.alloc(0), status: "unavailable", reason: `HTTP ${res.status}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!isPdf(buf)) {
      const text = buf.toString("utf8", 0, 500);
      if (/login|sign.?in|captcha|prime/i.test(text)) return { buffer: Buffer.alloc(0), status: "login_required" };
      return { buffer: Buffer.alloc(0), status: "invalid_pdf" };
    }
    return { buffer: buf, status: "available" };
  } catch (e) {
    return { buffer: Buffer.alloc(0), status: "failed", reason: String(e) };
  }
}

function isPdf(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── PDF path extraction ──────────────────────────────────────────────────────

async function extractPdfUrl(advancedViewerUrl: string, delayMs: number): Promise<string | null> {
  const html = await fetchHtml(advancedViewerUrl, delayMs);
  if (!html) return null;
  const m1 = html.match(/pdfPath\s*=\s*["']([^"']*sitepdfs[^"']*)["']/);
  if (m1?.[1]) return m1[1];
  const m2 = html.match(/pdf_path["']?\s*:\s*["']([^"']*sitepdfs[^"']*)["']/);
  if (m2?.[1]) return m2[1];
  return null;
}

// ─── Metadata extraction helpers ──────────────────────────────────────────────

function extractYear(slug: string): number | undefined {
  const m = slug.match(/(\d{4})/);
  if (!m) return undefined;
  const y = parseInt(m[1], 10);
  return y >= 2000 && y <= 2100 ? y : undefined;
}

function extractSet(slug: string): string | undefined {
  const m = slug.match(/set-(\d+)/i);
  return m ? `Set ${m[1]}` : undefined;
}

function extractSeries(slug: string): string | undefined {
  const m = slug.match(/(\d{2}-\d+-\d+)/);
  return m ? m[1] : undefined;
}

function makeTitle(slug: string, subject: string, course: string | undefined, rt: ResourceType): string {
  const year = extractYear(slug);
  const set = extractSet(slug);
  const series = extractSeries(slug);
  const subj = course ? `${subject} ${course}` : subject;
  const typeLabel = rt === "previous_year" ? "Previous Year Paper"
    : rt === "sample_paper" ? "Sample Paper"
    : "NCERT Exemplar";
  const parts = [`CBSE Class 10 ${subj} ${typeLabel}`];
  if (year) parts.push(`${year}`);
  if (series) parts.push(`(${series})`);
  if (set) parts.push(set);
  return parts.join(" – ");
}

function confidence(slug: string, rt: ResourceType): Confidence {
  if (rt === "previous_year") {
    if (/\d{4}-\d{2}-\d+-\d+/.test(slug) || /compartment/.test(slug)) return "high";
    return "medium";
  }
  if (rt === "sample_paper") return /\d{4}/.test(slug) ? "high" : "medium";
  if (rt === "ncert_exemplar") return "high";
  return "medium";
}

function viewerUrl(pageSlug: string): string {
  return `https://www.selfstudys.com/advance-pdf-viewer${pageSlug}`;
}

// ─── Discovery strategies ─────────────────────────────────────────────────────

/**
 * PYQ discovery: listing page renders all individual paper links server-side.
 */
async function discoverPYQs(
  listingUrl: string,
  slugPattern: string,
  subject: string,
  course: string | undefined,
  max: number,
  delayMs: number,
): Promise<DiscoveredItem[]> {
  const html = await fetchHtml(listingUrl, delayMs);
  if (!html) { console.warn(`  [WARN] PYQ listing unreachable: ${listingUrl}`); return []; }

  const re = new RegExp(`(/books/cbse-prev-paper/english/class-10th/${slugPattern}/[^"'<>\\s]+)`, "g");
  const listingId = listingUrl.split("/").pop()!;
  const seen = new Set<string>();
  const items: DiscoveredItem[] = [];

  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && items.length < max) {
    const slug = m[1];
    if (seen.has(slug) || slug.endsWith(`/${listingId}`)) continue;
    seen.add(slug);
    const slugTail = slug.split("/").slice(-2, -1)[0] ?? "";
    items.push({
      subject, course, resourceType: "previous_year",
      title: makeTitle(slugTail, subject, course, "previous_year"),
      pageUrl: `https://www.selfstudys.com${slug}`,
      advancedViewerUrl: viewerUrl(slug.replace(/^\/books\//, "/")),
      year: extractYear(slugTail), setName: extractSet(slugTail), series: extractSeries(slugTail),
    });
  }
  return items;
}

/**
 * Sample paper discovery: listing pages are JS-rendered, so we crawl year-specific
 * listing pages (one per year) that DO render server-side.
 *
 * URL pattern: /books/cbse-sample-paper/english/class-10th/{subj}/{year-label}/{listingId}
 * These return links to individual sample papers.
 */
async function discoverSamplePapers(
  subjectSlug: string,
  subject: string,
  course: string | undefined,
  max: number,
  delayMs: number,
): Promise<DiscoveredItem[]> {
  const SAMPLE_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];
  const items: DiscoveredItem[] = [];
  const seen = new Set<string>();

  // Try both common listing page ID formats for each year
  for (const year of SAMPLE_YEARS) {
    if (items.length >= max) break;

    // Try fetching the individual year sample paper pages directly
    // by constructing viewer URLs from known patterns
    const yearLabel = `${subjectSlug.replace("-sample-paper", "")}-sample-paper-${year}`;
    const yearUrl = `https://www.selfstudys.com/books/cbse-sample-paper/english/class-10th/${subjectSlug}/${yearLabel}`;

    // Fetch the listing page which often has links to individual papers
    const listingHtml = await fetchHtml(yearUrl, delayMs);
    if (!listingHtml) continue;

    // Extract individual paper links from the page
    const linkPattern = new RegExp(`(/books/cbse-sample-paper/english/class-10th/${subjectSlug}/[^"'<>\\s]+)`, "g");
    let m: RegExpExecArray | null;
    while ((m = linkPattern.exec(listingHtml)) !== null && items.length < max) {
      const slug = m[1];
      const slugParts = slug.split("/");
      const lastPart = slugParts[slugParts.length - 1];
      // Individual paper pages have numeric IDs at the end
      if (!lastPart || !/^\d+$/.test(lastPart)) continue;
      if (seen.has(slug)) continue;
      seen.add(slug);
      const slugName = slugParts[slugParts.length - 2] ?? "";
      items.push({
        subject, course, resourceType: "sample_paper",
        title: makeTitle(slugName, subject, course, "sample_paper"),
        pageUrl: `https://www.selfstudys.com${slug}`,
        advancedViewerUrl: viewerUrl(slug.replace(/^\/books\//, "/")),
        year: extractYear(slugName), setName: extractSet(slugName), series: extractSeries(slugName),
      });
    }
  }

  // Fallback: if no items found via year pages, try the advance-pdf-viewer directly with known page IDs
  // by probing the subject listing page for a list of papers
  if (items.length === 0) {
    const listingFallbackUrl = `https://www.selfstudys.com/books/cbse-sample-paper/english/class-10th/${subjectSlug}`;
    const html = await fetchHtml(listingFallbackUrl, delayMs);
    if (html) {
      const re = new RegExp(`(/advance-pdf-viewer/cbse-sample-paper/english/class-10th/${subjectSlug}/[^"'<>\\s]+)`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null && items.length < max) {
        const viewSlug = m[1];
        if (seen.has(viewSlug)) continue;
        seen.add(viewSlug);
        const slugParts = viewSlug.split("/");
        const slugName = slugParts[slugParts.length - 2] ?? "";
        const pageSlug = viewSlug.replace("/advance-pdf-viewer/", "/books/");
        items.push({
          subject, course, resourceType: "sample_paper",
          title: makeTitle(slugName, subject, course, "sample_paper"),
          pageUrl: `https://www.selfstudys.com${pageSlug}`,
          advancedViewerUrl: `https://www.selfstudys.com${viewSlug}`,
          year: extractYear(slugName), setName: extractSet(slugName), series: extractSeries(slugName),
        });
      }
    }
  }

  return items;
}

/**
 * Exemplar discovery: chapter listing pages are server-rendered.
 */
async function discoverExemplar(
  listingUrl: string,
  slugPattern: string,
  subject: string,
  course: string | undefined,
  max: number,
  delayMs: number,
): Promise<DiscoveredItem[]> {
  const html = await fetchHtml(listingUrl, delayMs);
  if (!html) { console.warn(`  [WARN] Exemplar listing unreachable: ${listingUrl}`); return []; }

  const listingId = listingUrl.split("/").pop()!;
  const re = new RegExp(`(/books/ncert-exemplar-books/english/class-10th/${slugPattern}/[^"'<>\\s]+)`, "g");
  const seen = new Set<string>();
  const items: DiscoveredItem[] = [];

  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && items.length < max) {
    const slug = m[1];
    if (seen.has(slug) || slug.endsWith(`/${listingId}`)) continue;
    seen.add(slug);
    const slugParts = slug.split("/");
    const slugName = slugParts[slugParts.length - 2] ?? "";
    items.push({
      subject, course, resourceType: "ncert_exemplar",
      title: `CBSE Class 10 ${subject} NCERT Exemplar – ${slugName.replace(/-/g, " ")}`,
      pageUrl: `https://www.selfstudys.com${slug}`,
      advancedViewerUrl: viewerUrl(slug.replace(/^\/books\//, "/")),
    });
  }
  return items;
}

// ─── Subject catalogue ────────────────────────────────────────────────────────

interface SubjectDef {
  subject: string;
  course?: string;
  pyqListingUrl: string;
  pyqSlugPattern: string;
  sampleSubjectSlug: string;
  exemplarListingUrl?: string;
  exemplarSlugPattern?: string;
}

const SUBJECTS: SubjectDef[] = [
  {
    subject: "Mathematics", course: "Standard",
    pyqListingUrl: "https://www.selfstudys.com/books/cbse-prev-paper/english/class-10th/mathematics-pyp/1433",
    pyqSlugPattern: "mathematics-pyp",
    sampleSubjectSlug: "mathematics-standard-sample-paper",
    exemplarListingUrl: "https://www.selfstudys.com/books/ncert-exemplar-books/english/class-10th/mathematics-exemplar/40132",
    exemplarSlugPattern: "mathematics-exemplar",
  },
  {
    subject: "Science",
    pyqListingUrl: "https://www.selfstudys.com/books/cbse-prev-paper/english/class-10th/science-pyp/1442",
    pyqSlugPattern: "science-pyp",
    sampleSubjectSlug: "science-sample-paper",
    exemplarListingUrl: "https://www.selfstudys.com/books/ncert-exemplar-books/english/class-10th/science-exemplar/40143",
    exemplarSlugPattern: "science-exemplar",
  },
  {
    subject: "Social Science",
    pyqListingUrl: "https://www.selfstudys.com/books/cbse-prev-paper/english/class-10th/social-science-pyp/1445",
    pyqSlugPattern: "social-science-pyp",
    sampleSubjectSlug: "social-science-sample-paper",
  },
  {
    subject: "English", course: "Language and Literature",
    pyqListingUrl: "https://www.selfstudys.com/books/cbse-prev-paper/english/class-10th/english-pyp/1430",
    pyqSlugPattern: "english-pyp",
    sampleSubjectSlug: "english-sample-paper",
  },
  {
    subject: "Hindi", course: "Course B",
    pyqListingUrl: "https://www.selfstudys.com/books/cbse-prev-paper/english/class-10th/hindi-pyp/1431",
    pyqSlugPattern: "hindi-pyp",
    sampleSubjectSlug: "hindi-sample-paper",
  },
];

// ─── State ────────────────────────────────────────────────────────────────────

interface StateRecord { checksum: string; storedFileKey: string; importedAt: string; status: ImportStatus; }
type StateFile = Record<string, StateRecord>;

async function loadState(stateFile: string): Promise<StateFile> {
  if (!existsSync(stateFile)) return {};
  try { return JSON.parse(await readFile(stateFile, "utf-8")) as StateFile; }
  catch { return {}; }
}

async function saveState(f: string, s: StateFile): Promise<void> {
  await writeFile(f, JSON.stringify(s, null, 2), "utf-8");
}

// ─── DB upsert ────────────────────────────────────────────────────────────────

function dbPaperType(rt: ResourceType): string {
  return rt === "previous_year" ? "PYQ" : rt === "sample_paper" ? "Sample" : "Exemplar";
}

async function upsertPaper(
  db: ReturnType<typeof drizzle>,
  item: DiscoveredItem & { storedFileKey: string; fileChecksum: string; fileSizeBytes: number },
): Promise<number | null> {
  if (item.resourceType === "ncert_exemplar") {
    try {
      const ex = await db.select().from(ncertBooksTable).where(eq(ncertBooksTable.officialSourceUrl, item.pageUrl)).limit(1);
      if (ex.length > 0 && ex[0]) {
        await db.update(ncertBooksTable).set({ storedFileKey: item.storedFileKey, fileChecksum: item.fileChecksum, fileSizeBytes: item.fileSizeBytes, updatedAt: new Date(), status: "available" }).where(eq(ncertBooksTable.id, ex[0].id));
        return ex[0].id;
      }
      const [ins] = await db.insert(ncertBooksTable).values({ board: "CBSE", grade: 10, subject: item.subject, course: item.course ?? null, language: "english", bookTitle: item.title, officialSourceUrl: item.pageUrl, storedFileKey: item.storedFileKey, fileChecksum: item.fileChecksum, fileSizeBytes: item.fileSizeBytes, status: "available" }).returning({ id: ncertBooksTable.id });
      return ins?.id ?? null;
    } catch (e) { console.error("  [DB]", e); return null; }
  } else {
    try {
      const ex = await db.select().from(examPapersTable).where(and(eq(examPapersTable.subject, item.subject), eq(examPapersTable.paperType, dbPaperType(item.resourceType)), eq(examPapersTable.officialSourceUrl, item.pageUrl))).limit(1);
      if (ex.length > 0 && ex[0]) {
        await db.update(examPapersTable).set({ storedFileKey: item.storedFileKey, fileChecksum: item.fileChecksum, fileSizeBytes: item.fileSizeBytes, updatedAt: new Date(), status: "available" }).where(eq(examPapersTable.id, ex[0].id));
        return ex[0].id;
      }
      const [ins] = await db.insert(examPapersTable).values({ board: "CBSE", grade: 10, subject: item.subject, course: item.course ?? null, year: item.year ?? 0, setName: item.setName ?? null, series: item.series ?? null, title: item.title, officialSourceUrl: item.pageUrl, storedFileKey: item.storedFileKey, fileChecksum: item.fileChecksum, fileSizeBytes: item.fileSizeBytes, paperType: dbPaperType(item.resourceType), status: "available", language: "english" }).returning({ id: examPapersTable.id });
      return ins?.id ?? null;
    } catch (e) { console.error("  [DB]", e); return null; }
  }
}

// ─── Process single item ──────────────────────────────────────────────────────

async function processItem(
  item: DiscoveredItem,
  state: StateFile,
  baseOutputDir: string,
  db: ReturnType<typeof drizzle>,
  delayMs: number,
  counters: Record<string, number>,
): Promise<void> {
  const label = `[${item.subject}/${item.resourceType}] ${item.year ?? "??"} ${item.setName ?? ""}`.trim();
  process.stdout.write(`  ${label.slice(0, 72).padEnd(72)} ... `);

  const stateKey = `${item.subject}::${item.resourceType}::${item.pageUrl}`;

  // Already imported and available
  if (state[stateKey]?.status === "available") {
    console.log("SKIP");
    counters.skipped!++;
    return;
  }

  // Extract PDF URL
  const pdfUrl = await extractPdfUrl(item.advancedViewerUrl, delayMs);
  if (!pdfUrl) {
    console.log("NO_PDF_URL");
    state[stateKey] = { checksum: "", storedFileKey: "", importedAt: new Date().toISOString(), status: "unavailable" };
    counters.failed!++;
    return;
  }

  const urlKey = `url::${pdfUrl}`;
  if (state[urlKey]?.status === "available") {
    console.log("SKIP(url)");
    state[stateKey] = { ...state[urlKey]! };
    counters.skipped!++;
    return;
  }

  const dl = await fetchPdf(pdfUrl, delayMs);
  if (dl.buffer.length === 0) {
    console.log(dl.status.toUpperCase());
    if (dl.status === "login_required") counters.loginRequired!++;
    else if (dl.status === "prime_access_required") counters.primeRequired!++;
    else counters.failed!++;
    state[stateKey] = { checksum: "", storedFileKey: "", importedAt: new Date().toISOString(), status: dl.status };
    return;
  }

  const checksum = sha256(dl.buffer);
  const existingRec = state[stateKey];
  if (existingRec?.checksum === checksum && (existingRec.status as string) === "available") {
    console.log(`UNCHANGED`);
    counters.skipped!++;
    return;
  }

  const subDir = item.resourceType === "previous_year" ? "pyq" : item.resourceType === "sample_paper" ? "sample" : "exemplar";
  const slugParts = item.pageUrl.split("/");
  const pageName = slugParts[slugParts.length - 2] ?? slugParts[slugParts.length - 1];
  const filename = `${item.subject.toLowerCase().replace(/\s+/g, "-")}_${pageName.slice(0, 55)}_${checksum.slice(0, 8)}.pdf`;
  const outputPath = path.join(baseOutputDir, subDir, filename);
  const fileKey = `selfstudys/${subDir}/${filename}`;

  await writeFile(outputPath, dl.buffer);

  const conf = confidence(item.pageUrl, item.resourceType);
  const status: ImportStatus = conf === "low" ? "review_required" : "available";
  if (status === "review_required") counters.reviewRequired!++;

  await upsertPaper(db, { ...item, storedFileKey: fileKey, fileChecksum: checksum, fileSizeBytes: dl.buffer.length });

  const now = new Date().toISOString();
  const rec: StateRecord = { checksum, storedFileKey: fileKey, importedAt: now, status };
  state[stateKey] = rec;
  state[urlKey] = rec;

  if (item.resourceType === "previous_year") counters.pyq!++;
  else if (item.resourceType === "sample_paper") counters.sample!++;
  else counters.exemplar!++;

  console.log(`OK ${(dl.buffer.length / 1024).toFixed(0)}KB${conf === "low" ? " [REVIEW]" : ""}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) { console.error("\n[FATAL] DATABASE_URL required\n"); process.exit(1); }

  const baseOutputDir = process.env["SS_OUTPUT_DIR"] ?? path.resolve(process.cwd(), "..", "artifacts", "api-server", "data", "pdfs", "selfstudys");
  const stateFile = process.env["SS_STATE_FILE"] ?? path.resolve(process.cwd(), "output", "selfstudys-state.json");
  const delayMs = Number(process.env["SS_DELAY_MS"] ?? 700);
  const maxPyq = Number(process.env["SS_MAX_PYQ"] ?? 60);
  const maxSample = Number(process.env["SS_MAX_SAMPLE"] ?? 20);
  const maxExemplar = Number(process.env["SS_MAX_EXEMPLAR"] ?? 20);

  await mkdir(path.join(baseOutputDir, "pyq"), { recursive: true });
  await mkdir(path.join(baseOutputDir, "sample"), { recursive: true });
  await mkdir(path.join(baseOutputDir, "exemplar"), { recursive: true });
  await mkdir(path.dirname(stateFile), { recursive: true });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  const state = await loadState(stateFile);

  const counters: Record<string, number> = { pyq: 0, sample: 0, exemplar: 0, skipped: 0, failed: 0, loginRequired: 0, primeRequired: 0, reviewRequired: 0 };

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║   SelfStudys Class 10 CBSE Importer                     ║`);
  console.log(`║   Source: www.selfstudys.com ONLY                       ║`);
  console.log(`║   CBSE Academic / cbse.gov.in: NEVER used               ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  for (const subj of SUBJECTS) {
    const label = subj.course ? `${subj.subject} (${subj.course})` : subj.subject;
    console.log(`\n── ${label} ─────────────`);

    // PYQs
    const pyqs = await discoverPYQs(subj.pyqListingUrl, subj.pyqSlugPattern, subj.subject, subj.course, maxPyq, delayMs);
    console.log(`   PYQs: ${pyqs.length} discovered`);
    for (const item of pyqs) {
      await processItem(item, state, baseOutputDir, db, delayMs, counters);
      await saveState(stateFile, state);
    }

    // Sample papers
    const samples = await discoverSamplePapers(subj.sampleSubjectSlug, subj.subject, subj.course, maxSample, delayMs);
    console.log(`   Samples: ${samples.length} discovered`);
    for (const item of samples) {
      await processItem(item, state, baseOutputDir, db, delayMs, counters);
      await saveState(stateFile, state);
    }

    // Exemplar
    if (subj.exemplarListingUrl && subj.exemplarSlugPattern) {
      const exemplars = await discoverExemplar(subj.exemplarListingUrl, subj.exemplarSlugPattern, subj.subject, subj.course, maxExemplar, delayMs);
      console.log(`   Exemplar: ${exemplars.length} discovered`);
      for (const item of exemplars) {
        await processItem(item, state, baseOutputDir, db, delayMs, counters);
        await saveState(stateFile, state);
      }
    }
  }

  const manifestPath = path.join(baseOutputDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), counters, stateFile }, null, 2), "utf-8");

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  PYQs imported       : ${String(counters.pyq).padStart(4)}                              ║`);
  console.log(`║  Sample Papers       : ${String(counters.sample).padStart(4)}                              ║`);
  console.log(`║  NCERT Exemplar      : ${String(counters.exemplar).padStart(4)}                              ║`);
  console.log(`║  Skipped / unchanged : ${String(counters.skipped).padStart(4)}                              ║`);
  console.log(`║  Review required     : ${String(counters.reviewRequired).padStart(4)}                              ║`);
  console.log(`║  Login required      : ${String(counters.loginRequired).padStart(4)}                              ║`);
  console.log(`║  Prime required      : ${String(counters.primeRequired).padStart(4)}                              ║`);
  console.log(`║  Failed/unavailable  : ${String(counters.failed).padStart(4)}                              ║`);
  console.log(`╠══════════════════════════════════════════════════════════╣`);
  console.log(`║  CBSE Academic used  : NO  ✓                            ║`);
  console.log(`║  cbse.gov.in used    : NO  ✓                            ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  await pool.end();
}

main().catch((e: unknown) => { console.error("[FATAL]", e); process.exit(1); });
