import React from "react";
import {
  Search,
  TimerReset,
  FileText,
  X,
  ChevronRight,
  Clock,
  BookOpen,
} from "lucide-react";
import { useListLibraryPapers } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { MockTestOverlay, type MockPaper } from "./MockTestOverlay";
import { Spinner } from "@/components/ui/primitives";
import { subjectAccentByName } from "@/lib/curriculum";

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECTS = ["All", "Mathematics", "Science", "Social Science", "English", "Hindi"];
const PAGE_SIZE = 40;

/**
 * Subject colours come from the shared identity tokens rather than a map kept
 * here. This file used to hardcode blue/emerald/amber/purple/rose at 100 and
 * 50 with hand-written dark variants — a fifth independent opinion about what
 * colour Science is, and one that disagreed with the subject cards, the
 * planner and the chapter pages.
 */
function subjectColors(subject: string): { pill: string; badge: string } {
  const accent = subjectAccentByName(subject);
  return {
    pill: `${accent.soft} ${accent.text}`,
    badge: `${accent.soft} ${accent.text} ${accent.border}`,
  };
}

type TypeFilter = "all" | "pyq" | "sample";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileKeyToUrl(fileKey: string | null | undefined): string | null {
  if (!fileKey) return null;
  return `/api/library/files/${encodeURIComponent(fileKey)}`;
}

interface RawPaper {
  id: number;
  subject: string;
  year: number;
  title: string;
  paperType: string;
  storedFileKey?: string | null;
  setName?: string | null;
  series?: string | null;
  durationMinutes?: number | null;
  maximumMarks?: number | null;
}

function toMockPaper(p: RawPaper): MockPaper {
  return {
    id: p.id,
    year: p.year,
    subject: p.subject,
    title: p.title,
    paperType: p.paperType === "sample_paper" ? "Sample" : "PYQ",
    paperUrl: fileKeyToUrl(p.storedFileKey),
    durationMinutes: p.durationMinutes ?? 180,
    maximumMarks: p.maximumMarks ?? 80,
    setName: p.setName ?? null,
    series: p.series ?? null,
  };
}

