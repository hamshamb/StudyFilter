/**
 * App-wide "open this PDF" service.
 *
 * Some places that link to a PDF have no room for an inline reader (a step in
 * the practice checklist, a link inside a chat answer). Before, those fell back
 * to `target="_blank"`, which pushed the student out of the site and onto the
 * browser's PDF plugin — the exact behaviour we're removing. They now call
 * openPdf() and get the same canvas reader in a full-screen dialog instead.
 *
 *   const { openPdf } = usePdfViewer();
 *   <button onClick={() => openPdf(url, "Maths 2024 Set 1")}>Open paper</button>
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PdfViewer, type PdfViewerAction } from "@/components/pdf/PdfViewer";

interface OpenPdfOptions {
  /** 1-based page to jump to once the document loads. */
  page?: number;
  /** Study shortcuts for the reader toolbar (marking scheme, summary, …). */
  actions?: PdfViewerAction[];
}

interface PdfViewerContextValue {
  openPdf: (url: string, title?: string, options?: OpenPdfOptions) => void;
  closePdf: () => void;
}

const PdfViewerContext = createContext<PdfViewerContextValue | null>(null);

interface ActivePdf {
  url: string;
  title: string;
  page: number;
  actions?: PdfViewerAction[];
}

export function PdfViewerProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActivePdf | null>(null);

  const openPdf = useCallback(
    (url: string, title?: string, options?: OpenPdfOptions) => {
      if (!url) return;
      setActive({
        url,
        title: title ?? "Document",
        page: options?.page ?? 1,
        actions: options?.actions,
      });
    },
    [],
  );

  const closePdf = useCallback(() => setActive(null), []);

  const value = useMemo(() => ({ openPdf, closePdf }), [openPdf, closePdf]);

  return (
    <PdfViewerContext.Provider value={value}>
      {children}
      {/*
        `modal={false}` is load-bearing.

        A modal dialog blocks every pointer event outside itself, which made
        the Study Workspace unusable while a chapter was open — the panel
        rendered but nothing in it could be clicked. Reading a chapter and
        studying it beside the document is the entire point of the reader, so
        the dialog gives up its exclusivity. Escape and the close button still
        dismiss it; it simply no longer insists on being the only thing on
        screen.
      */}
      <Dialog modal={false} open={active !== null} onOpenChange={(open) => !open && closePdf()}>
        {/*
          Sized as a centred window rather than a full-bleed takeover, so the
          page stays visible behind it and closing feels like dismissing a
          dialog — the same shape as the onboarding step. Falls back to nearly
          the full viewport on phones, where a small window would be unreadable.

          `sf-pdf-dialog` lets the reader shift left when the study panel is
          docked, so the two sit side by side instead of overlapping.
        */}
        <DialogContent
          className="sf-pdf-dialog flex h-[85dvh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:h-[88dvh] sm:max-w-4xl"
        >
          <DialogTitle className="sr-only">{active?.title ?? "PDF"}</DialogTitle>
          {active && (
            <PdfViewer
              key={active.url}
              url={active.url}
              title={active.title}
              initialPage={active.page}
              actions={active.actions}
              className="min-h-0 flex-1 rounded-none border-0"
            />
          )}
        </DialogContent>
      </Dialog>
    </PdfViewerContext.Provider>
  );
}

export function usePdfViewer(): PdfViewerContextValue {
  const ctx = useContext(PdfViewerContext);
  if (!ctx) {
    throw new Error("usePdfViewer must be used inside <PdfViewerProvider>");
  }
  return ctx;
}
