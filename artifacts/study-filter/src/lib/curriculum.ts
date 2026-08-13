import { SUBJECTS, type Chapter, type Subject } from "@workspace/cbse-content";
import { getAccent, type AccentStyle } from "@/components/hub/accents";

/**
 * Turning the names the analytics API reports back into routable ids.
 *
 * `/api/analytics` returns weak chapters as free text — `{ subject: "Science",
 * chapter: "Electricity" }` — because that is what was recorded when the
 * question was answered. To offer "practise this", the UI needs the subject
 * and chapter *slugs* that the router uses.
 *
 * Matching is deliberately forgiving in one direction only: it normalises
 * case, punctuation and whitespace, but it never guesses. If a name doesn't
 * resolve, callers get null and fall back to a generic destination rather than
 * sending a student to the wrong chapter.
 */

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface ResolvedChapter {
  subject: Subject;
  chapter: Chapter;
  /** Ready to drop into a <Link href>. */
  href: string;
}

export function resolveChapter(
  subjectName: string | null | undefined,
  chapterName: string | null | undefined,
): ResolvedChapter | null {
  if (!subjectName || !chapterName) return null;

  const wantedSubject = normalise(subjectName);
  const subject =
    SUBJECTS.find((s) => normalise(s.name) === wantedSubject) ??
    SUBJECTS.find((s) => normalise(s.shortName) === wantedSubject);
  if (!subject) return null;

  const wantedChapter = normalise(chapterName);
  const chapter =
    subject.chapters.find((c) => normalise(c.title) === wantedChapter) ??
    // Chapter titles are recorded from a few different places, so an exact
    // match can miss on a trailing "?" or an en dash. A containment check
    // both ways covers that without matching unrelated chapters, since
    // titles inside a subject are distinct.
    subject.chapters.find((c) => {
      const title = normalise(c.title);
      return title.includes(wantedChapter) || wantedChapter.includes(title);
    });
  if (!chapter) return null;

  return { subject, chapter, href: `/subjects/${subject.id}/${chapter.id}` };
}

/** The same lookup, for a subject on its own. */
export function resolveSubject(subjectName: string | null | undefined): Subject | null {
  if (!subjectName) return null;
  const wanted = normalise(subjectName);
  return (
    SUBJECTS.find((s) => normalise(s.name) === wanted) ??
    SUBJECTS.find((s) => normalise(s.shortName) === wanted) ??
    null
  );
}

/**
 * A subject's identity colour, looked up by display name.
 *
 * Several screens receive a subject as a plain string (a planner task, a mock
 * exam paper, a saved answer's `detectedSubject`) and each had grown its own
 * hardcoded map of subject → Tailwind swatch: the mock picker used sky/emerald/
 * amber/purple/rose, the planner used a different set at different opacities,
 * and neither agreed with the subject cards. One lookup, one source of colour.
 *
 * Unknown names fall back to the brand accent rather than to a random hue, so
 * a subject the content model doesn't know about stays neutral instead of
 * borrowing another subject's identity.
 */
export function subjectAccentByName(name: string | null | undefined): AccentStyle {
  return getAccent(resolveSubject(name)?.accent);
}
