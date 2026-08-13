import React from "react";
import {
  FileText,
  BookOpen,
  NotebookPen,
  Target,
  FileStack,
  Download,
  Lock,
  ChevronRight,
} from "lucide-react";
import { PdfViewer } from "@/components/pdf/PdfViewer";
import {
  pdfLibrary,
  getPdfLibraryForSubject,
  SUBJECTS,
  GRADE,
  type PdfResource,
  type PdfResourceType,
  type SubjectId,
} from "@workspace/cbse-content";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { getAccent } from "../hub/accents";

type Icon = React.ComponentType<{ className?: string }>;

const RESOURCE_ICONS: Record<PdfResourceType, Icon> = {
  textbook: BookOpen,
  solutions: FileText,
  notes: NotebookPen,
  "important-questions": Target,
  "sample-paper": FileStack,
};

interface OpenResource {
  subjectName: string;
  chapterTitle: string;
  resource: PdfResource;
}

/**
 * Grade {@link GRADE} PDF library: a subject-wise shelf of chapter-wise PDF
 * cards. Each card opens its own preview panel.
 *
 * INSERT REAL FILE: the actual PDFs are attached via the `url` field of each
 * resource in `lib/cbse-content/pdfLibrary.ts`. They are `null` here until the
 * official files are added, at which point View / Download light up.
 */
export function PdfLibrary({ embedded = false }: { embedded?: boolean }) {
  const [activeSubject, setActiveSubject] = React.useState<SubjectId>(
    SUBJECTS[0].id,
  );
  const [open, setOpen] = React.useState<OpenResource | null>(null);

  const library = getPdfLibraryForSubject(activeSubject) ?? pdfLibrary[0];
  const accent = getAccent(SUBJECTS.find((s) => s.id === activeSubject)?.accent);

  return (
    <section
      id={embedded ? undefined : "pdf-library"}
      className={embedded ? "scroll-mt-20" : "scroll-mt-20 bg-muted/30 px-6 py-12"}
    >
      <div className="mx-auto max-w-5xl">
        {!embedded && (
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <FileStack className="h-3.5 w-3.5" />
              Class {GRADE} PDF library
            </div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Download notes & solutions
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Pick a subject and open any chapter to find its textbook, solutions,
              revision notes and important questions in one place.
            </p>
          </div>
        )}

        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {SUBJECTS.map((subject) => {
            const a = getAccent(subject.accent);
            const on = subject.id === activeSubject;
            return (
              <button
                key={subject.id}
                type="button"
                onClick={() => setActiveSubject(subject.id)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-all ${
                  on
                    ? `${a.solid} border-transparent`
                    : "bg-card hover:border-primary/40"
                }`}
              >
                {subject.name}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border bg-card p-2 sm:p-4">
          <Accordion type="single" collapsible className="w-full">
            {library.chapters.map((group, idx) => (
              <AccordionItem
                key={group.chapterId}
                value={group.chapterId}
                className={idx === library.chapters.length - 1 ? "border-b-0" : ""}
              >
                <AccordionTrigger className="px-2 hover:no-underline sm:px-3">
                  <span className="flex items-center gap-3 text-left">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${accent.soft} ${accent.text}`}
                    >
                      {idx + 1}
                    </span>
                    <span className="font-semibold">{group.chapterTitle}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-2 sm:px-3">
                  <div className="grid gap-3 pt-1 sm:grid-cols-2">
                    {group.resources.map((resource) => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        onOpen={() =>
                          setOpen({
                            subjectName: library.subjectName,
                            chapterTitle: group.chapterTitle,
                            resource,
                          })
                        }
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>

      <PdfDrawer item={open} onClose={() => setOpen(null)} />
    </section>
  );
}

function ResourceCard({
  resource,
  onOpen,
}: {
  resource: PdfResource;
  onOpen: () => void;
}) {
  const Icon = RESOURCE_ICONS[resource.type] ?? FileText;
  const ready = !!resource.url;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex items-center justify-between gap-3 rounded-xl border bg-card p-3.5 text-left transition-all hover:border-primary/40"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {resource.title}
          </span>
          <span className="text-xs text-muted-foreground">
            {ready ? "Ready to view" : "Coming soon"}
          </span>
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}

function PdfDrawer({
  item,
  onClose,
}: {
  item: OpenResource | null;
  onClose: () => void;
}) {
  const ready = !!item?.resource.url;
  return (
    <Drawer open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="mx-auto max-h-[88vh] max-w-2xl">
        {item ? (
          <div className="overflow-y-auto px-5 pb-8 pt-2">
            <DrawerHeader className="px-0 text-left">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <DrawerTitle className="text-2xl">
                    {item.resource.title}
                  </DrawerTitle>
                  <DrawerDescription>
                    {item.subjectName} · {item.chapterTitle}
                  </DrawerDescription>
                </div>
                <DrawerClose asChild>
                  <Button variant="outline" size="sm" className="shrink-0 rounded-lg">
                    Back to Library
                  </Button>
                </DrawerClose>
              </div>
            </DrawerHeader>

            {ready && item.resource.url ? (
              <PdfViewer
                url={item.resource.url}
                title={item.resource.title}
                className="mt-2 h-[60vh] w-full"
              />
            ) : (
              <div className="mt-2 flex aspect-[4/3] w-full flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 p-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-7 w-7" />
                </span>
                <p className="mt-4 font-semibold">Document coming soon</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  The official PDF for this resource will open here once it is
                  attached.
                </p>
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {ready && item.resource.url ? (
                <>
                  <Button asChild variant="outline" className="rounded-lg">
                    <a href={item.resource.url} download>
                      <Download className="mr-1.5 h-4 w-4" /> Download
                    </a>
                  </Button>
                </>
              ) : (
                <>
                  <Button disabled className="rounded-lg">
                    <Lock className="mr-1.5 h-4 w-4" /> View
                  </Button>
                  <Button disabled variant="outline" className="rounded-lg">
                    <Lock className="mr-1.5 h-4 w-4" /> Download
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
