import React from "react";
import { SeoHead } from "@/components/SeoHead";
import { Link, useParams } from "wouter";
import {
  BookOpen,
  BookText,
  BookOpenCheck,
  ClipboardCheck,
  FileQuestion,
  GraduationCap,
  Layers,
  Target,
  TimerReset,
  Info,
  Library as LibraryIcon,
  ChevronDown,
  ChevronUp,
  Lock,
  FileDown,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePdfViewer } from "@/components/pdf/PdfViewerProvider";
import { MockExamPicker } from "@/components/papers/MockExamPicker";
import {
  pdfLibrary,
  GRADE,
  SUBJECTS,
  type SubjectId,
} from "@workspace/cbse-content";
import { useStudyWorkspace } from "@/components/workspace/StudyWorkspace";
import type { WorkspaceKind } from "@/components/workspace/types";
import { recordRecent } from "@/hooks/use-recents";
import { rememberScope } from "@/hooks/use-study-scope";
import {
  useListLibraryPapers,
  type ExamPaper,
  type NcertBook,
} from "@workspace/api-client-react";
import { PageShell, PageHeader } from "@/components/layout/PageShell";
import { LoadingBlock } from "@/components/ui/primitives";

// API query param values (must match OpenAPI spec enum)
const PAPER_TYPE = {
  PYQ: "previous_year",
} as const;

// ─── Subject slug helpers (for URL-safe subject names) ────────────────────────

function toSubjectSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function fromSubjectSlug(slug: string, list: string[]): string {
  return list.find((s) => toSubjectSlug(s) === slug) ?? list[0]!;
}

// ─── Tab config ───────────────────────────────────────────────────────────────

type LibSection = "ncert" | "pyq" | "mock";

const TABS: {
  key: LibSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "ncert",    label: "NCERT",      icon: BookOpen },
  { key: "pyq",      label: "PYQs",       icon: GraduationCap },
  { key: "mock",     label: "Mock",       icon: TimerReset },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SectionShell({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}

function YearBadge({ year }: { year: number }) {
  return (
    <span className="flex h-9 items-center rounded-lg bg-primary/10 px-3 text-sm font-bold text-primary">
      {year}
    </span>
  );
}

function SourceBadge({ source }: { source: "ncert" | "selfstudys" }) {
  if (source === "ncert") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-semibold text-success">
        Source: NCERT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
      Source: SelfStudys
    </span>
  );
}

function LoadingShell() {
  return (
    <LoadingBlock label="Loading papers…" />
  );
}

