import React from "react";
import { ShieldCheck, ExternalLink } from "lucide-react";
import type { StudyAnswer } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  local_data: "Verified CBSE notes",
  ai_trusted_sources: "Checked against trusted sources",
  ai_general: "Curriculum-aligned answer",
  web_search: "From trusted study sites",
  no_api_key: "Offline notes",
};

/**
 * Where an answer came from, and how much to trust it.
 *
 * This used to be three saturated pills stacked above every answer — a green
 * "high source quality", an amber warning, a blue trust badge — competing
 * with the answer for first read. It is provenance, not a headline, so it is
 * one quiet line now, and the quality signal is a dot rather than a filled
 * chip. It still says everything it said before.
 *
 * The colours come from tokens rather than raw emerald/amber ramps, so they
 * hold up in both themes; the old ones were fixed light-mode swatches with a
 * hand-written dark variant per state.
 */
const QUALITY_DOT: Record<string, string> = {
  high: "bg-success",
  medium: "bg-warning",
  low: "bg-muted-foreground",
};

export function SourceBadge({ answer }: { answer: StudyAnswer }) {
  const label = SOURCE_LABELS[answer.answerSource] ?? "Study answer";
  const refs = (answer.sourceReferences ?? []).filter(Boolean);
  const webSources = (answer.webSources ?? []).filter((s) => s.status === "ok");
  const hasLinks = refs.length > 0 || webSources.length > 0;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          {label}
        </span>

        {answer.sourceQuality && (
          <span className="inline-flex items-center gap-1.5 capitalize">
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                QUALITY_DOT[answer.sourceQuality] ?? "bg-muted-foreground",
              )}
            />
            {answer.sourceQuality} source quality
          </span>
        )}

        {answer.retrievalFailed && (
          <span className="inline-flex items-center gap-1.5 text-warning">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warning" />
            Live sources unavailable — answered from curriculum knowledge
          </span>
        )}
      </div>

      {hasLinks && (
        <div className="flex flex-wrap gap-1.5">
          {webSources.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              {s.domain}
            </a>
          ))}
          {refs.map((r) => (
            <span
              key={r}
              className="inline-flex items-center rounded-md border border-dashed border-border px-2 py-1 text-xs font-medium text-muted-foreground"
            >
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
