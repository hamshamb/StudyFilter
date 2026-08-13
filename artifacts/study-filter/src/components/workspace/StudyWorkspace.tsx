import React from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  BookOpenCheck,
  BookText,
  Expand,
  FileQuestion,
  Layers,
  MessageSquareText,
  NotebookPen,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { SUBJECTS } from "@workspace/cbse-content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBodyScrollLock, useFocusTrap } from "@/hooks/use-focus-trap";
import { resolveScope, scopeToSearch, type ResolvedScope } from "@/lib/scope";
import type { WorkspaceKind, WorkspaceRequest, WorkspaceState } from "./types";
import { WorkspaceBody } from "./WorkspaceBody";

/**
 * The Study Workspace.
 *
 * One panel, opened from anywhere, that does the studying *next to* whatever
 * the student is reading rather than instead of it. Clicking "Chapter summary"
 * while an NCERT PDF is open must not navigate away, must not open a browser
 * tab, and must not lose the page they were on — the document stays exactly
 * where it was and the summary appears beside it.
 *
 * Two presentations, one component:
 *
 * - **Desktop** — a docked panel on the right. Deliberately *non-modal*: no
 *   backdrop, no focus trap, no scroll lock, because the PDF behind it is
 *   still meant to be scrolled and selected from. It is a `complementary`
 *   landmark, not a dialog, which is also what a screen reader should be told.
 * - **Mobile** — a bottom sheet covering most of the screen. Here it genuinely
 *   is modal, so it gets `role="dialog"`, a focus trap, a scroll lock and a
 *   backdrop, because nothing behind it is usable at that size.
 *
 * "Expand" hands the same scope to the full-page route and closes the panel.
 * Nothing is lost in the handover because both surfaces read the same cached
 * query — see lib/study-content.ts — so the page opens already populated.
 */

interface WorkspaceContextValue {
  open: (request: WorkspaceRequest) => void;
  /** Replaces the current panel, remembering the old one for Back. */
  push: (request: WorkspaceRequest) => void;
  close: () => void;
  isOpen: boolean;
  current: WorkspaceRequest | null;
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

export function useStudyWorkspace(): WorkspaceContextValue {
  const ctx = React.useContext(WorkspaceContext);
  if (!ctx) throw new Error("useStudyWorkspace must be used inside <StudyWorkspaceProvider>");
  return ctx;
}

/**
 * Optional variant for components that may render outside the provider (a
 * standalone page rendered by a test, say). Returns null instead of throwing.
 */
export function useOptionalStudyWorkspace(): WorkspaceContextValue | null {
  return React.useContext(WorkspaceContext);
}

interface KindSpec {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Where "Open full page" goes. Null means this kind has no full page. */
  route: string | null;
  /**
   * Extra query parameters so the full page opens on the same thing the panel
   * was showing. Without this, expanding "Important questions" opened the
   * revision page on the chapter summary — the panel and its own full-page
   * version disagreeing about what you were looking at.
   */
  params?: Record<string, string>;
}

export const KIND_SPECS: Record<WorkspaceKind, KindSpec> = {
  summary: { label: "Chapter summary", icon: BookText, route: "/revise", params: { format: "summary" } },
  // There is no /important route; important questions are a format of the
  // revision workspace, which is where this must land.
  important: {
    label: "Important questions",
    icon: Target,
    route: "/revise",
    params: { format: "important" },
  },
  notes: { label: "Quick revision", icon: NotebookPen, route: "/revise", params: { format: "onepage" } },
  ncert: { label: "NCERT answers", icon: BookOpenCheck, route: null },
  explain: { label: "Explain", icon: Sparkles, route: "/explain" },
  quiz: { label: "Quiz this chapter", icon: FileQuestion, route: "/quiz" },
  flashcards: { label: "Make flashcards", icon: Layers, route: "/flashcards" },
  ask: { label: "Ask StudyFilter", icon: MessageSquareText, route: "/chat" },
};

export function StudyWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<WorkspaceState>({
    open: false,
    request: null,
    history: [],
    expanded: false,
  });

  const open = React.useCallback((request: WorkspaceRequest) => {
    setState({ open: true, request, history: [], expanded: false });
  }, []);

  const push = React.useCallback((request: WorkspaceRequest) => {
    setState((prev) => ({
      open: true,
      request,
      history: prev.request ? [...prev.history, prev.request].slice(-5) : prev.history,
      expanded: prev.expanded,
    }));
  }, []);

  const back = React.useCallback(() => {
    setState((prev) => {
      const previous = prev.history[prev.history.length - 1];
      if (!previous) return prev;
      return { ...prev, request: previous, history: prev.history.slice(0, -1) };
    });
  }, []);

  const close = React.useCallback(() => {
    setState((prev) => ({ ...prev, open: false, expanded: false }));
  }, []);

