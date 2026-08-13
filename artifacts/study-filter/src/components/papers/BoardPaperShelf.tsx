import React from "react";
import {
  FileText,
  ClipboardCheck,
  PenLine,
  TimerReset,
  ChevronRight,
  CalendarDays,
  Library,
  Lock,
  Download,
  Info,
} from "lucide-react";
import {
  boardPapers,
  getBoardPaperYears,
  SUBJECTS,
  type BoardPaper,
  type SubjectId,
} from "@workspace/cbse-content";
import { Button } from "@/components/ui/button";
import { usePdfViewer } from "@/components/pdf/PdfViewerProvider";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { getAccent } from "../hub/accents";
import { PracticeSessionOverlay } from "./PracticeSessionOverlay";
import { MockTestOverlay, type MockPaper } from "./MockTestOverlay";

type View = "year" | "subject";

function boardPaperToMockPaper(bp: BoardPaper): MockPaper {
  return {
    id: bp.year * 10 + SUBJECTS.findIndex((s) => s.id === bp.subjectId),
    year: bp.year,
    subject: bp.subjectName,
    title: `${bp.subjectName} ${bp.year}`,
    paperType: bp.questionPaperKind === "board" ? "PYQ" : "Sample",
    paperUrl: bp.questionPaperUrl,
    durationMinutes: 180,
    maximumMarks: 80,
    setName: null,
    series: null,
  };
}

const YEARS = getBoardPaperYears();

function paperFor(year: number, subjectId: SubjectId): BoardPaper | undefined {
  return boardPapers.find((p) => p.year === year && p.subjectId === subjectId);
}

/**
 * Past 10 years of CBSE board papers, browsable by year or by subject.
 *
 * Source policy (FINAL): all paper PDFs come from SelfStudys only.
 * URLs are populated by the SelfStudys importer; slots without URLs
 * show a "content being imported" state rather than broken links.
 */
