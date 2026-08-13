import React from "react";
import {
  NotebookPen,
  Sigma,
  CalendarDays,
  KeyRound,
  Brain,
  Zap,
  Network,
} from "lucide-react";
import type { NoteTerm } from "@workspace/api-client-react";
import { UnitLoading, UnitError, UnitEmpty } from "../UnitState";
import { DiagramRenderer } from "../DiagramRenderer";
import { ContentStatus, contextToScope, useIsFresh } from "./ContentStatus";
import type { StudyContext } from "../types";
import { useChapterContent, useRefreshChapterContent } from "@/lib/study-content";
import { errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";

function TermList({ terms }: { terms: NoteTerm[] }) {
  return (
    <dl className="space-y-2">
      {terms.map((t, i) => (
        <div key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
          <dt className="shrink-0 font-semibold text-foreground sm:w-40">
            {t.term}
          </dt>
          <dd className="text-foreground/90">{t.meaning}</dd>
        </div>
      ))}
    </dl>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span className="text-foreground/90">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Block({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      {children}
    </section>
  );
}

export function RevisionNotesUnit({ context }: { context: StudyContext }) {
  const scope = React.useMemo(() => contextToScope(context), [context]);
  const query = useChapterContent("notes", scope);
  const refresh = useRefreshChapterContent("notes", scope);
  const fresh = useIsFresh(query.dataUpdatedAt);

  if (query.isPending)
    return <UnitLoading message="Building your easy-to-revise notes" />;
  if (query.isError || !query.data)
    return (
      <UnitError
        message={errorMessage(query.error, "We couldn't create the notes.")}
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );

  const data = query.data;

  if (!data.sections?.length)
    return (
      <UnitEmpty
        icon={NotebookPen}
        title="No notes available yet"
        message="Nothing came back for this chapter. Rewriting usually fixes it."
        action={
          <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            {refresh.isPending ? "Rewriting…" : "Try again"}
          </Button>
        }
      />
    );

  return (
    <div className="space-y-4">
      <ContentStatus
        label="notes"
        fresh={fresh}
        onRefresh={() => refresh.mutate()}
        refreshing={refresh.isPending}
      />

      {data.title || data.overview ? (
        <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-5">
          {data.title ? (
            <h2 className="text-xl font-bold leading-tight">
              {data.title}
            </h2>
          ) : null}
          {data.overview ? (
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">
              {data.overview}
            </p>
          ) : null}
        </div>
      ) : null}

      {data.sections.map((section, i) => (
        <Block key={i} icon={NotebookPen} title={section.heading}>
          <Bullets items={section.points} />
        </Block>
      ))}

      {data.diagrams?.length ? (
        <Block icon={Network} title="Diagrams">
          <DiagramRenderer diagrams={data.diagrams} />
        </Block>
      ) : null}

      {data.formulae?.length ? (
        <Block icon={Sigma} title="Key formulae">
          <Bullets items={data.formulae} />
        </Block>
      ) : null}

      {data.importantDates?.length ? (
        <Block icon={CalendarDays} title="Important dates & events">
          <TermList terms={data.importantDates} />
        </Block>
      ) : null}

      {data.keyTerms?.length ? (
        <Block icon={KeyRound} title="Key terms">
          <TermList terms={data.keyTerms} />
        </Block>
      ) : null}

      {data.mnemonics?.length ? (
        <Block icon={Brain} title="Memory aids">
          <Bullets items={data.mnemonics} />
        </Block>
      ) : null}

      {data.quickRevision?.length ? (
        <Block icon={Zap} title="Last-minute revision">
          <Bullets items={data.quickRevision} />
        </Block>
      ) : null}
    </div>
  );
}
