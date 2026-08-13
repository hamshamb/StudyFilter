import type { SubjectId } from "@workspace/cbse-content";

/**
 * What the Study Workspace can be asked to show.
 *
 * Each kind is a real, separate experience with its own component — this list
 * is not a set of prompts. `explain` and `ask` are the only two that take free
 * text; everything else is driven entirely by the scope it was opened with,
 * which is the point: clicking "Chapter summary" while reading Chapter 11 has
 * to mean *this* chapter without anyone typing its name.
 */
export const WORKSPACE_KINDS = [
  "summary",
  "important",
  "notes",
  "ncert",
  "explain",
  "quiz",
  "flashcards",
  "ask",
] as const;

export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export interface WorkspaceScope {
  classLevel: number;
  subjectId: SubjectId | null;
  chapterId: string | null;
  topic?: string | null;
}

export interface WorkspaceRequest {
  kind: WorkspaceKind;
  scope: WorkspaceScope;
  /**
   * Text the student selected in the reader. When present, panels work on the
   * passage rather than the whole chapter — "explain *this*", not "explain
   * the chapter this came from".
   */
  selection?: string;
  /** Overrides the panel's default heading. */
  title?: string;
  /** Seeds the Ask panel's input. */
  question?: string;
}

export interface WorkspaceState {
  open: boolean;
  request: WorkspaceRequest | null;
  /** Previous requests, so the panel can offer a Back rather than just a close. */
  history: WorkspaceRequest[];
  /** Desktop only: the panel fills the viewport instead of docking right. */
  expanded: boolean;
}