  const toggleExpanded = React.useCallback(() => {
    setState((prev) => ({ ...prev, expanded: !prev.expanded }));
  }, []);

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({ open, push, close, isOpen: state.open, current: state.request }),
    [open, push, close, state.open, state.request],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      <WorkspacePanel
        state={state}
        onClose={close}
        onBack={state.history.length > 0 ? back : null}
        onToggleExpanded={toggleExpanded}
        onNavigate={push}
      />
    </WorkspaceContext.Provider>
  );
}

function WorkspacePanel({
  state,
  onClose,
  onBack,
  onToggleExpanded,
  onNavigate,
}: {
  state: WorkspaceState;
  onClose: () => void;
  onBack: (() => void) | null;
  onToggleExpanded: () => void;
  onNavigate: (request: WorkspaceRequest) => void;
}) {
  const isMobile = useIsMobile();
  const [, navigate] = useLocation();
  const { open, request, expanded } = state;

  // Modal only where it really is modal.
  const modal = open && isMobile;
  useBodyScrollLock(modal);
  const panelRef = useFocusTrap<HTMLDivElement>({ active: modal, onEscape: onClose });

  /*
   * Tells the rest of the app that the panel is docked.
   *
   * The in-app PDF reader is a centred dialog; with the panel open it needs to
   * step aside so the document stays visible beside the summary rather than
   * behind it. One attribute on <html> is enough — see the `sf-pdf-dialog`
   * rule in index.css — and it means the reader has no knowledge of the
   * workspace at all.
   */
  React.useEffect(() => {
    const root = document.documentElement;
    if (open && !isMobile) root.dataset.workspace = expanded ? "wide" : "open";
    else delete root.dataset.workspace;
    return () => {
      delete root.dataset.workspace;
    };
  }, [open, isMobile, expanded]);

  // Escape closes the desktop panel too — it just isn't trapping focus.
  React.useEffect(() => {
    if (!open || modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, modal, onClose]);

  const scope: ResolvedScope | null = React.useMemo(() => {
    if (!request) return null;
    return resolveScope({
      board: "CBSE",
      classLevel: request.scope.classLevel,
      subjectId: request.scope.subjectId,
      chapterId: request.scope.chapterId,
      topic: request.scope.topic ?? null,
    });
  }, [request]);

  if (!open || !request || !scope) return null;

  const spec = KIND_SPECS[request.kind];
  const Icon = spec.icon;
  const heading = request.title ?? spec.label;
  const subjectName =
    scope.subject?.name ?? SUBJECTS.find((s) => s.id === request.scope.subjectId)?.name ?? "";
  const contextLine = [subjectName, scope.chapter?.title, request.scope.topic]
    .filter(Boolean)
    .join(" · ");

  function openFullPage() {
    if (!spec.route || !scope) return;
    onClose();
    const search = scopeToSearch(scope);
    const extra = new URLSearchParams(spec.params ?? {}).toString();
    const query = [search.replace(/^\?/, ""), extra].filter(Boolean).join("&");
    navigate(query ? `${spec.route}?${query}` : spec.route);
  }

  const body = (
    <>
      <header
        className={cn(
          "sticky top-0 z-10 flex items-start gap-2 border-b border-card-border bg-card/95 px-4 py-3 backdrop-blur",
          "supports-[backdrop-filter]:bg-card/85",
        )}
      >
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back to the previous panel"
            className="h-8 w-8 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="study-workspace-title" className="truncate text-sm font-bold">
            {heading}
          </h2>
          {contextLine && (
            <p className="truncate text-xs text-muted-foreground">{contextLine}</p>
          )}
        </div>
        {spec.route && (
          <Button
            variant="ghost"
            size="icon"
            onClick={openFullPage}
            aria-label={`Open ${spec.label} as a full page`}
            title="Open as a full page"
            className="h-8 w-8 shrink-0"
          >
            <Expand className="h-4 w-4" />
          </Button>
        )}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleExpanded}
            aria-label={expanded ? "Dock the panel to the side" : "Widen the panel"}
            title={expanded ? "Dock to the side" : "Widen"}
            className="h-8 w-8 shrink-0"
          >
            {/* Two states of the same affordance, so the icon rotates rather
                than becoming a different symbol. */}
            <Expand className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close the study panel"
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <WorkspaceBody request={request} scope={scope} onNavigate={onNavigate} onClose={onClose} />
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50">
        <div
          className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="study-workspace-title"
          className="absolute inset-x-0 bottom-0 flex h-[88dvh] flex-col overflow-hidden rounded-t-2xl border-t border-card-border bg-card shadow-lg outline-none"
        >
          {/* A grab handle, because a sheet that appears from the bottom edge
              should look like one even though it isn't draggable. */}
          <div className="flex justify-center pt-2" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-muted-foreground/25" />
          </div>
          {body}
        </div>
      </div>
    );
  }

  return (
    <aside
      role="complementary"
      aria-labelledby="study-workspace-title"
      className={cn(
        "fixed right-0 z-40 flex flex-col overflow-hidden border-l border-card-border bg-card shadow-lg",
        "top-[var(--header-h)] bottom-0",
        expanded ? "w-[min(56rem,calc(100vw-4rem))]" : "w-[26rem]",
      )}
    >
      {body}
    </aside>
  );
}
