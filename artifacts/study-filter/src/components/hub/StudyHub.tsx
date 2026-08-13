import React from "react";
import { SUBJECTS, GRADE } from "@workspace/cbse-content";
import { SubjectCard } from "@/components/study/SubjectCard";
import { PageShell, PageHeader } from "@/components/layout/PageShell";
import { useChapterProgress } from "@/hooks/use-chapter-progress";

/**
 * The subject picker.
 *
 * Previously this opened with a centred pill badge reading "CBSE STUDY HUB"
 * above a 36px heading reading "Choose a subject to start" above a paragraph
 * explaining what a subject is — three stacked pieces of chrome before the
 * five things the page exists to show. The heading is the page's <h1> now and
 * the cards start immediately under it.
 */
export function StudyHub() {
  const { startedIn } = useChapterProgress();

  return (
    <PageShell>
      <PageHeader
        title="Subjects"
        eyebrow={`Class ${GRADE} · CBSE`}
        description="Open a chapter to read a summary, work through NCERT answers, practise important questions or test yourself."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SUBJECTS.map((subject) => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            startedCount={startedIn(subject.id)}
          />
        ))}
      </div>
    </PageShell>
  );
}
