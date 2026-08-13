import type { SubjectId } from "@workspace/cbse-content";

/** Everything a working unit needs to fetch and render chapter content. */
export interface StudyContext {
  classLevel: number;
  subjectId: SubjectId;
  subjectName: string;
  chapterTitle: string;
  /** Optional sub-topic within the chapter to focus on. */
  topic?: string;
}