function ErrorShell({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ─── PDF Card ─────────────────────────────────────────────────────────────────

function PdfCard({
  title,
  fileKey,
  sourceUrl,
  meta,
  origin = "official",
  paperId,
  hasMarkingScheme = false,
}: {
  title: string;
  fileKey?: string | null;
  sourceUrl?: string;
  meta?: string;
  /** "generated" papers are practice material we wrote, not real CBSE releases. */
  origin?: string;
  paperId?: number;
  /** Whether this paper has a marking scheme linked in the database. */
  hasMarkingScheme?: boolean;
}) {
  const { openPdf } = usePdfViewer();
  const fileUrl = fileKey ? `/api/library/files/${fileKey}` : null;

  /**
   * Loads the linked marking scheme and swaps the reader over to it, so a
   * student can check their answers without leaving the paper. Only offered
   * when the database actually has one — no dead button.
   */
  async function openMarkingScheme() {
    if (!paperId) return;
    try {
      const res = await fetch(`/api/library/papers/${paperId}/marking-scheme`);
      if (!res.ok) return;
      const { markingScheme } = await res.json();
      if (!markingScheme?.storedFileKey) return;
      openPdf(
        `/api/library/files/${markingScheme.storedFileKey}`,
        `${title} — Marking Scheme`,
      );
    } catch {
      /* leave the paper open; the answer sheet just isn't available */
    }
  }

  function openPaper() {
    if (!fileUrl) return;
    openPdf(fileUrl, title, {
      actions:
        hasMarkingScheme && paperId
          ? [
              {
                label: "Answers",
                icon: ClipboardCheck,
                onSelect: openMarkingScheme,
              },
            ]
          : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileDown className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug line-clamp-2">{title}</p>
          {meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
          {/* Never let a generated practice paper pass as a real board paper —
              someone revising needs to know which is which. */}
          {origin === "generated" && (
            <span className="mt-1 inline-flex items-center rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning">
              Practice paper · not an official CBSE paper
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {fileUrl ? (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 rounded-lg text-xs"
            onClick={openPaper}
          >
            Open PDF
          </Button>
        ) : (
          <span className="flex flex-1 items-center gap-1.5 rounded-lg border border-dashed bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" /> File pending
          </span>
        )}
        {/* Attribution back to where the material came from — deliberately
            labelled "Source" rather than an anonymous external-link icon, so it
            never reads as "click here to view the PDF somewhere else". The
            paper itself always opens in the reader above. */}
        {sourceUrl && (
          <Button asChild size="sm" variant="ghost" className="rounded-lg text-xs text-muted-foreground">
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              Source
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── NCERT Books ──────────────────────────────────────────────────────────────

function NcertSection({ activeSubjectId }: { activeSubjectId: SubjectId }) {
  const [expandedChapter, setExpandedChapter] = React.useState<string | null>(null);

  const subjectLib = pdfLibrary.find((l) => l.subjectId === activeSubjectId);
  const chapters = subjectLib?.chapters ?? [];

  return (
    <SectionShell>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Official NCERT chapter PDFs, sourced directly from ncert.nic.in.</p>
        <SourceBadge source="ncert" />
      </div>

      <div className="flex flex-wrap gap-2">
        {SUBJECTS.map((s) => (
          <Link
            key={s.id}
            href={`/library/ncert/${s.id}`}
            className={[
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
              activeSubjectId === s.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border bg-card text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {s.shortName}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card divide-y">
        {chapters.map((ch, idx) => {
          const textbook = ch.resources.find((r) => r.type === "textbook" && r.url);
          const isOpen = expandedChapter === ch.chapterId;

          return (
            <div key={ch.chapterId}>
              <button
                type="button"
                onClick={() => setExpandedChapter(isOpen ? null : ch.chapterId)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {idx + 1}
                </span>
                <span className="flex-1 text-sm font-semibold leading-snug">{ch.chapterTitle}</span>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              {isOpen && textbook && (
                <NcertChapterExpanded
                  id={textbook.id}
                  url={textbook.url!}
                  label="NCERT Textbook Chapter"
                  subjectId={activeSubjectId}
                  chapterId={ch.chapterId}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        PDFs open inside StudyFilter. Source: official NCERT website (ncert.nic.in).
      </p>
    </SectionShell>
  );
}

function NcertChapterExpanded({
  id,
  url,
  label,
  subjectId,
  chapterId,
}: {
  id: string;
  url: string;
  label: string;
  subjectId: SubjectId;
  chapterId: string;
}) {
  const { openPdf } = usePdfViewer();
  const workspace = useStudyWorkspace();

  // NCERT chapter PDFs live on ncert.nic.in, which sends no CORS header, so the
  // canvas reader cannot fetch them directly — go through our proxy instead.
  const proxiedUrl = `/api/library/ncert-file?url=${encodeURIComponent(url)}`;

  /**
   * Opens the chapter with its study tools attached.
   *
   * These used to close the reader and navigate to the chapter page: click
   * "Chapter summary" while reading Chapter 11 and the chapter you were
   * reading disappeared. They open the Study Workspace beside the document
   * now, so the PDF stays exactly where it was — same page, same scroll
   * position — and the summary appears next to it.
   */
  function openWithStudyActions() {
    const scope = {
      classLevel: GRADE,
      subjectId,
      chapterId,
    };
    const study = (kind: WorkspaceKind) => () => workspace.open({ kind, scope });

    openPdf(proxiedUrl, label, {
      actions: [
        { label: "Chapter summary", icon: BookText, onSelect: study("summary") },
        { label: "NCERT answers", icon: BookOpenCheck, onSelect: study("ncert") },
        { label: "Important questions", icon: Target, onSelect: study("important") },
        { label: "Quiz this chapter", icon: FileQuestion, onSelect: study("quiz") },
        { label: "Flashcards", icon: Layers, onSelect: study("flashcards") },
      ],
    });

    recordRecent({
      kind: "reader",
      title: label,
      subtitle: SUBJECTS.find((s) => s.id === subjectId)?.name,
      href: `/library/ncert/${subjectId}`,
      subjectId,
      chapterId,
    });
    rememberScope({ subjectId, chapterId });
  }

  return (
    <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2 rounded-xl border bg-background p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" />
          </span>
          <p className="text-sm font-semibold leading-snug">{label}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 rounded-lg text-xs" onClick={openWithStudyActions}>
            Open PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Previous-Year Papers (DB-backed) ─────────────────────────────────────────

const PYQ_SUBJECTS = ["Mathematics", "Science", "Social Science", "English", "Hindi"];

function PYQSection({ activeSubject }: { activeSubject: string }) {
  const { data, isLoading, isError } = useListLibraryPapers({
    paperType: PAPER_TYPE.PYQ,
    subject: activeSubject,
  });

  const papers = data?.papers ?? [];

  // Group by year
  const byYear: Record<number, ExamPaper[]> = {};
  for (const p of papers) {
    if (!byYear[p.year]) byYear[p.year] = [];
    byYear[p.year]!.push(p);
  }
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <SectionShell>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Real CBSE board exam papers (the actual question papers students wrote). Source: SelfStudys only.
        </p>
        <SourceBadge source="selfstudys" />
      </div>

      {/* Subject selector */}
      <div className="flex flex-wrap gap-2">
        {PYQ_SUBJECTS.map((s) => (
          <Link
            key={s}
            href={`/library/pyq/${toSubjectSlug(s)}`}
            className={[
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
              activeSubject === s
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border bg-card text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {s === "Social Science" ? "Soc. Sci." : s}
          </Link>
        ))}
      </div>

      {isLoading && <LoadingShell />}
      {isError && <ErrorShell message="Failed to load papers. Please try again." />}

      {!isLoading && !isError && papers.length === 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>No papers imported yet for {activeSubject}. Run the importer to populate this section.</span>
        </div>
      )}

      {!isLoading && !isError && years.length > 0 && (
        <div className="space-y-4">
          {years.map((year) => {
            const yearPapers = byYear[year] ?? [];
            return (
              <div key={year} className="rounded-xl border bg-card p-4">
                <div className="mb-3 flex items-center gap-3">
                  <YearBadge year={year} />
                  <span className="text-xs text-muted-foreground">{yearPapers.length} paper{yearPapers.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {yearPapers.map((p) => (
                    <PdfCard
                      key={p.id}
                      title={p.title}
                      fileKey={p.storedFileKey}
                      sourceUrl={p.officialSourceUrl ?? undefined}
                      origin={p.origin}
                      paperId={p.id}
                      hasMarkingScheme={p.markingSchemeId != null}
                      meta={[p.setName, p.series].filter(Boolean).join(" · ")}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Papers sourced from SelfStudys only. CBSE Academic (cbseacademic.nic.in) is never used.
      </p>
    </SectionShell>
  );
}

// ─── Mock Exams ───────────────────────────────────────────────────────────────

function MockExamsSection() {
  return (
    <SectionShell>
      <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Sit any paper as a timed mock exam under real board conditions. The 3-hour timer runs, question palette tracks your progress, and section-wise score is recorded when you finish.
        </span>
      </div>
      <MockExamPicker />
    </SectionShell>
  );
}

const VALID_SECTIONS = new Set<LibSection>(["ncert", "pyq", "mock"]);

function toSection(raw: string | undefined): LibSection {
  return VALID_SECTIONS.has(raw as LibSection) ? (raw as LibSection) : "ncert";
}

const NCERT_SUBJECT_IDS = SUBJECTS.map((s) => s.id);

function toNcertSubjectId(raw: string | undefined): SubjectId {
  return (NCERT_SUBJECT_IDS.includes(raw as SubjectId) ? raw : SUBJECTS[0].id) as SubjectId;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Library() {
  const params = useParams<{ section?: string; subject?: string }>();
  const section = toSection(params.section);

  // Derive active subject per section type
  const ncertSubjectId = toNcertSubjectId(params.subject);
  const pyqSubject = fromSubjectSlug(params.subject ?? "", PYQ_SUBJECTS);

  return (
    <>
    <SeoHead
      title="Study Library — NCERT Books & Previous Year Papers | StudyFilter"
      description="Access CBSE NCERT textbooks, previous year question papers, and mock exams for Class 8–12. Free PDF study resources for exam preparation."
      canonical="/library"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "CBSE Study Library",
        description:
          "NCERT textbooks, previous year question papers, and mock exams for Class 8–12.",
        url: "/library",
        isPartOf: {
          "@type": "WebSite",
          name: "StudyFilter",
          url: "/",
        },
        hasPart: [
          { "@type": "CreativeWork", name: "NCERT Textbooks" },
          { "@type": "CreativeWork", name: "Previous Year Question Papers" },
          { "@type": "CreativeWork", name: "Mock Exams" },
        ],
      }}
    />
    <PageShell>
      <PageHeader
        icon={LibraryIcon}
        title="Library"
        description="NCERT books, Exemplar, past papers, and mock exams."
        className="mb-4"
      />

      {/* Tab strip */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border bg-muted/50 p-1 scrollbar-none">
        {TABS.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={`/library/${key}`}
            className={[
              "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs sm:text-sm font-semibold transition-all",
              section === key
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        ))}
      </div>

      {section === "ncert"    && <NcertSection activeSubjectId={ncertSubjectId} />}
      {section === "pyq"      && <PYQSection activeSubject={pyqSubject} />}
      {section === "mock"     && <MockExamsSection />}
    </PageShell>
    </>
  );
}
