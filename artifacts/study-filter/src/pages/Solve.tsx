import React from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Calculator, CheckCircle2, FileQuestion, Info, Sigma } from "lucide-react";
import { SUBJECTS, type SubjectId } from "@workspace/cbse-content";
import { PageShell, PageHeader, Panel, EmptyState } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Chip, Spinner } from "@/components/ui/primitives";
import { UnitError } from "@/components/hub/UnitState";
import { SeoHead } from "@/components/SeoHead";
import { useScopedRoute } from "@/hooks/use-study-scope";
import { scopeToSearch } from "@/lib/scope";
import { errorMessage } from "@/lib/api";
import { solveProblem, type SolveResult } from "@/lib/study-content";

/**
 * Solve.
 *
 * A worked solution has a shape, and that shape carries marks: Given,
 * Required, the formula, the substitution, the working line by line, the
 * answer with its unit, and a check. Returning that as prose — which is what
 * "Solve step by step:" prefixed onto the answer endpoint produced — throws
 * away the thing a student is being marked on.
 *
 * So the result here is structured data laid out as an answer script, and the
 * working is one idea per line with the mathematics kept separate from the
 * words about it.
 */
export default function Solve() {
  const { scope, setScope } = useScopedRoute("/solve");
  const [question, setQuestion] = React.useState("");

  const solve = useMutation({
    mutationFn: (text: string) =>
      solveProblem({
        question: text,
        classLevel: scope.classLevel,
        ...(scope.subject ? { subject: scope.subject.name } : {}),
        ...(scope.chapter ? { chapter: scope.chapter.title } : {}),
      }),
    onSuccess: (result) => {
      const inferred = inferSolveScope(result);
      if (inferred.subjectId) setScope(inferred);
    },
  });

  return (
    <>
      <SeoHead
        title="Solve a problem — step-by-step CBSE working | StudyFilter"
        description="Paste a maths or science problem and get it worked through the way a CBSE answer script should be written: given, formula, substitution, working, answer with units."
        canonical="/solve"
      />
      <PageShell width="content">
        <PageHeader
          icon={Calculator}
          title="Solve"
          eyebrow={scope.hasChapter ? scope.label : `Class ${scope.classLevel} · CBSE`}
          description="Paste the question. You get the working, not a paragraph about the working."
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = question.trim();
            if (text.length > 4) solve.mutate(text);
          }}
          className="space-y-3"
        >
          <textarea
            rows={4}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. A resistance of 6 Ω is connected across a 12 V battery. Find the current and the power dissipated."
            aria-label="The question to solve"
            className="w-full resize-y rounded-lg border border-input bg-card p-3.5 text-sm leading-relaxed focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
          />

          <div className="rail py-0.5">
            <Chip active={!scope.subjectId} onClick={() => setScope({ subjectId: null, chapterId: null })}>
              Any subject
            </Chip>
            {SUBJECTS.filter((s) => s.id === "mathematics" || s.id === "science").map((subject) => (
              <Chip
                key={subject.id}
                active={scope.subjectId === subject.id}
                onClick={() => setScope({ subjectId: subject.id, chapterId: null })}
              >
                {subject.shortName}
              </Chip>
            ))}
          </div>

          <Button type="submit" disabled={question.trim().length < 5 || solve.isPending} className="w-full">
            {solve.isPending ? (
              <>
                <Spinner /> Working it through…
              </>
            ) : (
              "Solve it"
            )}
          </Button>
        </form>

        <div className="mt-6">
          {solve.isError && (
            <UnitError
              message={errorMessage(solve.error, "We couldn't work that one through.")}
              onRetry={() => solve.mutate(question.trim())}
              retrying={solve.isPending}
            />
          )}
          {solve.data && <SolutionView result={solve.data} scopeSearch={scopeToSearch(scope)} />}
          {!solve.data && !solve.isError && !solve.isPending && (
            <EmptyState
              icon={Sigma}
              title="Nothing solved yet"
              description="Numericals, algebra, geometry, word problems and proofs all work. Include every value the question gives you."
            />
          )}
        </div>
      </PageShell>
    </>
  );
}