function groupByYear(papers: MockPaper[]): [number, MockPaper[]][] {
  const map = new Map<number, MockPaper[]>();
  for (const p of papers) {
    const existing = map.get(p.year) ?? [];
    existing.push(p);
    map.set(p.year, existing);
  }
  return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MockExamPicker() {
  const [query, setQuery] = React.useState("");
  const [activeSubject, setActiveSubject] = React.useState("All");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [selected, setSelected] = React.useState<MockPaper | null>(null);
  const [mockTarget, setMockTarget] = React.useState<MockPaper | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  const pyqQuery = useListLibraryPapers({ paperType: "previous_year" });
  const sampleQuery = useListLibraryPapers({ paperType: "sample_paper" });

  const allPapers: MockPaper[] = React.useMemo(() => {
    const pyqs = ((pyqQuery.data as { papers?: RawPaper[] } | undefined)?.papers ?? []).map(toMockPaper);
    const samples = ((sampleQuery.data as { papers?: RawPaper[] } | undefined)?.papers ?? []).map(toMockPaper);
    const combined = [...pyqs, ...samples];
    combined.sort((a, b) => b.year - a.year || a.subject.localeCompare(b.subject));
    return combined;
  }, [pyqQuery.data, sampleQuery.data]);

  const filtered = React.useMemo(() => {
    return allPapers.filter((p) => {
      if (typeFilter === "pyq" && p.paperType !== "PYQ") return false;
      if (typeFilter === "sample" && p.paperType !== "Sample") return false;
      if (activeSubject !== "All" && p.subject !== activeSubject) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !p.subject.toLowerCase().includes(q) &&
          !String(p.year).includes(q) &&
          !p.title.toLowerCase().includes(q) &&
          !(p.setName ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [allPapers, typeFilter, activeSubject, query]);

  React.useEffect(() => setVisibleCount(PAGE_SIZE), [query, activeSubject, typeFilter]);

  const visiblePapers = React.useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const grouped = React.useMemo(() => groupByYear(visiblePapers), [visiblePapers]);

  const loading = pyqQuery.isPending || sampleQuery.isPending;
  const error = pyqQuery.isError || sampleQuery.isError;

  function handleSelect(paper: MockPaper) {
    setSelected((prev) => (prev?.id === paper.id ? null : paper));
  }

  function handleStart() {
    if (selected) setMockTarget(selected);
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* Search bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search mock papers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by subject, year, or paper name…"
            className="h-11 w-full rounded-xl border bg-background pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear paper search"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Type toggle */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border bg-muted/40 p-1">
            {(["all", "pyq", "sample"] as TypeFilter[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={[
                  "rounded-full px-4 py-1 text-sm font-semibold transition-all",
                  typeFilter === t
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {t === "all" ? "All Papers" : t === "pyq" ? "PYQ (Board Exams)" : "Sample Papers"}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            Showing {visiblePapers.length} of {filtered.length} paper{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Subject filter */}
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((subj) => {
            const on = subj === activeSubject;
            const colors = subjectColors(subj);
            return (
              <button
                key={subj}
                type="button"
                onClick={() => setActiveSubject(subj)}
                className={[
                  "rounded-full border px-3 py-1 text-sm font-semibold transition-all",
                  on
                    ? subj === "All"
                      ? "bg-primary text-primary-foreground border-transparent"
                      : `${colors?.pill ?? ""} border-transparent`
                    : "bg-card hover:border-primary/40",
                ].join(" ")}
              >
                {subj}
              </button>
            );
          })}
        </div>

        {/* Paper list */}
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-10 text-muted-foreground">
            <Spinner size="md" />
            <span className="text-sm">Loading papers…</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive">
            Failed to load papers. Please try again.
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-12 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-semibold text-muted-foreground">No papers match your search</p>
            <p className="mt-1 text-xs text-muted-foreground">Try a different subject, year, or clear the search</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([year, papers]) => (
              <div key={year} className="rounded-xl border bg-card p-1">
                <div className="flex items-center gap-2 px-4 py-3">
                  <span className="flex h-8 items-center rounded-lg bg-primary/10 px-3 text-sm font-bold text-primary">
                    {year}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {papers.length} paper{papers.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="divide-y rounded-xl overflow-hidden border mx-1 mb-1">
                  {papers.map((paper) => {
                    const isSelected = selected?.id === paper.id;
                    const colors = subjectColors(paper.subject);
                    return (
                      <button
                        key={paper.id}
                        type="button"
                        onClick={() => handleSelect(paper)}
                        className={[
                          "group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all",
                          isSelected
                            ? "bg-primary/5 border-l-2 border-l-primary"
                            : "hover:bg-muted/40",
                        ].join(" ")}
                      >
                        {/* Subject badge */}
                        <span
                          className={[
                            "shrink-0 rounded-lg border px-2.5 py-1 text-xs font-bold",
                            colors?.badge ?? "bg-muted text-muted-foreground border-border",
                          ].join(" ")}
                        >
                          {paper.subject}
                        </span>

                        {/* Title + meta */}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {paper.title}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {paper.durationMinutes} min
                            </span>
                            {paper.setName && <span>· {paper.setName}</span>}
                            {paper.series && <span>· {paper.series}</span>}
                          </span>
                        </span>

                        {/* Type badge */}
                        <span
                          className={[
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            paper.paperType === "PYQ"
                              ? "bg-primary/10 text-primary"
                              : "bg-warning-soft text-warning",
                          ].join(" ")}
                        >
                          {paper.paperType === "PYQ" ? "Board Exam" : "Sample"}
                        </span>

                        {/* Arrow / check */}
                        {isSelected ? (
                          <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {visiblePapers.length < filtered.length && (
              <div className="flex justify-center pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  Show {Math.min(PAGE_SIZE, filtered.length - visiblePapers.length)} more papers
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky footer when paper is selected */}
      {selected && (
        <div className="sticky bottom-0 mt-4 -mx-4 px-4 pb-4 pt-3 bg-background/80 backdrop-blur border-t">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{selected.subject} · {selected.year}</p>
              <p className="text-xs text-muted-foreground">
                {selected.paperType === "PYQ" ? "CBSE Board Exam" : "Official Sample Paper"} · {selected.durationMinutes} min
              </p>
            </div>
            <Button onClick={handleStart} className="gap-2 shrink-0 rounded-xl" size="lg">
              <TimerReset className="h-5 w-5" />
              Start Mock Exam
            </Button>
          </div>
        </div>
      )}

      {/* Overlay */}
      {mockTarget && (
        <MockTestOverlay
          paper={mockTarget}
          onClose={() => {
            setMockTarget(null);
            setSelected(null);
          }}
        />
      )}
    </>
  );
}
