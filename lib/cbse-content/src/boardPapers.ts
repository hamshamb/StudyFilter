import type { BoardPaper, PaperKind, SubjectId } from "./types";
import { SUBJECTS } from "./subjects";

/** Number of past years of board papers the library exposes. */
export const BOARD_PAPER_YEARS = 10;

/**
 * Returns the list of years to show, newest first.
 */
export function getBoardPaperYears(
  latestYear: number = new Date().getFullYear() - 1,
): number[] {
  return Array.from({ length: BOARD_PAPER_YEARS }, (_, i) => latestYear - i);
}

// ─────────────────────────────────────────────────────────────────────────────
// Source policy (FINAL):
//
// Previous-Year Board Papers (2022+): SelfStudys only.
// Sample Question Papers (pre-2022):  SelfStudys only.
// Marking Schemes:                     SelfStudys only.
//
// URLs are populated by the SelfStudys importer script and served from
// the database. This static file records paper TYPES only (board/sqp/null)
// so the UI can render correct labels and placeholders before import runs.
//
// Forbidden sources (never use):
//   cbse.gov.in — board exam ZIPs
//   cbseacademic.nic.in — SQP PDFs / marking scheme PDFs
// ─────────────────────────────────────────────────────────────────────────────

type PaperEntry = {
  questionPaperUrl: string | null;
  questionPaperKind: PaperKind;
  markingSchemeUrl: string | null;
};

/**
 * Static paper-type registry — URL fields are null pending SelfStudys import.
 * The questionPaperKind tells us what TYPE each slot is so the UI renders
 * correct badges ("Real board paper" vs "Official practice paper").
 */
const PAPER_DATA: Record<string, PaperEntry> = {
  // ── 2025 — Real board exam (SelfStudys import pending) ────────────────────
  "2025:science":        { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2025:mathematics":    { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2025:social-science": { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2025:english":        { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2025:hindi":          { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },

  // ── 2024 — Real board exam (SelfStudys import pending) ────────────────────
  "2024:science":        { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2024:mathematics":    { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2024:social-science": { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2024:english":        { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2024:hindi":          { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },

  // ── 2023 — Real board exam (SelfStudys import pending) ────────────────────
  "2023:science":        { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2023:mathematics":    { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2023:social-science": { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2023:english":        { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2023:hindi":          { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },

  // ── 2022 — Real board exam (SelfStudys import pending) ────────────────────
  "2022:science":        { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2022:mathematics":    { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2022:social-science": { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2022:english":        { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },
  "2022:hindi":          { questionPaperUrl: null, questionPaperKind: "board", markingSchemeUrl: null },

  // ── 2021 — SQP (SelfStudys import pending) ───────────────────────────────
  "2021:science":        { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2021:mathematics":    { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2021:social-science": { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2021:english":        { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2021:hindi":          { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },

  // ── 2020 — SQP (SelfStudys import pending) ───────────────────────────────
  "2020:science":        { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2020:mathematics":    { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2020:social-science": { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2020:english":        { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2020:hindi":          { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },

  // ── 2019 — SQP (SelfStudys import pending) ───────────────────────────────
  "2019:science":        { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2019:mathematics":    { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2019:social-science": { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2019:english":        { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2019:hindi":          { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },

  // ── 2018 — SQP (SelfStudys import pending) ───────────────────────────────
  "2018:science":        { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2018:mathematics":    { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2018:social-science": { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2018:english":        { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2018:hindi":          { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },

  // ── 2017 — SQP (SelfStudys import pending; some subjects not released) ────
  "2017:science":        { questionPaperUrl: null, questionPaperKind: null,    markingSchemeUrl: null },
  "2017:mathematics":    { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2017:social-science": { questionPaperUrl: null, questionPaperKind: null,    markingSchemeUrl: null },
  "2017:english":        { questionPaperUrl: null, questionPaperKind: null,    markingSchemeUrl: null },
  "2017:hindi":          { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },

  // ── 2016 — SQP (SelfStudys import pending) ───────────────────────────────
  "2016:science":        { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2016:mathematics":    { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2016:social-science": { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2016:english":        { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
  "2016:hindi":          { questionPaperUrl: null, questionPaperKind: "sqp",   markingSchemeUrl: null },
};

/**
 * Builds the 10-year board-papers structure: one slot per subject per year.
 */
export function buildBoardPapers(
  latestYear: number = new Date().getFullYear() - 1,
): BoardPaper[] {
  const years = getBoardPaperYears(latestYear);
  const papers: BoardPaper[] = [];
  for (const year of years) {
    for (const subject of SUBJECTS) {
      const key = `${year}:${subject.id}`;
      const entry = PAPER_DATA[key];
      papers.push({
        year,
        subjectId: subject.id as SubjectId,
        subjectName: subject.name,
        questionPaperUrl: entry?.questionPaperUrl ?? null,
        questionPaperKind: entry?.questionPaperKind ?? null,
        markingSchemeUrl: entry?.markingSchemeUrl ?? null,
      });
    }
  }
  return papers;
}

export const boardPapers: BoardPaper[] = buildBoardPapers();

export function getBoardPapersForSubject(subjectId: SubjectId): BoardPaper[] {
  return boardPapers.filter((p) => p.subjectId === subjectId);
}
