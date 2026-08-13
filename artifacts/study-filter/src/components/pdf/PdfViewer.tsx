/**
 * In-app PDF reader — renders every page to canvas with PDF.js, Internet
 * Archive style. Continuous scroll, zoom, page jump, and selectable text.
 *
 * Deliberately has no <iframe> and no "open in new tab" escape hatch. The old
 * implementation embedded the browser's native PDF plugin, which mobile Safari
 * and Chrome on Android routinely refuse to render inline — that refusal is
 * what produced the "open in a new page" fallbacks. Rendering to canvas
 * ourselves works identically on every browser, so the document always stays
 * inside the site.
 *
 * The worker is bundled from node_modules via Vite's ?url import rather than
 * pulled from a CDN, so the viewer keeps working with no third-party requests.
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as pdfjsLib from "pdfjs-dist";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "pdfjs-dist/types/src/display/api";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  AlertCircle,
  ChevronLeft,
  ExternalLink,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/primitives";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
const DEFAULT_ZOOM_INDEX = 2; // 1.0

function ncertOriginalUrl(url: string): string | null {
  if (!url.includes("/api/library/ncert-file?")) return null;
  try {
    const proxyUrl = new URL(url, window.location.origin);
    const original = proxyUrl.searchParams.get("url");
    if (!original) return null;
    const parsed = new URL(original);
    const officialHost =
      parsed.hostname === "ncert.nic.in" || parsed.hostname === "www.ncert.nic.in";
    return parsed.protocol === "https:" && officialHost && /\.pdf$/i.test(parsed.pathname)
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

/** A study shortcut shown in the reader toolbar, e.g. "Chapter summary". */
export interface PdfViewerAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}

interface PdfViewerProps {
  url: string;
  title?: string;
  onBack?: () => void;
  initialPage?: number;
  className?: string;
  /**
   * Context-specific shortcuts — marking scheme for a past paper, chapter
   * summary for an NCERT chapter. Rendered next to the page controls so the
   * student can jump straight from reading to studying.
   */
  actions?: PdfViewerAction[];
}

interface PageCanvasProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  containerWidth: number;
  onVisible: (pageNumber: number) => void;
}

/**
 * One page. Renders lazily — a page only rasterises once it scrolls near the
 * viewport, so opening a 40-page board paper doesn't block on 40 renders.
 */
function PageCanvas({
  doc,
  pageNumber,
  zoom,
  containerWidth,
  onVisible,
}: PageCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  // Observe both "come close enough to render" and "is the current page".
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const nearObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShouldRender(true);
      },
      { rootMargin: "400px 0px" },
    );

    const currentObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            onVisible(pageNumber);
          }
        }
      },
      { threshold: [0.5] },
    );

    nearObserver.observe(el);
    currentObserver.observe(el);
    return () => {
      nearObserver.disconnect();
      currentObserver.disconnect();
    };
  }, [pageNumber, onVisible]);

  useEffect(() => {
    if (!shouldRender) return;

    let cancelled = false;
    let page: PDFPageProxy | null = null;

    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      page = await doc.getPage(pageNumber);
      if (cancelled) return;

      const baseViewport = page.getViewport({ scale: 1 });
      setAspectRatio(baseViewport.height / baseViewport.width);

      // Fit the page to the container, then apply the user's zoom on top, so
      // 100% means "fits the reader" rather than "72 dpi".
      const fitScale = containerWidth > 0 ? containerWidth / baseViewport.width : 1;
      const cssScale = fitScale * zoom;

      // Render at device pixel ratio so text stays crisp on retina/mobile.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: cssScale * dpr });

      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

      renderTaskRef.current?.cancel();
      const task = page.render({ canvas, canvasContext: context, viewport });
      renderTaskRef.current = task;

      try {
        await task.promise;
      } catch (err) {
        // A cancelled render is expected whenever zoom or width changes
        // mid-flight; anything else is a real failure worth surfacing.
        if ((err as { name?: string })?.name !== "RenderingCancelledException") {
          throw err;
        }
      }
    }

    render().catch(() => {
      /* per-page failure leaves the placeholder in place */
    });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      page?.cleanup();
    };
  }, [doc, pageNumber, zoom, containerWidth, shouldRender]);

  return (
    <div
      ref={wrapperRef}
      data-page-number={pageNumber}
      className="relative mx-auto mb-4 w-full max-w-full"
      style={aspectRatio ? { aspectRatio: `1 / ${aspectRatio}` } : undefined}
    >
      <canvas
        ref={canvasRef}
        className="mx-auto block h-auto max-w-full rounded-sm bg-white shadow-md"
      />
      {!shouldRender && (
        <div className="absolute inset-0 flex min-h-[40vh] items-center justify-center rounded-sm bg-muted/30">
          <Spinner size="lg" className="text-muted-foreground" />
        </div>
      )}
      <div className="pointer-events-none pt-1 text-center text-[11px] text-muted-foreground">
        Page {pageNumber}
      </div>
    </div>
  );
}

