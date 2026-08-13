// Shared CBSE content model.
//
// This module is the single source of truth for the curriculum structure the
// frontend reads: the five subjects and their chapter lists, the 10-year board
// papers structure, and the Grade 10 PDF library structure.
//
// All real official files (board question papers, marking schemes, NCERT PDFs)
// are intentionally left as `null` placeholders. Search for "INSERT REAL FILE"
// to find every spot where an official URL/file path should be added later.

export type SubjectId =
  | "science"
  | "mathematics"
  | "social-science"
  | "english"
  | "hindi";

export interface Chapter {
  /** Stable slug, unique within a subject. */
  id: string;
  /** Sequence number within the subject (1-based). */
  number: number;
  /** Display title. */
  title: string;
  /** Optional grouping (e.g. History/Geography for SST, Prose/Poetry for English). */
  unit?: string;
}

export interface Subject {
  id: SubjectId;
  /** Full display name. */
  name: string;
  /** Compact label for tabs/badges. */
  shortName: string;
  /** One-line description for cards. */
  description: string;
  /** Color accent token used by the UI (e.g. "emerald", "blue"). */
  accent: string;
  chapters: Chapter[];
}

/**
 * "board" = actual CBSE board exam paper (ZIP, all sets bundled, cbse.gov.in)
 * "sqp"   = official CBSE Sample Question Paper (PDF, cbseacademic.nic.in)
 * null    = not yet attached
 */
export type PaperKind = "board" | "sqp" | null;

export interface BoardPaper {
  year: number;
  subjectId: SubjectId;
  subjectName: string;
  questionPaperUrl: string | null;
  /** Distinguishes real board exam ZIPs (2022+) from pre-exam SQP PDFs (≤2021). */
  questionPaperKind: PaperKind;
  markingSchemeUrl: string | null;
}

export type PdfResourceType =
  | "textbook"
  | "solutions"
  | "notes"
  | "important-questions"
  | "sample-paper";

export interface PdfResource {
  id: string;
  title: string;
  type: PdfResourceType;
  // INSERT REAL FILE: official PDF URL/file path for this resource.
  url: string | null;
}

export interface PdfChapterGroup {
  chapterId: string;
  chapterTitle: string;
  resources: PdfResource[];
}

export interface SubjectPdfLibrary {
  subjectId: SubjectId;
  subjectName: string;
  chapters: PdfChapterGroup[];
}
