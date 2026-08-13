import React from "react";
import { CheckCircle2 } from "lucide-react";
import { useAskStudyFilter } from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { useStudyLevel } from "@/hooks/use-study-level";
import { AnswerRenderer } from "../AnswerRenderer";
import { DynamicWidgetGrid } from "../DynamicWidgetGrid";
import { UnitLoading, UnitError } from "../UnitState";
import type { StudyContext } from "../types";
import type { UnitAction } from "./actions";

export function BoardAnswerUnit({
  context,
  onAction,
}: {
  context: StudyContext;
  onAction: (action: UnitAction) => void;
}) {
  const sessionId = useSession();
  const { levelId } = useStudyLevel();
  const { mutate, data, isPending, isError, isSuccess } = useAskStudyFilter();

  const question =
    context.topic ||
    `Write a complete board-exam answer for the chapter "${context.chapterTitle}".`;

  const run = React.useCallback(() => {
    mutate({
      data: {
        question,
        classLevel: context.classLevel,
        subject: context.subjectName,
        chapter: context.chapterTitle,
        sessionId: sessionId || undefined,
        intent: "board_answer",
        studyLevel: levelId ?? undefined,
      },
    });
  }, [mutate, question, context.classLevel, context.subjectName, context.chapterTitle, sessionId, levelId]);

  React.useEffect(() => {
    run();
  }, [run]);

  if (isPending) return <UnitLoading message="Composing a board-style answer" />;
  if (isError || !data)
    return (
      <UnitError
        message="We couldn't generate the board answer. Please try again."
        onRetry={run}
        retrying={isPending}
      />
    );

  return (
    <div className="space-y-6">
      {isSuccess ? (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" /> Board answer ready
        </p>
      ) : null}
      <AnswerRenderer
        answer={data}
        question={question}
        classLevel={context.classLevel}
      />
      <DynamicWidgetGrid
        answer={data}
        subjectId={context.subjectId}
        onAction={onAction}
      />
    </div>
  );
}
