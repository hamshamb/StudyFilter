import React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, Lightbulb, Link2, Sigma } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnitError, UnitLoading } from "@/components/hub/UnitState";
import { Schematic } from "@/components/diagram/Schematic";
import { errorMessage } from "@/lib/api";
import { explainTopic, type ExplainDepth, type ExplainResult } from "@/lib/study-content";
import type { ResolvedScope } from "@/lib/scope";
import { cn } from "@/lib/utils";

/**
 * The Explain experience, shared by the `/explain` page and the floating
 * workspace panel.
 *
 * "Explain" used to be a prefix — the words `Explain clearly:` glued to the
 * front of whatever was typed, sent to the general answer endpoint, and
 * rendered as the same answer cards as everything else. This is a real
 * workflow: a depth to choose, a structured result, and a layout that puts
 * definitions, formulae, worked examples, a comparison table and the mistakes
 * examiners punish each in the place they belong.
 */

export const DEPTH_OPTIONS: { id: ExplainDepth; label: string; hint: string }[] = [
  { id: "quick", label: "Quick", hint: "Just the idea" },
  { id: "standard", label: "Standard", hint: "The classroom explanation" },
  { id: "deep", label: "Deep", hint: "Derived, with edge cases" },
  { id: "new", label: "I'm new to this", hint: "No assumed knowledge" },
  { id: "exam", label: "Exam-focused", hint: "What the board asks" },
];

