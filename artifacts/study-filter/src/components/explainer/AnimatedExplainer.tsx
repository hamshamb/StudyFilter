import React from "react";
import { useReducedMotion } from "framer-motion";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import type { SubjectId } from "@workspace/cbse-content";
import { Button } from "@/components/ui/button";
import { getAccent } from "../hub/accents";
import { getScene } from "./scenes";

const STEP_MS = 2600;

/**
 * Reusable, original explanatory animation for a subject. Plays a short looping
 * sequence with play/pause and step controls, and falls back to a fully static
 * presentation when the user prefers reduced motion.
 */
export function AnimatedExplainer({
  subjectId,
  chapterTitle,
  accent: accentToken,
}: {
  subjectId: SubjectId;
  /** When provided, selects a chapter-specific scene if one exists. */
  chapterTitle?: string;
  /** Accent token (e.g. "emerald"); defaults to the subject's own accent. */
  accent?: string;
}) {
  const scene = getScene(subjectId, chapterTitle);
  const accent = getAccent(accentToken);
  const reduced = useReducedMotion() ?? false;
  const total = scene.steps.length;

  const [step, setStep] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);

  React.useEffect(() => {
    if (reduced || !playing) return;
    const id = window.setInterval(
      () => setStep((s) => (s + 1) % total),
      STEP_MS,
    );
    return () => window.clearInterval(id);
  }, [reduced, playing, total]);

  const goTo = (next: number) => {
    setPlaying(false);
    setStep(((next % total) + total) % total);
  };
  const { Visual } = scene;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold leading-tight">
          {scene.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{scene.blurb}</p>
      </div>

      <div
        className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 ${accent.border} ${accent.gradient}`}
      >
        <div className="flex h-56 items-center justify-center sm:h-64">
          <Visual step={step} reduced={reduced} accent={accent} />
        </div>
      </div>

      {reduced ? (
        <div
          className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground"
          role="note"
        >
          <Eye className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Motion is reduced based on your system settings, so the full
            sequence is shown at once. The steps below explain it in order.
          </span>
        </div>
      ) : (
        <>
          <div
            className="min-h-[2.5rem] rounded-xl border bg-card p-3 text-sm font-medium leading-snug"
            aria-live="polite"
          >
            <span
              className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${accent.solid}`}
            >
              {step + 1}
            </span>
            {scene.steps[step]}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => goTo(step - 1)}
                aria-label="Previous step"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => goTo(step + 1)}
                aria-label="Next step"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              {scene.steps.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => goTo(idx)}
                  aria-label={`Go to step ${idx + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    idx === step ? `w-6 ${accent.solid}` : "w-2 bg-muted"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => {
                  setStep(0);
                  setPlaying(true);
                }}
                aria-label="Replay from start"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pause animation" : "Play animation"}
              >
                {playing ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      <ol className="space-y-1.5 rounded-xl border bg-muted/30 p-4 text-sm">
        {scene.steps.map((s, idx) => (
          <li key={idx} className="flex gap-2.5">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                !reduced && idx === step
                  ? accent.solid
                  : `${accent.soft} ${accent.text}`
              }`}
            >
              {idx + 1}
            </span>
            <span className="leading-snug text-muted-foreground">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