export function BoardPaperShelf({ embedded = false }: { embedded?: boolean }) {
  const [view, setView] = React.useState<View>("year");
  const [activeSubject, setActiveSubject] = React.useState<SubjectId>(
    SUBJECTS[0].id,
  );
  const [open, setOpen] = React.useState<BoardPaper | null>(null);
  const [practiceTarget, setPracticeTarget] = React.useState<BoardPaper | null>(null);
  const [mockTestTarget, setMockTestTarget] = React.useState<MockPaper | null>(null);

  return (
    <section
      id={embedded ? undefined : "board-papers"}
      className={embedded ? "scroll-mt-20" : "scroll-mt-20 px-6 py-12"}
    >
      <div className="mx-auto max-w-5xl">
        {!embedded && (
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Library className="h-3.5 w-3.5" />
              10 years of board papers
            </div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              CBSE Board Papers
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Browse the last {YEARS.length} years of question papers — practise
              them openly or attempt one as a timed mock test.
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="mb-6 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1">
            <Download className="h-3 w-3 text-primary" />
            <span className="font-semibold text-primary">
              Real board paper
            </span>
            <span className="text-primary">
              2022–2025
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-soft px-3 py-1">
            <FileText className="h-3 w-3 text-warning" />
            <span className="font-semibold text-warning">
              Official practice paper
            </span>
            <span className="text-warning">
              2016–2021
            </span>
          </span>
        </div>

        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-full border bg-card p-1">
            <ViewTab
              active={view === "year"}
              onClick={() => setView("year")}
              icon={CalendarDays}
              label="By year"
            />
            <ViewTab
              active={view === "subject"}
              onClick={() => setView("subject")}
              icon={Library}
              label="By subject"
            />
          </div>
        </div>

        {view === "year" ? (
          <div className="space-y-4">
            {YEARS.map((year) => {
              const isBoard = year >= 2022;
              return (
                <div key={year} className="rounded-xl border bg-card p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="flex h-9 items-center rounded-lg bg-primary/10 px-3 text-sm font-bold text-primary">
                      {year}
                    </span>
                    {isBoard ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        <Download className="h-3 w-3" />
                        Real board paper
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                        <FileText className="h-3 w-3" />
                        Official practice paper
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {SUBJECTS.map((subject) => {
                      const paper = paperFor(year, subject.id);
                      if (!paper) return null;
                      return (
                        <PaperChip
                          key={subject.id}
                          accentToken={subject.accent}
                          label={subject.shortName}
                          onClick={() => setOpen(paper)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <div className="mb-6 flex flex-wrap justify-center gap-2">
              {SUBJECTS.map((subject) => {
                const accent = getAccent(subject.accent);
                const on = subject.id === activeSubject;
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => setActiveSubject(subject.id)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-all ${
                      on
                        ? `${accent.solid} border-transparent`
                        : "bg-card hover:border-primary/40"
                    }`}
                  >
                    {subject.name}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {YEARS.map((year) => {
                const paper = paperFor(year, activeSubject);
                if (!paper) return null;
                return (
                  <PaperChip
                    key={year}
                    accentToken={
                      SUBJECTS.find((s) => s.id === activeSubject)?.accent
                    }
                    label={String(year)}
                    onClick={() => setOpen(paper)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BoardPaperDrawer
        paper={open}
        onClose={() => setOpen(null)}
        onPractice={(p) => { setOpen(null); setPracticeTarget(p); }}
        onMockTest={(p) => { setOpen(null); setMockTestTarget(boardPaperToMockPaper(p)); }}
      />

      {practiceTarget && (
        <PracticeSessionOverlay
          paper={practiceTarget}
          onClose={() => setPracticeTarget(null)}
        />
      )}
      {mockTestTarget && (
        <MockTestOverlay
          paper={mockTestTarget}
          onClose={() => setMockTestTarget(null)}
        />
      )}
    </section>
  );
}

function ViewTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function PaperChip({
  accentToken,
  label,
  onClick,
}: {
  accentToken?: string;
  label: string;
  onClick: () => void;
}) {
  const accent = getAccent(accentToken);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center justify-between gap-2 rounded-xl border bg-card p-3 text-left transition-all ${accent.border}`}
    >
      <span className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent.soft} ${accent.text}`}
        >
          <FileText className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold">{label}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}

function BoardPaperDrawer({
  paper,
  onClose,
  onPractice,
  onMockTest,
}: {
  paper: BoardPaper | null;
  onClose: () => void;
  onPractice: (paper: BoardPaper) => void;
  onMockTest: (paper: BoardPaper) => void;
}) {
  const isBoard = paper?.questionPaperKind === "board";

  return (
    <Drawer open={!!paper} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="mx-auto max-h-[88vh] max-w-2xl">
        {paper ? (
          <div className="overflow-y-auto px-5 pb-8 pt-2">
            <DrawerHeader className="px-0 text-left">
              <div className="mb-3 flex justify-end">
                <DrawerClose asChild>
                  <Button variant="outline" size="sm" className="shrink-0 rounded-lg">
                    Back to Library
                  </Button>
                </DrawerClose>
              </div>
              <div className="mb-2">
                {isBoard ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    <Download className="h-3 w-3" />
                    Real board paper
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
                    <FileText className="h-3 w-3" />
                    Official practice paper
                  </span>
                )}
              </div>
              <DrawerTitle className="text-2xl">
                {paper.subjectName} · {paper.year}
              </DrawerTitle>
              <DrawerDescription>
                {isBoard
                  ? `The actual CBSE Class 10 board exam paper from ${paper.year}, as it was given to students. Source: SelfStudys.`
                  : `Official CBSE Sample Question Paper for the ${paper.year} board exam — released by CBSE before each exam with the same format, difficulty, and syllabus. Source: SelfStudys.`}
              </DrawerDescription>
            </DrawerHeader>

            {isBoard && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs text-primary">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  The ZIP contains multiple question sets (Set 1, Set 2, Set 3).
                  Open any set to practise — they are all equally valid for your
                  preparation.
                </span>
              </div>
            )}

            {!isBoard && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs text-warning">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  This is the official CBSE Sample Question Paper, not the
                  actual board exam. It is created by CBSE to the same standard
                  and is the best available resource for pre-2022 practice.
                </span>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <PaperSlot
                icon={isBoard ? Download : FileText}
                title="Question paper"
                url={paper.questionPaperUrl}
                isZip={isBoard}
                unavailableReason="Being imported from SelfStudys — check back soon"
              />
              <PaperSlot
                icon={ClipboardCheck}
                title="Marking scheme"
                url={paper.markingSchemeUrl}
                isZip={false}
                unavailableReason={
                  isBoard
                    ? "CBSE does not publish marking schemes for real board exam papers"
                    : "Being imported from SelfStudys — check back soon"
                }
              />
            </div>

            <div className="mt-6">
              <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Work with this paper
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ActionCard
                  icon={PenLine}
                  title="Practice"
                  description="Solve at your own pace with the marking scheme alongside."
                  disabled={!paper.questionPaperUrl}
                  onClick={() => onPractice(paper)}
                />
                <ActionCard
                  icon={TimerReset}
                  title="Attempt as mock test"
                  description="Sit the full paper under timed exam conditions."
                  disabled={!paper.questionPaperUrl}
                  onClick={() => onMockTest(paper)}
                />
              </div>
            </div>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function PaperSlot({
  icon: Icon,
  title,
  url,
  isZip,
  unavailableReason,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  url: string | null;
  isZip: boolean;
  unavailableReason?: string;
}) {
  const { openPdf } = usePdfViewer();
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="font-semibold">{title}</span>
      </div>
      {url && isZip ? (
        <Button asChild variant="outline" className="rounded-lg">
          {/* A ZIP cannot be rendered in the reader, so this stays a download —
              it saves the file rather than navigating away from the site. */}
          <a href={url} download>
            Download (ZIP)
          </a>
        </Button>
      ) : url ? (
        <Button
          type="button"
          variant="outline"
          className="rounded-lg"
          onClick={() => openPdf(url, title)}
        >
          Open PDF
        </Button>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{unavailableReason ?? "Not available"}</span>
        </div>
      )}
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  disabled: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all enabled: enabled:hover:border-primary/40 enabled: disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}
