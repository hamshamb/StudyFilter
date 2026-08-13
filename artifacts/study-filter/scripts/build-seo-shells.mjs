/**
 * Post-Vite build step: generates per-route static HTML shells with
 *   1. Correct <head> metadata (title, description, canonical, OG, Twitter, JSON-LD)
 *   2. Meaningful <body> content inside #root so non-JS crawlers (GPTBot,
 *      ClaudeBot, Twitterbot, Facebook scraper) receive real page content.
 *
 * React hydrates over this static content after the client bundle loads,
 * so nothing is displayed to users that differs from the React output.
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist", "public");
const baseHtml = readFileSync(join(distDir, "index.html"), "utf-8");

// ─── Static content bodies ────────────────────────────────────────────────────

const HOME_BODY = `
<main>
  <section>
    <h1>CBSE Study Help for Class 8–12</h1>
    <p>StudyFilter gives Class 8–12 CBSE students clear, exam-ready answers in Maths, Science, Social Science, and English. Ask one question and get one distraction-free answer sourced from local CBSE notes first, with AI as a fallback.</p>
    <ul>
      <li>Chapter summaries</li>
      <li>NCERT answers</li>
      <li>Board-style answers</li>
      <li>Quizzes and important questions</li>
    </ul>
    <nav>
      <a href="/chat">Ask a question</a>
      <a href="/subjects">Browse subjects</a>
    </nav>
  </section>
  <section>
    <h2>How it works</h2>
    <ol>
      <li><strong>Ask your question</strong> — Type any Class 10 doubt in plain language.</li>
      <li><strong>We check trusted sources</strong> — We search reliable textbooks and study sites.</li>
      <li><strong>Get one clean answer</strong> — A perfect, exam-ready answer formatted for you.</li>
    </ol>
  </section>
  <section>
    <h2>Key features</h2>
    <ul>
      <li><strong>CBSE Study Hub</strong> — Browse subjects, chapters, and get focused study content.</li>
      <li><strong>Study Library</strong> — NCERT textbooks, previous year papers, sample papers, and marking schemes.</li>
      <li><strong>Practice Quiz</strong> — MCQs with XP rewards to track progress.</li>
      <li><strong>Compare Answers</strong> — Score multiple answers on CBSE criteria and pick the best.</li>
      <li><strong>Dashboard</strong> — Track XP, streaks, accuracy, and daily goals.</li>
    </ul>
  </section>
</main>
`.trim();

const SUBJECTS_BODY = `
<main>
  <h1>CBSE Subjects &amp; Chapters</h1>
  <p>Browse all CBSE Class 10 subjects and chapters. Open a subject, pick a chapter, and study summaries, NCERT answers, important questions and quizzes — all in one place.</p>
  <nav aria-label="CBSE subjects" id="subjects">
    <section>
      <h2><a href="/subjects/mathematics">Mathematics</a> — 14 chapters</h2>
      <p>CBSE Class 10 Mathematics covering Real Numbers, Polynomials, Quadratic Equations, Triangles, Trigonometry, Statistics, Probability and more.</p>
      <ul>
        <li>Real Numbers</li>
        <li>Polynomials</li>
        <li>Pair of Linear Equations in Two Variables</li>
        <li>Quadratic Equations</li>
        <li>Arithmetic Progressions</li>
        <li>Triangles</li>
        <li>Coordinate Geometry</li>
        <li>Introduction to Trigonometry</li>
        <li>Circles</li>
        <li>Surface Areas and Volumes</li>
        <li>Statistics</li>
        <li>Probability</li>
      </ul>
    </section>
    <section>
      <h2><a href="/subjects/science">Science</a> — 13 chapters</h2>
      <p>CBSE Class 10 Science covering Chemical Reactions, Life Processes, Light, Electricity, Magnetic Effects, Heredity, Our Environment and more.</p>
      <ul>
        <li>Chemical Reactions and Equations</li>
        <li>Acids, Bases and Salts</li>
        <li>Metals and Non-metals</li>
        <li>Carbon and its Compounds</li>
        <li>Life Processes</li>
        <li>Control and Coordination</li>
        <li>How do Organisms Reproduce?</li>
        <li>Heredity and Evolution</li>
        <li>Light – Reflection and Refraction</li>
        <li>The Human Eye and the Colourful World</li>
        <li>Electricity</li>
        <li>Magnetic Effects of Electric Current</li>
        <li>Our Environment</li>
      </ul>
    </section>
    <section>
      <h2><a href="/subjects/social-science">Social Science</a> — 22 chapters</h2>
      <p>CBSE Class 10 Social Science covering History (Nationalism, Industrialisation), Geography (Resources, Agriculture), Political Science (Federalism, Democracy), and Economics (Development, Globalisation).</p>
      <ul>
        <li>The Rise of Nationalism in Europe</li>
        <li>Nationalism in India</li>
        <li>The Making of a Global World</li>
        <li>Resources and Development</li>
        <li>Forest and Wildlife Resources</li>
        <li>Agriculture</li>
        <li>Power Sharing</li>
        <li>Federalism</li>
        <li>Political Parties</li>
        <li>Development</li>
        <li>Money and Credit</li>
        <li>Globalisation and the Indian Economy</li>
      </ul>
    </section>
    <section>
      <h2><a href="/subjects/english">English</a> — 11 chapters</h2>
      <p>CBSE Class 10 English covering prose and poetry from First Flight (A Letter to God, Nelson Mandela, Anne Frank) and Footprints Without Feet supplementary reader.</p>
      <ul>
        <li>A Letter to God</li>
        <li>Nelson Mandela: Long Walk to Freedom</li>
        <li>Two Stories about Flying</li>
        <li>From the Diary of Anne Frank</li>
        <li>The Hundred Dresses</li>
        <li>A Baker from Goa</li>
        <li>Coorg</li>
        <li>Tea from Assam</li>
        <li>Madam Rides the Bus</li>
        <li>The Sermon at Benares</li>
        <li>The Proposal</li>
      </ul>
    </section>
  </nav>
</main>
`.trim();

const LIBRARY_BODY = `
<main>
  <h1>Study Library</h1>
  <p>Free CBSE study resources for Class 8–12 — NCERT textbooks, previous year question papers, sample papers, and marking schemes all in one place.</p>
  <nav aria-label="Library sections">
    <a href="/library/ncert">NCERT Textbooks</a>
    <a href="/library/pyq">Previous Year Papers</a>
    <a href="/library/sample">Sample Papers</a>
    <a href="/library/marking">Marking Schemes</a>
    <a href="/library/mock">Mock Exams</a>
  </nav>
  <section>
    <h2>NCERT Textbooks &amp; Exemplar</h2>
    <p>Official NCERT textbook PDFs for Class 10 — Mathematics, Science, Social Science, and English. Download or read in-page.</p>
  </section>
  <section>
    <h2>Previous Year Question Papers (PYQs)</h2>
    <p>CBSE board exam question papers from previous years for Class 10 and Class 12. Practise with real exam questions across all subjects.</p>
  </section>
  <section>
    <h2>Sample Papers</h2>
    <p>CBSE-issued sample question papers for Class 10 and Class 12 board exams. Ideal for understanding exam pattern and marking distribution.</p>
  </section>
  <section>
    <h2>Marking Schemes</h2>
    <p>Official CBSE marking schemes and answer keys for previous year board exams. Learn exactly what examiners look for in each answer.</p>
  </section>
  <section>
    <h2>Mock Exams</h2>
    <p>Full-length timed mock exams modelled on the CBSE board exam format. Track your score and identify areas to improve before the real exam.</p>
  </section>
</main>
`.trim();

const PRACTICE_BODY = `
<main>
  <h1>Practice Quiz — CBSE MCQs</h1>
  <p>Sharpen your CBSE Class 8–12 exam readiness with multiple-choice practice quizzes. Earn XP for every correct answer, build daily streaks, and track your accuracy over time.</p>
  <section>
    <h2>Subjects you can practise</h2>
    <ul>
      <li>Mathematics — Real Numbers, Polynomials, Trigonometry, Statistics and more</li>
      <li>Science — Chemical Reactions, Life Processes, Electricity, Light and more</li>
      <li>Social Science — History, Geography, Political Science, Economics</li>
      <li>English — First Flight and Footprints Without Feet chapters</li>
      <li>Mixed — Random questions across all subjects</li>
    </ul>
  </section>
  <section>
    <h2>How it works</h2>
    <ol>
      <li>Choose a subject and difficulty level.</li>
      <li>Answer MCQs within the time limit.</li>
      <li>Earn XP for correct answers and review detailed explanations for each question.</li>
      <li>Your results are saved to the dashboard — track accuracy, streaks and XP over time.</li>
    </ol>
  </section>
</main>
`.trim();

// ─── Route config ─────────────────────────────────────────────────────────────

const CANONICAL_ORIGIN = "https://studyfilter.online";

const ROUTES = [
  {
    path: "/",
    outFile: null, // updated in-place on index.html
    title: "StudyFilter — CBSE Study Help for Class 8–12",
    description:
      "Get clear, exam-ready answers to CBSE questions for Class 8–12. Study Maths, Science, Social Science and English with answers from local CBSE notes and AI.",
    body: HOME_BODY,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "StudyFilter",
      description:
        "Distraction-free CBSE study help for Class 8–12. Ask one question, get one clear exam-ready answer.",
      url: "/",
      potentialAction: {
        "@type": "SearchAction",
        target: "/subjects?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
  },
  {
    path: "/subjects",
    outFile: "subjects.html",
    title: "Subjects & Chapters | StudyFilter CBSE",
    description:
      "Browse CBSE subjects and chapters for Class 8–12. Maths, Science, Social Science, English — pick a topic and get focused, exam-ready study help.",
    body: SUBJECTS_BODY,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "CBSE Subjects & Chapters",
      description:
        "Browse all CBSE subjects and chapters for Class 8–12. Pick a topic and get focused, exam-ready study help.",
      url: "/subjects",
      isPartOf: { "@type": "WebSite", name: "StudyFilter", url: "/" },
      hasPart: [
        {
          "@type": "ItemList",
          name: "CBSE Subjects",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Mathematics" },
            { "@type": "ListItem", position: 2, name: "Science" },
            { "@type": "ListItem", position: 3, name: "Social Science" },
            { "@type": "ListItem", position: 4, name: "English" },
          ],
        },
      ],
    },
  },
  {
    path: "/library",
    outFile: "library.html",
    title: "Study Library — NCERT Books, PYQs & Sample Papers | StudyFilter",
    description:
      "Access CBSE NCERT textbooks, previous year question papers, sample papers, and marking schemes for Class 8–12. Free PDF study resources for exam preparation.",
    body: LIBRARY_BODY,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "CBSE Study Library",
      description:
        "NCERT textbooks, previous year question papers, sample papers, and marking schemes for Class 8–12.",
      url: "/library",
      isPartOf: { "@type": "WebSite", name: "StudyFilter", url: "/" },
      hasPart: [
        { "@type": "CreativeWork", name: "NCERT Textbooks" },
        { "@type": "CreativeWork", name: "Previous Year Question Papers" },
        { "@type": "CreativeWork", name: "Sample Papers" },
        { "@type": "CreativeWork", name: "Marking Schemes" },
      ],
    },
  },
  {
    path: "/practice",
    outFile: "practice.html",
    title: "Practice Quiz — CBSE MCQs | StudyFilter",
    description:
      "Practice CBSE multiple-choice questions for Class 8–12. Earn XP, build streaks, and sharpen exam readiness across Maths, Science, Social Science and English.",
    body: PRACTICE_BODY,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "CBSE Practice Quiz",
      description:
        "Practice CBSE multiple-choice questions for Class 8–12 and earn XP for every correct answer.",
      url: "/practice",
      isPartOf: { "@type": "WebSite", name: "StudyFilter", url: "/" },
    },
  },
];

// ─── HTML transformation helpers ─────────────────────────────────────────────

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function buildShell(templateHtml, route) {
  let html = templateHtml;
  const { title, description, path: routePath, jsonLd, body } = route;

  // Head: title
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);

  // Head: meta description
  html = html.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${escapeHtml(description)}$2`,
  );

  // Head: canonical (must be absolute per Google's spec)
  const absoluteUrl = `${CANONICAL_ORIGIN}${routePath === "/" ? "/" : routePath}`;
  html = html.replace(
    /(<link rel="canonical" href=")[^"]*(")/,
    `$1${absoluteUrl}$2`,
  );

  // Head: og tags
  html = html.replace(
    /(<meta property="og:title" content=")[^"]*(")/,
    `$1${escapeHtml(title)}$2`,
  );
  html = html.replace(
    /(<meta property="og:description" content=")[^"]*(")/,
    `$1${escapeHtml(description)}$2`,
  );
  html = html.replace(
    /(<meta property="og:url" content=")[^"]*(")/,
    `$1${absoluteUrl}$2`,
  );

  // Head: twitter tags
  html = html.replace(
    /(<meta name="twitter:title" content=")[^"]*(")/,
    `$1${escapeHtml(title)}$2`,
  );
  html = html.replace(
    /(<meta name="twitter:description" content=")[^"]*(")/,
    `$1${escapeHtml(description)}$2`,
  );

  // Head: JSON-LD
  const ldTag = `  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n`;
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/,
    ldTag,
  );

  // Body: inject static content into #root so non-JS crawlers see real content.
  // React will hydrate/replace this on the client.
  html = html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">\n${body}\n</div>`,
  );

  return html;
}

// ─── Generate shells ──────────────────────────────────────────────────────────

for (const route of ROUTES) {
  const html = buildShell(baseHtml, route);

  if (route.outFile === null) {
    // Homepage: overwrite index.html in-place
    const outPath = join(distDir, "index.html");
    writeFileSync(outPath, html, "utf-8");
    console.log(`[seo-shells] updated ${outPath}`);
  } else {
    const outPath = join(distDir, route.outFile);
    writeFileSync(outPath, html, "utf-8");
    console.log(`[seo-shells] wrote ${outPath}`);
  }
}

console.log("[seo-shells] done");