function normalize(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function inferSolveScope(result: SolveResult): {
  subjectId: SubjectId | null;
  chapterId: string | null;
  topic: string | null;
} {
  const detected = normalize(result.subject);
  const subjectId: SubjectId | null =
    /math|algebra|geometry|trigono/.test(detected)
      ? "mathematics"
      : /science|physics|chemistry|biology/.test(detected)
        ? "science"
        : null;
  if (!subjectId) return { subjectId: null, chapterId: null, topic: result.concept ?? null };

  const subject = SUBJECTS.find((entry) => entry.id === subjectId);
  const requestedChapter = normalize(result.chapter);
  const haystack = normalize(`${result.chapter ?? ""} ${result.concept ?? ""} ${result.question}`);
  const chapter = subject?.chapters.find((entry) => {
    const title = normalize(entry.title);
    if (requestedChapter && (title.includes(requestedChapter) || requestedChapter.includes(title))) {
      return true;
    }
    if (entry.id === "electricity" && /ohm|resistor|resistance|current|voltage|battery/.test(haystack)) {
      return true;
    }
    return false;
  });

  return {
    subjectId,
    chapterId: chapter?.id ?? null,
    topic: result.concept ?? null,
  };
}

function answerWithUnit(result: SolveResult): string {
  const answer = result.answer.trim();
  const units = result.units?.trim();
  if (!units || normalize(answer).endsWith(normalize(units))) return answer;
  return `${answer} ${units}`;
}

function SolutionView({ result, scopeSearch: fallbackSearch }: { result: SolveResult; scopeSearch: string }) {
  const isProof = result.kind === "proof";
  const inferred = inferSolveScope(result);
  const scopeSearch = inferred.subjectId ? scopeToSearch(inferred) : fallbackSearch;

  return (
    <article className="space-y-4">
      {result.note && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft/50 p-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-sm leading-relaxed">{result.note}</p>
        </div>
      )}

      {(result.given.length > 0 || (result.required?.length ?? 0) > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {result.given.length > 0 && (
            <Panel title={isProof ? "Given" : "Given"}>
              <ul className="space-y-1.5">
                {result.given.map((item, i) => (
                  <li key={i} className="font-mono text-sm">
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {result.required && result.required.length > 0 && (
            <Panel title={isProof ? "To prove" : "To find"}>
              <ul className="space-y-1.5">
                {result.required.map((item, i) => (
                  <li key={i} className="font-mono text-sm">
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      {result.concept && (
        <Panel title="Concept used">
          <p className="text-sm leading-relaxed text-foreground/90">{result.concept}</p>
        </Panel>
      )}

      {/*
        `formulae` is optional on the type because a proof or a word problem
        may genuinely have none — the server sends [] but the contract allows
        its absence, and a missing field must not blank the page.
      */}
      {(result.formulae?.length ?? 0) > 0 && (
        <Panel title="Formula" icon={Sigma}>
          <ul className="space-y-1.5">
            {result.formulae?.map((formula, i) => (
              <li key={i} className="font-mono text-sm font-semibold">
                {formula}
              </li>
            ))}
          </ul>
          {result.substitution && (
            <p className="mt-3 border-t border-border pt-3 font-mono text-sm">
              <span className="text-xs font-sans text-muted-foreground">Substituting: </span>
              {result.substitution}
            </p>
          )}
        </Panel>
      )}

      {result.steps.length > 0 && (
        <Panel title={isProof ? "Proof" : "Working"}>
          <ol className="space-y-3.5">
            {result.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold tabular-nums text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {step.label && <p className="text-sm font-medium">{step.label}</p>}
                  {step.expression && (
                    <p className="mt-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-sm">
                      {step.expression}
                    </p>
                  )}
                  {step.detail && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {result.answer && (
        <div className="rounded-xl border border-success/35 bg-success-soft/50 p-4">
          <p className="text-eyebrow text-success">{isProof ? "Hence proved" : "Answer"}</p>
          <p className="mt-1 font-mono text-lg font-bold">
            {answerWithUnit(result)}
          </p>
        </div>
      )}

      {result.verification && (
        <Panel title="Check" icon={CheckCircle2}>
          <p className="text-sm leading-relaxed text-foreground/90">{result.verification}</p>
        </Panel>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/quiz${scopeSearch}`}>
            <FileQuestion className="h-3.5 w-3.5" aria-hidden="true" />
            Practise questions like this
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/explain${scopeSearch}${scopeSearch ? "&" : "?"}topic=${encodeURIComponent(result.concept || result.question.slice(0, 60))}`}>
            Explain the concept
          </Link>
        </Button>
      </div>
    </article>
  );
}
