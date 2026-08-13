import React from "react";
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Brain,
  Lightbulb,
  PenLine,
  Target,
} from "lucide-react";
import type { StudyAnswer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { Callout, FormulaBlock } from "@/components/answer/Callout";
import { SourceBadge } from "./SourceBadge";
import { DiagramRenderer } from "./DiagramRenderer";
import { cn } from "@/lib/utils";

/**
 * The Answer Sheet.
 *
 * A CBSE answer is not a chat message. It has a question, a marks band, a
 * shape the board expects, and a set of asides a student copies into the
 * margin — so it should look like the page you'd write in the exam, not like
 * a reply in a thread.
 *
 * Structurally the important change is that this is **one sheet**. The
 * previous version rendered up to eleven independent rounded cards stacked
 * vertically, each with its own border, its own tinted background and its own
 * uppercase label. Reading it meant crossing eleven boundaries to get through
 * one answer, and because every section shouted equally, nothing was the
 * answer. Here the sheet has a header, a body, and hairline rules between
 * sections; only the margin notes are tinted, because those genuinely are
 * asides.
 *
 * Nothing about the data contract changed — every field the API returns is
 * still rendered, and sections still appear only when their field is present.
 */

// ── Sheet section ──────────────────────────────────────────────────────────

function Section({
  label,
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-border px-4 py-4 sm:px-6 sm:py-5", className)}>
      {label && <h4 className="text-eyebrow mb-2.5 text-muted-foreground">{label}</h4>}
      {children}
    </section>
  );
}

/** A numbered list of answer points, in the shape a board answer is marked. */
function PointList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((point, i) => (
        <li key={i} className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold tabular-nums text-primary"
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <MarkdownRenderer compact>{point}</MarkdownRenderer>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Literature helpers ─────────────────────────────────────────────────────

function isHindiSubject(subject: string | null | undefined): boolean {
  if (!subject) return false;
  const s = subject.toLowerCase();
  return s.includes("hindi") || s.includes("हिंदी") || s.includes("हिन्दी");
}

interface LitHeadings {
  introduction: string;
  body: string;
  conclusion: string;
}

function getLitHeadings(subject: string | null | undefined): LitHeadings {
  if (isHindiSubject(subject)) {
    return { introduction: "भूमिका", body: "मुख्य भाग", conclusion: "निष्कर्ष" };
  }
  return { introduction: "Introduction", body: "Body", conclusion: "Conclusion" };
}

/**
 * Literature answers are prose, so they are set in the serif reading face at a
 * measured column width — this is the one place in the product where a student
 * reads several hundred unbroken words.
 */
function LiteratureAnswer({ answer }: { answer: StudyAnswer }) {
  const headings = getLitHeadings(answer.detectedSubject);
  const sections = [
    answer.literatureIntroduction
      ? { heading: headings.introduction, text: answer.literatureIntroduction }
      : null,
    answer.literatureBody ? { heading: headings.body, text: answer.literatureBody } : null,
    answer.literatureConclusion
      ? { heading: headings.conclusion, text: answer.literatureConclusion }
      : null,
  ].filter(Boolean) as { heading: string; text: string }[];

  const wordInfo =
    answer.literatureTargetMin && answer.literatureTargetMax
      ? `Target ${answer.literatureTargetMin}–${answer.literatureTargetMax} words`
      : answer.literatureWordCount
        ? `${answer.literatureWordCount} words`
        : null;

  return (
    <>
      {wordInfo && (
        <p className="mb-3 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {wordInfo}
        </p>
      )}
      {sections.length > 0 ? (
        <div className="measure space-y-5">
          {sections.map((sec) => (
            <div key={sec.heading}>
              <h5 className="text-eyebrow mb-1.5 text-primary">{sec.heading}</h5>
              <div className="answer-prose text-foreground/90">
                {sec.text
                  .split(/\n{2,}/)
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : answer.examReadyAnswer ? (
        <div className="answer-prose measure whitespace-pre-line text-foreground/90">
          {answer.examReadyAnswer}
        </div>
      ) : null}
    </>
  );
}

// ── Answer sheet ───────────────────────────────────────────────────────────

export function AnswerRenderer({
  answer,
  question,
  classLevel,
  showBookmark = true,
}: {
  answer: StudyAnswer;
  /** The question/topic this answer is for (used for bookmarking). */
  question: string;
  classLevel: number;
  showBookmark?: boolean;
}) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [saved, setSaved] = React.useState(() => isBookmarked(question));

  const onToggle = () => {
    setSaved(toggleBookmark({ question, classLevel: String(classLevel), answer }));
  };

  const isLiterature = !!answer.literatureFormat;
  const heading = answer.title?.trim() || question;

  // The breadcrumb line above the question. Only real values appear — an
  // answer with no detected chapter shows no chapter, rather than "—".
  const context = [answer.detectedSubject, answer.chapter].filter(Boolean) as string[];

  return (
    <article
      className="overflow-hidden rounded-xl border border-card-border bg-card"
      aria-label="Answer"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {(context.length > 0 || answer.marksBand) && (
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                {context.map((part, i) => (
                  <React.Fragment key={part}>
                    {i > 0 && <span className="text-muted-foreground/50" aria-hidden="true">·</span>}
                    <span className="text-eyebrow text-muted-foreground">{part}</span>
                  </React.Fragment>
                ))}
                {answer.marksBand && (
                  <span className="text-eyebrow rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">
                    {answer.marksBand}
                  </span>
                )}
              </div>
            )}
            <h3 className="text-section text-balance sm:text-lg">{heading}</h3>
          </div>

          {showBookmark && (
            <Button
              variant={saved ? "secondary" : "outline"}
              size="sm"
              onClick={onToggle}
              className="shrink-0"
              aria-pressed={saved}
              data-testid="button-save-answer"
            >
              {saved ? (
                <BookmarkCheck className="h-4 w-4" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
            </Button>
          )}
        </div>

        <div className="mt-3.5">
          <SourceBadge answer={answer} />
        </div>
      </header>

      {/* ── In short ───────────────────────────────────────────────────── */}
      {answer.shortAnswer && (
        <Section label="In short" className="bg-muted/40">
          <MarkdownRenderer
            compact
            className="text-[0.9375rem] font-medium leading-relaxed text-foreground"
          >
            {answer.shortAnswer}
          </MarkdownRenderer>
        </Section>
      )}

      {/* ── The answer itself ──────────────────────────────────────────── */}
      <Section label={isLiterature ? "Exam-ready answer" : "Answer"}>
        {isLiterature ? (
          <LiteratureAnswer answer={answer} />
        ) : answer.answerPoints?.length ? (
          <PointList items={answer.answerPoints} />
        ) : answer.examReadyAnswer ? (
          <div className="measure">
            <MarkdownRenderer>{answer.examReadyAnswer}</MarkdownRenderer>
          </div>
        ) : null}
      </Section>

      {/* ── Working ────────────────────────────────────────────────────── */}
      {answer.stepByStep?.length ? (
        <Section label="Step by step">
          <PointList items={answer.stepByStep} />
        </Section>
      ) : null}

      {/* ── Diagram ────────────────────────────────────────────────────── */}
      {answer.diagrams?.length ? (
        <Section label="Diagram">
          {/*
            Framed like a textbook figure: the diagram gets its own plate on
            the page rather than sitting loose against the answer text.
          */}
          <figure className="scroll-x rounded-lg border border-border bg-background p-3">
            <DiagramRenderer diagrams={answer.diagrams} />
          </figure>
        </Section>
      ) : null}

      {/* ── Formula ────────────────────────────────────────────────────── */}
      {answer.formulaOrDiagramHint ? (
        <Section label="Formula to remember">
          <FormulaBlock>
            <MarkdownRenderer compact>{answer.formulaOrDiagramHint}</MarkdownRenderer>
          </FormulaBlock>
        </Section>
      ) : null}

      {/* ── Key points ─────────────────────────────────────────────────── */}
      {answer.keyPointsToRemember?.length ? (
        <Section label="Key points">
          <ul className="space-y-1.5">
            {answer.keyPointsToRemember.map((p, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-muted-foreground"
                />
                <div className="min-w-0 flex-1">
                  <MarkdownRenderer compact>{p}</MarkdownRenderer>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* ── Keywords examiners look for ────────────────────────────────── */}
      {answer.examKeywords?.length ? (
        <Section label="Words the examiner looks for">
          <div className="flex flex-wrap gap-1.5">
            {answer.examKeywords.map((k) => (
              <span
                key={k}
                className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium"
              >
                {k}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {/* ── Margin notes ───────────────────────────────────────────────────
          Everything that is an aside rather than the answer, collected in one
          place at the bottom. Two columns on desktop so four short notes don't
          become four full-width bands. */}
      {(answer.keyConcept ||
        answer.memoryTrick ||
        answer.howToWriteInExam ||
        answer.examTip ||
        answer.commonMistakesToAvoid?.length ||
        answer.commonMistake) && (
        <Section label="Margin notes">
          <div className="grid gap-3 sm:grid-cols-2">
            {answer.keyConcept && (
              <Callout tone="concept" label="Key concept" icon={Brain}>
                <MarkdownRenderer compact>{answer.keyConcept}</MarkdownRenderer>
              </Callout>
            )}

            {answer.memoryTrick && (
              <Callout tone="remember" label="Remember this" icon={Lightbulb}>
                <MarkdownRenderer compact>{answer.memoryTrick}</MarkdownRenderer>
              </Callout>
            )}

            {answer.howToWriteInExam ? (
              <Callout tone="tip" label="How to write this in the exam" icon={PenLine}>
                <MarkdownRenderer compact>{answer.howToWriteInExam}</MarkdownRenderer>
              </Callout>
            ) : answer.examTip ? (
              <Callout tone="tip" label="Board exam tip" icon={Target}>
                <MarkdownRenderer compact>{answer.examTip}</MarkdownRenderer>
              </Callout>
            ) : null}

            {answer.commonMistakesToAvoid?.length ? (
              <Callout tone="mistake" label="Common mistakes" icon={AlertTriangle}>
                <ul className="space-y-1">
                  {answer.commonMistakesToAvoid.map((m, i) => (
                    <li key={i} className="flex gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-[0.5rem] h-1 w-1 shrink-0 rounded-full bg-destructive/60"
                      />
                      <div className="min-w-0 flex-1">
                        <MarkdownRenderer compact>{m}</MarkdownRenderer>
                      </div>
                    </li>
                  ))}
                </ul>
              </Callout>
            ) : answer.commonMistake ? (
              <Callout tone="mistake" label="Common mistake" icon={AlertTriangle}>
                <MarkdownRenderer compact>{answer.commonMistake}</MarkdownRenderer>
              </Callout>
            ) : null}
          </div>
        </Section>
      )}
    </article>
  );
}