export function PdfViewer({
  url,
  title,
  onBack,
  initialPage = 1,
  className = "",
  actions,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [containerWidth, setContainerWidth] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const originalUrl = useMemo(() => ncertOriginalUrl(url), [url]);

  const zoom = ZOOM_STEPS[zoomIndex] ?? 1;

  // Track the reader's width so pages can be fit to it.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      // Leave room for the scrollbar and horizontal padding.
      setContainerWidth(Math.max(0, el.clientWidth - 32));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);
    setProgress(0);

    const task = pdfjsLib.getDocument({
      url,
      // The server serves whole files (Object Storage has no byte-range API),
      // so don't let PDF.js waste a round trip discovering that.
      disableRange: true,
      disableStream: true,
      withCredentials: false,
    });

    task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
      if (!cancelled && total > 0) {
        setProgress(Math.min(100, Math.round((loaded / total) * 100)));
      }
    };

    task.promise
      .then((pdf) => {
        // The cleanup below destroys the loading task, which tears down the
        // document and its transport too — PDFDocumentProxy has no destroy().
        if (cancelled) return;
        setDoc(pdf);
        setNumPages(pdf.numPages);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setIsLoading(false);
        setError(
          err instanceof Error && err.message
            ? err.message
            : "This PDF could not be loaded.",
        );
      });

    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [url, loadAttempt]);

  const scrollToPage = useCallback((page: number) => {
    const el = scrollRef.current?.querySelector(`[data-page-number="${page}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Honour initialPage once the document is ready.
  useEffect(() => {
    if (doc && initialPage > 1) {
      scrollToPage(initialPage);
    }
  }, [doc, initialPage, scrollToPage]);

  const handleVisible = useCallback((page: number) => {
    setCurrentPage(page);
    setPageInput(String(page));
  }, []);

  const commitPageInput = useCallback(() => {
    const parsed = parseInt(pageInput, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > numPages) {
      setPageInput(String(currentPage));
      return;
    }
    scrollToPage(parsed);
  }, [pageInput, numPages, currentPage, scrollToPage]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const pageNumbers = useMemo(
    () => Array.from({ length: numPages }, (_, i) => i + 1),
    [numPages],
  );

  return (
    <div
      ref={containerRef}
      className={`flex flex-col overflow-hidden rounded-xl border bg-card ${className}`}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 dark:bg-muted/20">
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 shrink-0 gap-1.5 text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        )}
        {title && (
          <span
            className="min-w-0 flex-1 truncate text-sm font-semibold"
            title={title}
          >
            {title}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {actions?.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.label}
                variant="ghost"
                size="sm"
                onClick={action.onSelect}
                className="h-8 gap-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{action.label}</span>
              </Button>
            );
          })}
          {actions && actions.length > 0 && (
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          )}

          {numPages > 0 && (
            <div className="mr-1 hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
              <Input
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={commitPageInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitPageInput();
                  }
                }}
                className="h-7 w-12 px-1 text-center text-xs"
                aria-label="Page number"
              />
              <span>/ {numPages}</span>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))
            }
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Document */}
      <div
        ref={scrollRef}
        className="relative min-h-[60vh] flex-1 overflow-y-auto bg-muted/30 px-4 py-4 dark:bg-background"
      >
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/20">
            <div className="flex w-56 flex-col items-center gap-3 text-muted-foreground">
              <Spinner size="lg" className="text-primary" />
              <span className="text-sm">Loading PDF…</span>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {error && originalUrl && (
          <div className="flex min-h-[50vh] flex-col">
            <iframe
              src={`${originalUrl}#view=FitH`}
              title={`${title ?? "NCERT chapter"} PDF`}
              className="min-h-[46vh] w-full flex-1 border-0 bg-background"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-card px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                The StudyFilter reader could not reach NCERT, so this is the official PDF directly.
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                >
                  Retry StudyFilter reader
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={originalUrl} target="_blank" rel="noopener noreferrer">
                    Open official PDF <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && !originalUrl && (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div>
              <p className="font-semibold">Could not load this PDF</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        )}

        {doc &&
          !error &&
          pageNumbers.map((pageNumber) => (
            <PageCanvas
              key={pageNumber}
              doc={doc}
              pageNumber={pageNumber}
              zoom={zoom}
              containerWidth={containerWidth}
              onVisible={handleVisible}
            />
          ))}
      </div>
    </div>
  );
}
