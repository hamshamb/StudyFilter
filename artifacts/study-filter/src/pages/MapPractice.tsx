import React from "react";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useXpEvent } from "@/hooks/use-xp-event";
import {
  INDIA_STATES,
  MAP_HEIGHT,
  MAP_WIDTH,
  project,
  statePath,
  unproject,
} from "@/lib/map/geo";
import {
  CATEGORY_LABELS,
  MAP_QUESTIONS,
  type MapCategory,
  type MapQuestion,
} from "@/lib/map/questions";
import { gradeMapAnswer, type MapResult } from "@/lib/map/grade";
import {
  Check,
  MapPin,
  RotateCcw,
  Target,
  TriangleAlert,
  X,
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/layout/PageShell";
import { Chip } from "@/components/ui/primitives";

const ROUND_SIZE = 8;

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Precomputed once — 785 rings is too many to re-project on every render. */
const STATE_PATHS = INDIA_STATES.map((s) => ({
  name: s.name,
  d: statePath(s),
}));

type Phase = "setup" | "playing" | "done";

export default function MapPractice() {
  const recordXp = useXpEvent();

  const [phase, setPhase] = React.useState<Phase>("setup");
  const [category, setCategory] = React.useState<MapCategory | "all">("all");
  const [questions, setQuestions] = React.useState<MapQuestion[]>([]);
  const [index, setIndex] = React.useState(0);
  const [click, setClick] = React.useState<{ lng: number; lat: number } | null>(null);
  const [result, setResult] = React.useState<MapResult | null>(null);
  const [score, setScore] = React.useState(0);
  const reported = React.useRef(false);

  const svgRef = React.useRef<SVGSVGElement>(null);
  const current = questions[index];

  function start() {
    const pool =
      category === "all"
        ? MAP_QUESTIONS
        : MAP_QUESTIONS.filter((q) => q.category === category);
    setQuestions(shuffle(pool).slice(0, ROUND_SIZE));
    setIndex(0);
    setClick(null);
    setResult(null);
    setScore(0);
    reported.current = false;
    setPhase("playing");
  }

  /**
   * Converts a pointer event to lng/lat.
   *
   * Uses getBoundingClientRect rather than the event's offsetX/offsetY: the SVG
   * is scaled to its container, so offsets are in rendered pixels while the
   * projection works in viewBox units.
   */
  function handleMapClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!current || result) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * MAP_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * MAP_HEIGHT;
    const coords = unproject(x, y);
    setClick(coords);
    const graded = gradeMapAnswer(current, coords);
    setResult(graded);
    if (graded.verdict === "correct") setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 >= questions.length) {
      setPhase("done");
      if (!reported.current) {
        reported.current = true;
        void recordXp({
          type: "quiz_completed",
          source: "practice",
          subject: "Social Science",
          chapter: "Map work",
          totalQuestions: questions.length,
          correctAnswers: score,
        });
      }
      return;
    }
    setIndex((i) => i + 1);
    setClick(null);
    setResult(null);
  }

  // Highlight the answer's state once graded, so a wrong guess still teaches.
  const revealState = result && current ? current.state : null;
  const targetXY =
    result && current?.kind === "point" && current.lng !== undefined && current.lat !== undefined
      ? project(current.lng, current.lat)
      : null;
  const clickXY = click ? project(click.lng, click.lat) : null;

  return (
    <>
      <SeoHead
        title="Map Practice — CBSE Social Science | StudyFilter"
        description="Practise CBSE Class 10 Social Science map work. Locate states, dams, ports, industries and sites of the national movement on an interactive map of India."
        canonical="/map-practice"
      />
      <PageShell>
        <PageHeader
          icon={MapPin}
          title="Map practice"
          description="CBSE Social Science map work — click the map to mark your answer."
        />

        {phase === "setup" && (
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-semibold">Choose what to practise</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {ROUND_SIZE} questions per round. You&rsquo;re marked on being roughly
              right — a reasonable estimate counts, the wrong state doesn&rsquo;t.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Chip
                active={category === "all"}
                onClick={() => setCategory("all")}
                count={MAP_QUESTIONS.length}
              >
                Everything
              </Chip>
              {(Object.keys(CATEGORY_LABELS) as MapCategory[]).map((c) => (
                <Chip
                  key={c}
                  active={category === c}
                  onClick={() => setCategory(c)}
                  count={MAP_QUESTIONS.filter((q) => q.category === c).length}
                >
                  {CATEGORY_LABELS[c]}
                </Chip>
              ))}
            </div>

            <Button className="mt-5" onClick={start}>
              Start round
            </Button>
          </div>
        )}

        {phase === "playing" && current && (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="overflow-hidden rounded-xl border bg-card">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                onClick={handleMapClick}
                role="application"
                aria-label="Map of India — click to place your answer"
                className={cn(
                  "w-full touch-manipulation select-none",
                  result ? "cursor-default" : "cursor-crosshair",
                )}
              >
                {STATE_PATHS.map((s) => {
                  const isAnswer = revealState === s.name;
                  return (
                    <path
                      key={s.name}
                      d={s.d}
                      className={cn(
                        "transition-colors",
                        isAnswer
                          ? "fill-primary/35 stroke-primary"
                          : "fill-muted stroke-border hover:fill-muted-foreground/20",
                      )}
                      // A hairline stroke in the fill colour closes the sub-pixel
                      // gaps left between adjacent simplified district rings.
                      strokeWidth={isAnswer ? 1.2 : 0.6}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}

                {targetXY && (
                  <g>
                    <circle
                      cx={targetXY.x}
                      cy={targetXY.y}
                      r={9}
                      className="fill-success stroke-success"
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle cx={targetXY.x} cy={targetXY.y} r={3} className="fill-success" />
                  </g>
                )}

                {clickXY && (
                  <g>
                    <line
                      x1={clickXY.x - 7} y1={clickXY.y} x2={clickXY.x + 7} y2={clickXY.y}
                      className={result?.verdict === "correct" ? "stroke-success" : "stroke-destructive"}
                      strokeWidth={2} vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={clickXY.x} y1={clickXY.y - 7} x2={clickXY.x} y2={clickXY.y + 7}
                      className={result?.verdict === "correct" ? "stroke-success" : "stroke-destructive"}
                      strokeWidth={2} vectorEffect="non-scaling-stroke"
                    />
                  </g>
                )}
              </svg>
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Question {index + 1} of {questions.length}
                  </span>
                  <span className="tabular-nums">{score} correct</span>
                </div>
                <p className="mt-2 flex items-start gap-2 text-sm font-semibold">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {current.kind === "state" ? "Click on " : "Mark "}
                  {current.prompt}
                </p>
                {current.kind === "point" && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Within about {current.toleranceKm ?? 120} km counts as correct.
                  </p>
                )}
              </div>

              {result && (
                <div
                  className={cn(
                    "rounded-xl border p-4",
                    result.verdict === "correct" &&
                      "border-success/30 bg-success-soft",
                    result.verdict === "close" &&
                      "border-warning/30 bg-warning-soft",
                    result.verdict === "wrong" &&
                      "border-destructive/30 bg-destructive-soft",
                  )}
                >
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {result.verdict === "correct" ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : result.verdict === "close" ? (
                      <TriangleAlert className="h-4 w-4 text-warning" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                    {result.message}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {current.fact}
                  </p>
                  <Button size="sm" className="mt-3 w-full" onClick={next}>
                    {index + 1 >= questions.length ? "See results" : "Next question"}
                  </Button>
                </div>
              )}

              {!result && (
                <p className="px-1 text-xs text-muted-foreground">
                  Click anywhere on the map to place your marker.
                </p>
              )}
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="rounded-xl border bg-card p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mt-4 text-2xl font-bold">
              {score} of {questions.length} correct
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {score === questions.length
                ? "Every one placed correctly."
                : score >= questions.length / 2
                  ? "Solid — revise the ones you missed and go again."
                  : "Worth another round; the facts stick faster the second time."}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button onClick={start}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Practise again
              </Button>
              <Button variant="outline" onClick={() => setPhase("setup")}>
                Change topic
              </Button>
            </div>
          </div>
        )}
      </PageShell>
    </>
  );
}