export function DepthPicker({
  value,
  onChange,
  className,
}: {
  value: ExplainDepth;
  onChange: (depth: ExplainDepth) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("rail py-0.5", className)}
      role="radiogroup"
      aria-label="How deep should the explanation go?"
    >
      {DEPTH_OPTIONS.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            title={option.hint}
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
              active
                ? "border-primary/35 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface ExplainViewProps {
  scope: ResolvedScope;
  /** What to explain. Empty means "nothing asked yet". */
  topic: string;
  depth: ExplainDepth;
  /** A passage selected in the reader — explained instead of the whole topic. */
  passage?: string;
  /** Rendered under the result: flashcards, quiz, save, follow-up. */
  footer?: React.ReactNode;
}

export function useExplain({ scope, topic, depth, passage }: ExplainViewProps) {
  const enabled = topic.trim().length > 1 || (passage ?? "").trim().length > 20;
  return useQuery({
    queryKey: [
      "explain",
      topic.trim().toLowerCase(),
      depth,
      scope.classLevel,
      scope.subject?.name ?? null,
      scope.chapter?.title ?? null,
      // Passages are long; the length plus a prefix identifies one well enough
      // for a cache key without putting the student's selection in the key.
      passage ? `${passage.length}:${passage.slice(0, 24)}` : null,
    ],
    queryFn: () =>
      explainTopic({
        topic: topic.trim(),
        depth,
        classLevel: scope.classLevel,
        ...(scope.subject ? { subject: scope.subject.name } : {}),
        ...(scope.chapter ? { chapter: scope.chapter.title } : {}),
        ...(passage ? { passage } : {}),
      }),
    enabled,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}

export function ExplainView(props: ExplainViewProps) {
  const query = useExplain(props);

  if (!query.isFetched && !query.isFetching) return null;
  if (query.isPending) return <UnitLoading message="Working through the explanation" lines={3} />;
  if (query.isError || !query.data)
    return (
      <UnitError
        message={errorMessage(query.error, "We couldn't write that explanation.")}
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );

  return (
    <div className="space-y-5">
      <ExplainResultView result={query.data} />
      {props.footer}
    </div>
  );
}

export function ExplainResultView({ result }: { result: ExplainResult }) {
  return (
    <article className="space-y-5">
      {result.inShort && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
          <p className="text-eyebrow text-primary">In short</p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed">{result.inShort}</p>
        </div>
      )}

      {result.definitions && result.definitions.length > 0 && (
        <Section icon={BookOpen} title="Definitions">
          <dl className="space-y-2.5">
            {result.definitions.map((d, i) => (
              <div key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-semibold sm:w-40">{d.term}</dt>
                <dd className="text-sm leading-relaxed text-foreground/90">{d.meaning}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {result.sections.map((section, i) => (
        <Section key={i} title={section.heading}>
          {section.body?.map((paragraph, j) => (
            <p key={j} className="text-sm leading-relaxed text-foreground/90 [&+p]:mt-2.5">
              {paragraph}
            </p>
          ))}
          {section.points && section.points.length > 0 && (
            <ul className={cn("space-y-1.5", section.body?.length ? "mt-3" : "")}>
              {section.points.map((point, j) => (
                <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-foreground/90">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ))}

      {result.diagram && <Schematic diagram={result.diagram} />}

      {result.formulae && result.formulae.length > 0 && (
        <Section icon={Sigma} title="Formulae">
          <ul className="space-y-2.5">
            {result.formulae.map((f, i) => (
              <li key={i}>
                <p className="font-mono text-sm font-semibold">{f.expression}</p>
                {f.meaning && (
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{f.meaning}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.table && (
        <Section title={result.table.caption || "Comparison"}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr>
                  {result.table.columns.map((col) => (
                    <th
                      key={col}
                      scope="col"
                      className="border-b border-border px-3 py-2 text-left font-semibold"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.table.rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 align-top text-foreground/90">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {result.examples && result.examples.length > 0 && (
        <Section title={result.examples.length === 1 ? "Worked example" : "Worked examples"}>
          <ol className="space-y-4">
            {result.examples.map((example, i) => (
              <li key={i} className="rounded-lg border border-border bg-muted/30 p-3.5">
                <p className="text-sm font-medium">{example.prompt}</p>
                {example.working && example.working.length > 0 && (
                  <ol className="mt-2.5 space-y-1.5">
                    {example.working.map((step, j) => (
                      <li key={j} className="flex gap-2.5 text-sm text-foreground/90">
                        <span className="shrink-0 font-semibold tabular-nums text-primary">
                          {j + 1}.
                        </span>
                        <span className="font-mono text-[0.8125rem] leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {example.answer && (
                  <p className="mt-2.5 border-t border-border pt-2 text-sm font-semibold">
                    Answer: {example.answer}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {result.keyConcepts && result.keyConcepts.length > 0 && (
        <Section icon={Lightbulb} title="Key concepts">
          <ul className="flex flex-wrap gap-1.5">
            {result.keyConcepts.map((concept, i) => (
              <li
                key={i}
                className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium"
              >
                {concept}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.commonMistakes && result.commonMistakes.length > 0 && (
        <Section icon={AlertTriangle} title="Where students lose marks" tone="warning">
          <ul className="space-y-1.5">
            {result.commonMistakes.map((mistake, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground/90">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                <span>{mistake}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.related && result.related.length > 0 && (
        <Section icon={Link2} title="Related">
          <p className="text-sm text-muted-foreground">{result.related.join(" · ")}</p>
        </Section>
      )}
    </article>
  );
}

function Section({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "warning";
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border p-4",
        tone === "warning" ? "border-warning/30 bg-warning-soft/40" : "border-card-border bg-card",
      )}
    >
      <h3 className="text-card-title mb-2.5 flex items-center gap-2">
        {Icon && (
          <Icon
            className={cn("h-4 w-4 shrink-0", tone === "warning" ? "text-warning" : "text-muted-foreground")}
            aria-hidden="true"
          />
        )}
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Small helper so pages and panels agree on what "nothing asked yet" looks like. */
export function ExplainPrompt({ children }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/60 px-5 py-8 text-center">
      <p className="text-sm text-muted-foreground">
        Type a topic above — a term, a process, a formula, anything from the chapter.
      </p>
      {children && <div className="mt-3 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
