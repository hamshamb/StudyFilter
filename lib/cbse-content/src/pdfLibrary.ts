import type {
  PdfChapterGroup,
  PdfResource,
  PdfResourceType,
  SubjectId,
  SubjectPdfLibrary,
} from "./types";
import { SUBJECTS } from "./subjects";

// ─────────────────────────────────────────────────────────────────────────────
// Source policy (FINAL):
//
// NCERT textbook chapter PDFs:  Official NCERT website only (ncert.nic.in).
// NCERT Exemplar PDFs:          SelfStudys only — populated by importer script.
//
// Forbidden (never use):
//   cbseacademic.nic.in — notes, SQP PDFs, marking-scheme PDFs
//   Any source other than ncert.nic.in for base textbook chapters
// ─────────────────────────────────────────────────────────────────────────────

const NCERT = "https://ncert.nic.in/textbook/pdf";

/** Builds an NCERT chapter PDF URL from the book code and 1-based chapter number. */
function ncertChapter(bookCode: string, chapterNum: number): string {
  return `${NCERT}/${bookCode}${String(chapterNum).padStart(2, "0")}.pdf`;
}

function res(
  id: string,
  title: string,
  type: PdfResourceType,
  url: string | null,
): PdfResource {
  return { id, title, type, url };
}

/**
 * Science (Class 10) — book code "jesc1".
 * Textbook chapters from ncert.nic.in only.
 * Exemplar: null pending SelfStudys import (source: selfstudys.com only).
 */
function buildScienceChapters(): PdfChapterGroup[] {
  return SUBJECTS.find((s) => s.id === "science")!.chapters.map(
    (chapter, idx) => {
      const chNum = idx + 1;
      return {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        resources: [
          res(
            `${chapter.id}-textbook`,
            "NCERT Textbook Chapter",
            "textbook",
            ncertChapter("jesc1", chNum),
          ),
          res(
            `${chapter.id}-exemplar`,
            "NCERT Exemplar Problems",
            "solutions",
            null, // populated by SelfStudys importer
          ),
        ],
      };
    },
  );
}

/**
 * Mathematics (Class 10) — book code "jemh1".
 * Textbook chapters from ncert.nic.in only.
 * Exemplar: null pending SelfStudys import.
 */
function buildMathsChapters(): PdfChapterGroup[] {
  return SUBJECTS.find((s) => s.id === "mathematics")!.chapters.map(
    (chapter, idx) => {
      const chNum = idx + 1;
      return {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        resources: [
          res(
            `${chapter.id}-textbook`,
            "NCERT Textbook Chapter",
            "textbook",
            ncertChapter("jemh1", chNum),
          ),
          res(
            `${chapter.id}-exemplar`,
            "NCERT Exemplar Problems",
            "solutions",
            null, // populated by SelfStudys importer
          ),
        ],
      };
    },
  );
}

/**
 * Social Science — 22 chapters across 4 NCERT books:
 *   History   (ch 1–5)  → book "jehis1",  local ch 1–5
 *   Geography (ch 6–12) → book "jegy1",   local ch 1–7
 *   Pol. Sci  (ch 13–17) → book "jdps1",  local ch 1–5
 *   Economics (ch 18–22) → book "juen1",  local ch 1–5
 *
 * Textbook chapters from ncert.nic.in only.
 * Exemplar: null pending SelfStudys import.
 */
function buildSocialScienceChapters(): PdfChapterGroup[] {
  const chapters = SUBJECTS.find((s) => s.id === "social-science")!.chapters;

  function bookAndLocalCh(idx: number): { code: string; localCh: number } {
    if (idx < 5) return { code: "jehis1", localCh: idx + 1 };
    if (idx < 12) return { code: "jegy1", localCh: idx - 5 + 1 };
    if (idx < 17) return { code: "jdps1", localCh: idx - 12 + 1 };
    return { code: "juen1", localCh: idx - 17 + 1 };
  }

  return chapters.map((chapter, idx) => {
    const { code, localCh } = bookAndLocalCh(idx);
    return {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      resources: [
        res(
          `${chapter.id}-textbook`,
          "NCERT Textbook Chapter",
          "textbook",
          ncertChapter(code, localCh),
        ),
        res(
          `${chapter.id}-exemplar`,
          "NCERT Exemplar Problems",
          "solutions",
          null, // populated by SelfStudys importer
        ),
      ],
    };
  });
}

/**
 * English — 27 chapters across 2 NCERT books:
 *   First Flight (ch 1–18)         → book "jefl1",  local ch 1–18
 *   Footprints Without Feet (ch 19–27) → book "jefwf1", local ch 1–9
 *
 * Textbook chapters from ncert.nic.in only.
 * Exemplar: null pending SelfStudys import.
 */
function buildEnglishChapters(): PdfChapterGroup[] {
  const chapters = SUBJECTS.find((s) => s.id === "english")!.chapters;

  function bookAndLocalCh(idx: number): { code: string; localCh: number } {
    if (idx < 18) return { code: "jefl1", localCh: idx + 1 };
    return { code: "jefwf1", localCh: idx - 18 + 1 };
  }

  return chapters.map((chapter, idx) => {
    const { code, localCh } = bookAndLocalCh(idx);
    return {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      resources: [
        res(
          `${chapter.id}-textbook`,
          "NCERT Textbook Chapter",
          "textbook",
          ncertChapter(code, localCh),
        ),
        res(
          `${chapter.id}-exemplar`,
          "NCERT Exemplar Problems",
          "solutions",
          null, // populated by SelfStudys importer
        ),
      ],
    };
  });
}

/**
 * Hindi — 20 chapters across 2 NCERT books:
 *   Sparsh (ch 1–17)     → book "jhsp1",  local ch 1–17
 *   Sanchayan (ch 18–20) → book "jhsc1",  local ch 1–3
 *
 * Textbook chapters from ncert.nic.in only.
 * Exemplar: null pending SelfStudys import.
 */
function buildHindiChapters(): PdfChapterGroup[] {
  const chapters = SUBJECTS.find((s) => s.id === "hindi")!.chapters;

  function bookAndLocalCh(idx: number): { code: string; localCh: number } {
    if (idx < 17) return { code: "jhsp1", localCh: idx + 1 };
    return { code: "jhsc1", localCh: idx - 17 + 1 };
  }

  return chapters.map((chapter, idx) => {
    const { code, localCh } = bookAndLocalCh(idx);
    return {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      resources: [
        res(
          `${chapter.id}-textbook`,
          "NCERT Textbook Chapter",
          "textbook",
          ncertChapter(code, localCh),
        ),
        res(
          `${chapter.id}-exemplar`,
          "NCERT Exemplar Problems",
          "solutions",
          null, // populated by SelfStudys importer
        ),
      ],
    };
  });
}

const CHAPTER_BUILDERS: Record<SubjectId, () => PdfChapterGroup[]> = {
  science: buildScienceChapters,
  mathematics: buildMathsChapters,
  "social-science": buildSocialScienceChapters,
  english: buildEnglishChapters,
  hindi: buildHindiChapters,
};

export function buildPdfLibrary(): SubjectPdfLibrary[] {
  return SUBJECTS.map((subject) => ({
    subjectId: subject.id,
    subjectName: subject.name,
    chapters: CHAPTER_BUILDERS[subject.id](),
  }));
}

export const pdfLibrary: SubjectPdfLibrary[] = buildPdfLibrary();

export function getPdfLibraryForSubject(
  subjectId: SubjectId,
): SubjectPdfLibrary | undefined {
  return pdfLibrary.find((l) => l.subjectId === subjectId);
}
