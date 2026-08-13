import React from "react";
import { useLocation } from "wouter";
import { ArrowUp, Sparkles, Calculator, ListChecks, NotebookPen, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { readStickyScope } from "@/hooks/use-study-scope";

/**
 * The Study Command Bar.
 *
 * The way into the product. Not a chat composer — there is no thread, no
 * bubbles, no "assistant is typing". You state what you need and a study
 * answer comes back, the way you'd write a question in the margin of a
 * textbook.
 *
 * **What changed in this pass.** The five modes used to be prefixes: picking
 * "Quiz me" glued the words `Quiz me on:` to the front of the question and
 * sent it to the same answer endpoint as everything else, so all five buttons
 * landed on one generic screen wearing different labels. A student who wanted
 * a quiz got a paragraph *about* a quiz.
 *
 * Each mode is now a route to its own feature, and each carries the chapter
 * the student is currently in, so "Quiz me" from inside Electricity opens the
 * quiz builder with Electricity already chosen. Only "Ask" — no mode selected
 * — still goes to the general answer engine, which is the one case where a
 * general answer is what was asked for.
 */

export type StudyMode = "explain" | "solve" | "quiz" | "revise" | "important";

interface ModeSpec {
  id: StudyMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** The feature this mode opens. */
  route: string;
  /**
   * How the typed text reaches that feature. Explain and Solve take the words
   * themselves; Quiz, Revise and Important Questions are driven by the scope,
   * so free text becomes the topic to narrow to.
   */
  param: "topic" | "q" | null;
  placeholder: string;
  /** Modes that work with nothing typed, because the chapter is enough. */
  allowsEmpty: boolean;
  /**
   * Extra query parameters the destination needs to open on the right thing.
   *
   * Without this, "Important questions" landed on /revise and showed the
   * chapter summary — the right page, the wrong panel, which is the same
   * broken promise as the old prompt prefixes wearing a smarter disguise.
   */
  extra?: Record<string, string>;
}

const MODES: ModeSpec[] = [
  {
    id: "explain",
    label: "Explain",
    icon: Sparkles,
    route: "/explain",
    param: "topic",
    placeholder: "Which idea should I explain?",
    allowsEmpty: false,
  },
  {
    id: "solve",
    label: "Solve",
    icon: Calculator,
    route: "/solve",
    param: "q",
    placeholder: "Paste the question to solve…",
    allowsEmpty: false,
  },
  {
    id: "quiz",
    label: "Quiz me",
    icon: ListChecks,
    route: "/quiz",
    param: "topic",
    placeholder: "A topic to focus on — or leave blank for the whole chapter",
    allowsEmpty: true,
  },
  {
    id: "revise",
    label: "Revise",
    icon: NotebookPen,
    route: "/revise",
    param: "topic",
    placeholder: "Leave blank to revise the whole chapter",
    allowsEmpty: true,
  },
  {
    id: "important",
    label: "Important questions",
    icon: Target,
    route: "/revise",
    param: null,
    placeholder: "Leave blank for this chapter's board questions",
    allowsEmpty: true,
    extra: { format: "important" },
  },
];

const DEFAULT_PLACEHOLDER = "Ask anything from your CBSE syllabus…";

export interface StudyCommandBarProps {
  /** `lg` on the dashboard, `md` when it sits inside a page. */
  size?: "lg" | "md";
  autoFocus?: boolean;
  className?: string;
  /** Override where a submitted question goes. Defaults to the Ask page. */
  onSubmit?: (question: string, mode: StudyMode | null) => void;
  /** Seeds the box — e.g. a chapter name on a chapter page. */
  defaultValue?: string;
  /** Turns off the "/" global focus shortcut where two bars share a screen. */
  enableShortcut?: boolean;
}

export function StudyCommandBar({
  size = "lg",
  autoFocus = false,
  className,
  onSubmit,
  defaultValue = "",
  enableShortcut = true,
}: StudyCommandBarProps) {
  const [, setLocation] = useLocation();
  const [value, setValue] = React.useState(defaultValue);
  const [mode, setMode] = React.useState<StudyMode | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const activeMode = MODES.find((m) => m.id === mode) ?? null;

  /*
   * "/" focuses the bar from anywhere on the page, the way search boxes work
   * in tools students already use. Guarded so it never steals a keystroke
   * from someone mid-sentence in another field.
   */
  React.useEffect(() => {
    if (!enableShortcut) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      ref.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enableShortcut]);

  // Grows with the question instead of scrolling a two-line box.
  const resize = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  React.useEffect(resize, [value, resize]);

  function submit() {
    const trimmed = value.trim();

    // Only the modes that genuinely need words demand them. "Revise", with a
    // chapter already in scope, is a complete instruction on its own.
    if (!trimmed && !activeMode?.allowsEmpty) {
      setError(
        activeMode
          ? "Add a topic, or clear the mode to ask a question instead."
          : "Add a few more words so the answer can be specific.",
      );
      ref.current?.focus();
      return;
    }
    if (trimmed && trimmed.length < 5 && !activeMode?.allowsEmpty) {
      setError("Add a few more words so the answer can be specific.");
      ref.current?.focus();
      return;
    }
    setError(null);

    if (onSubmit) {
      onSubmit(trimmed, mode);
      return;
    }

    // No mode: a plain question, which is what the answer engine is for.
    if (!activeMode) {
      setLocation(`/chat?q=${encodeURIComponent(trimmed)}`);
      return;
    }

    /*
     * Every mode carries the chapter the student is already in. This is the
     * whole reason the scope exists — nobody should have to type "class 10
     * cbse science electricity" into a box that is sitting on the Electricity
     * page.
     */
    const scope = readStickyScope();
    const params = new URLSearchParams();
    if (scope.subjectId) params.set("subject", scope.subjectId);
    if (scope.chapterId) params.set("chapter", scope.chapterId);
    if (trimmed && activeMode.param) params.set(activeMode.param, trimmed);
    for (const [key, value] of Object.entries(activeMode.extra ?? {})) {
      params.set(key, value);
    }
    const query = params.toString();
    setLocation(query ? `${activeMode.route}?${query}` : activeMode.route);
  }

  const large = size === "lg";

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "group relative rounded-xl border bg-card transition-colors duration-150",
          "border-border shadow-xs",
          "focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15",
          error && "border-destructive/60",
        )}
      >
        <label htmlFor="study-command-bar" className="sr-only">
          Ask a study question
        </label>
        <textarea
          id="study-command-bar"
          ref={ref}
          rows={1}
          autoFocus={autoFocus}
          value={value}
          placeholder={activeMode?.placeholder ?? DEFAULT_PLACEHOLDER}
          aria-describedby={error ? "study-command-bar-error" : undefined}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") {
              if (value) {
                setValue("");
              } else {
                ref.current?.blur();
              }
            }
          }}
          className={cn(
            "w-full resize-none bg-transparent pr-14 text-foreground outline-none",
            "placeholder:text-muted-foreground/80",
            large
              ? "min-h-[3.25rem] px-4 py-4 text-base sm:text-[1.0625rem]"
              : "min-h-[2.75rem] px-3.5 py-3 text-sm sm:text-base",
          )}
        />

        <button
          type="button"
          onClick={submit}
          aria-label="Ask StudyFilter"
          className={cn(
            "absolute right-2 flex items-center justify-center rounded-lg transition-colors duration-150",
            "bg-primary text-primary-foreground hover-elevate active-elevate-2",
            "disabled:opacity-40",
            large ? "bottom-2 h-9 w-9" : "bottom-1.5 h-8 w-8",
          )}
        >
          <ArrowUp className={large ? "h-4.5 w-4.5" : "h-4 w-4"} />
        </button>
      </div>

      {error && (
        <p id="study-command-bar-error" className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Modes. A rail on phones so five of them never wrap into a wall. */}
      <div className="mt-3 flex items-center gap-2">
        <div className="rail min-w-0 flex-1 py-0.5" role="group" aria-label="How should we answer?">
          {MODES.map(({ id, label, icon: Icon }) => {
            const on = mode === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setMode(on ? null : id);
                  ref.current?.focus();
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                  on
                    ? "border-primary/35 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
        {enableShortcut && (
          <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground lg:flex">
            <Kbd>/</Kbd> to focus
          </span>
        )}
      </div>
    </div>
  );
}
