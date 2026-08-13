import React from "react";
import { getSubject } from "@workspace/cbse-content";
import { AnimatedExplainer } from "../../explainer/AnimatedExplainer";
import type { StudyContext } from "../types";

/**
 * Studio unit that plays the subject's animated explainer. Purely client-side —
 * no content fetch, so it works instantly and offline.
 */
export function ExplainerUnit({ context }: { context: StudyContext }) {
  const subject = getSubject(context.subjectId);
  return (
    <div className="space-y-4">
      <AnimatedExplainer
        subjectId={context.subjectId}
        chapterTitle={context.chapterTitle}
        accent={subject?.accent}
      />
      <p className="text-center text-xs text-muted-foreground">
        A visual primer for {context.subjectName}. Open a chapter unit for the
        full, exam-ready material.
      </p>
    </div>
  );
}
