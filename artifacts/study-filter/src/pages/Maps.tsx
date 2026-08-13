import React from "react";
import {
  Check,
  Eye,
  EyeOff,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Target,
  TriangleAlert,
  X,
} from "lucide-react";
import { PageShell, PageHeader, Panel, EmptyState } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Chip, ProgressBar } from "@/components/ui/primitives";
import { SeoHead } from "@/components/SeoHead";
import { useXpEvent } from "@/hooks/use-xp-event";
import { useRecordRecent } from "@/hooks/use-recents";
import { recordMasteryAttempt, useMastery } from "@/hooks/use-mastery";
import { masteryKey, MASTERY_INFO } from "@/lib/mastery";
import {
  INDIA_STATES,
  MAP_HEIGHT,
  MAP_WIDTH,
  project,
  statePath,
  unproject,
} from "@/lib/map/geo";
import { gradeMapAnswer, type MapResult } from "@/lib/map/grade";
import type { MapQuestion } from "@/lib/map/questions";
import {
  ATLAS_POINTS,
  ATLAS_RIVERS,
  ATLAS_THEMES,
  LAYERS,
  practiceItems,
  type AtlasPoint,
  type LayerId,
} from "@/lib/map/atlas";
import { cn } from "@/lib/utils";

/**
 * Map learning.
 *
 * The old page had one mode: eight random questions, click the map, score.
 * That tests recall a student may never have built — there was nowhere to
 * *learn* the map first. Three modes now, in the order they are useful:
 *
 *  - **Learn** — labels on, facts on tap, reveal one at a time.
 *  - **Practice** — choose the layers and the length, then be graded.
 *  - **Explore** — no questions at all; pan, zoom, switch layers, read.
 *
 * All three draw the same atlas over the same boundary data, so a place seen
 * in Learn is the place asked for in Practice.
 */

type Mode = "learn" | "practice" | "explore";

const STATE_PATHS = INDIA_STATES.map((s) => ({ name: s.name, d: statePath(s) }));

export default function Maps() {
  const [mode, setMode] = React.useState<Mode>(() =>
    window.location.pathname === "/map-practice" ? "practice" : "learn",
  );

  useRecordRecent({
    kind: "map",
    title: "Map work",
    subtitle: "Social Science",
    href: "/maps",
  });

  return (
    <>
      <SeoHead
        title="Map Learning — CBSE Social Science | StudyFilter"
        description="Learn the CBSE Class 10 map: rivers, dams, ports, industries, minerals, national parks, soils and crops. Study the map first, then practise locating places on it."
        canonical="/maps"
      />
      <PageShell>
        <PageHeader
          icon={MapPin}
          title="Map work"
          eyebrow="Social Science"
          description="Study the map before you are tested on it — then practise, and see which places still need work."
        />

        <div className="rail mb-5 py-0.5" role="tablist" aria-label="Map mode">
          {(
            [
              ["learn", "Learn"],
              ["practice", "Practice"],
              ["explore", "Explore"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                mode === id
                  ? "border-primary/35 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              data-testid={`tab-map-${id}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {mode === "learn" && <LearnMap />}
          {mode === "practice" && <PracticeMap />}
          {mode === "explore" && <ExploreMap />}
        </div>
      </PageShell>
    </>
  );
}

// ── Shared map canvas ────────────────────────────────────────────────────

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL_VIEW: ViewBox = { x: 0, y: 0, w: MAP_WIDTH, h: MAP_HEIGHT };

/**
 * The base map, with pan and zoom.
 *
 * Zoom is a viewBox change rather than a CSS transform, so the boundary
 * strokes stay hairline-thin at every zoom level and labels keep their size —
 * a scaled-up map with 4px borders and giant text is unreadable.
 */
function MapCanvas({
  view,
  onViewChange,
  highlightStates,
  onStateClick,
  children,
  ariaLabel,
  onMapClick,
  crosshair,
}: {
  view: ViewBox;
  onViewChange?: (v: ViewBox) => void;
  highlightStates?: Map<string, string>;
  onStateClick?: (name: string) => void;
  children?: React.ReactNode;
  ariaLabel: string;
  onMapClick?: (coords: { lng: number; lat: number }) => void;
  crosshair?: boolean;
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const drag = React.useRef<{ x: number; y: number; view: ViewBox } | null>(null);

  function toCoords(e: React.PointerEvent | React.MouseEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = view.x + ((e.clientX - rect.left) / rect.width) * view.w;
    const y = view.y + ((e.clientY - rect.top) / rect.height) * view.h;
    return unproject(x, y);
  }

  function zoom(factor: number) {
    if (!onViewChange) return;
    const w = Math.min(MAP_WIDTH, Math.max(MAP_WIDTH / 8, view.w * factor));
    const h = w * (MAP_HEIGHT / MAP_WIDTH);
    // Zoom about the centre so the place being looked at stays put.
    const cx = view.x + view.w / 2;
    const cy = view.y + view.h / 2;
    onViewChange({
      x: Math.max(0, Math.min(MAP_WIDTH - w, cx - w / 2)),
      y: Math.max(0, Math.min(MAP_HEIGHT - h, cy - h / 2)),
      w,
      h,
    });
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-card-border bg-card">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        role={onMapClick ? "application" : "img"}
        aria-label={ariaLabel}
        className={cn(
          "w-full touch-none select-none",
          crosshair ? "cursor-crosshair" : onViewChange ? "cursor-grab active:cursor-grabbing" : "",
        )}
        onClick={(e) => {
          if (!onMapClick) return;
          const coords = toCoords(e);
          if (coords) onMapClick(coords);
        }}
        onPointerDown={(e) => {
          if (!onViewChange || crosshair) return;
          drag.current = { x: e.clientX, y: e.clientY, view };
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current || !onViewChange) return;
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;
          const dx = ((e.clientX - drag.current.x) / rect.width) * drag.current.view.w;
          const dy = ((e.clientY - drag.current.y) / rect.height) * drag.current.view.h;
          onViewChange({
            ...drag.current.view,
            x: Math.max(0, Math.min(MAP_WIDTH - drag.current.view.w, drag.current.view.x - dx)),
            y: Math.max(0, Math.min(MAP_HEIGHT - drag.current.view.h, drag.current.view.y - dy)),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {STATE_PATHS.map((s) => {
          const fill = highlightStates?.get(s.name);
          return (
            <path
              key={s.name}
              d={s.d}
              onClick={onStateClick ? () => onStateClick(s.name) : undefined}
              className={cn(
                "transition-colors",
                fill ? "" : "fill-muted stroke-border",
                onStateClick && "cursor-pointer hover:fill-muted-foreground/20",
              )}
              style={fill ? { fill, stroke: "hsl(var(--border))" } : undefined}
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {children}
      </svg>

      {onViewChange && (
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8 bg-card" onClick={() => zoom(0.7)} aria-label="Zoom in">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-card" onClick={() => zoom(1.4)} aria-label="Zoom out">
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-card"
            onClick={() => onViewChange(FULL_VIEW)}
            aria-label="Reset the view"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function PointMarks({
  points,
  showLabels,
  onSelect,
  selectedId,
}: {
  points: AtlasPoint[];
  showLabels: boolean;
  onSelect?: (p: AtlasPoint) => void;
  selectedId?: string | null;
}) {
  return (
    <>
      {points.map((p) => {
        const { x, y } = project(p.lng, p.lat);
        const active = selectedId === p.id;
        return (
          <g
            key={p.id}
            onClick={onSelect ? () => onSelect(p) : undefined}
            className={onSelect ? "cursor-pointer" : undefined}
          >
            <circle
              cx={x}
              cy={y}
              r={active ? 6 : 4}
              className={active ? "fill-primary stroke-background" : "fill-primary/80 stroke-background"}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            {showLabels && (
              <text
                x={x + 7}
                y={y + 3}
                className="pointer-events-none fill-foreground"
                fontSize={9}
                style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: 3 }}
              >
                {p.name}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

function RiverLines({ showLabels }: { showLabels: boolean }) {
  return (
    <>
      {ATLAS_RIVERS.map((river) => {
        const pts = river.anchors.map((a) => project(a.lng, a.lat));
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
        const mid = pts[Math.floor(pts.length / 2)]!;
        return (
          <g key={river.id}>
            <path
              d={d}
              fill="none"
              className="stroke-[hsl(207_78%_50%)]"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {river.anchors.map((a, i) => {
              const p = pts[i]!;
              return <circle key={a.name} cx={p.x} cy={p.y} r={2} className="fill-[hsl(207_78%_40%)]" />;
            })}
            {showLabels && (
              <text
                x={mid.x + 5}
                y={mid.y - 4}
                className="pointer-events-none fill-[hsl(207_78%_35%)] dark:fill-[hsl(207_80%_70%)]"
                fontSize={10}
                fontWeight={600}
                style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: 3 }}
              >
                {river.name}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

// ── Learn ────────────────────────────────────────────────────────────────

function LearnMap() {
  const [layer, setLayer] = React.useState<LayerId>("rivers");
  const [showLabels, setShowLabels] = React.useState(true);
  const [revealCount, setRevealCount] = React.useState<number | null>(null);
  const [selected, setSelected] = React.useState<AtlasPoint | null>(null);
  const [selectedTheme, setSelectedTheme] = React.useState<string | null>(null);
  const [view, setView] = React.useState<ViewBox>(FULL_VIEW);
  const [query, setQuery] = React.useState("");

  const info = LAYERS.find((l) => l.id === layer)!;

  const points = React.useMemo(() => {
    const all = ATLAS_POINTS.filter((p) => p.layer === layer);
    const q = query.trim().toLowerCase();
    const filtered = q ? all.filter((p) => p.name.toLowerCase().includes(q)) : all;
    return revealCount === null ? filtered : filtered.slice(0, revealCount);
  }, [layer, query, revealCount]);

  const themes = ATLAS_THEMES.filter((t) => t.layer === layer);
  const activeTheme = themes.find((t) => t.id === selectedTheme) ?? themes[0];

  const highlight = React.useMemo(() => {
    if (info.kind !== "theme" || !activeTheme) return undefined;
    const map = new Map<string, string>();
    for (const state of activeTheme.states) map.set(state, "hsl(var(--primary) / 0.35)");
    return map;
  }, [info.kind, activeTheme]);

  return (
    <div className="space-y-4">
      <div className="rail py-0.5" role="group" aria-label="Map layer">
        {LAYERS.map((l) => (
          <Chip
            key={l.id}
            active={layer === l.id}
            onClick={() => {
              setLayer(l.id);
              setSelected(null);
              setRevealCount(null);
              setSelectedTheme(null);
            }}
          >
            {l.label}
          </Chip>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        From <span className="font-medium text-foreground">{info.chapter}</span>
      </p>

      {info.kind === "point" && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[10rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a place"
              aria-label="Search this layer"
              className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowLabels((s) => !s)}>
            {showLabels ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showLabels ? "Hide labels" : "Show labels"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevealCount((c) => (c === null ? 1 : c + 1))}
          >
            Reveal one by one
          </Button>
          {revealCount !== null && (
            <Button variant="ghost" size="sm" onClick={() => setRevealCount(null)}>
              Show all
            </Button>
          )}
        </div>
      )}

      {info.kind === "theme" && (
        <div className="rail py-0.5">
          {themes.map((t) => (
            <Chip key={t.id} active={activeTheme?.id === t.id} onClick={() => setSelectedTheme(t.id)}>
              {t.name}
            </Chip>
          ))}
        </div>
      )}

      <MapCanvas
        view={view}
        onViewChange={setView}
        highlightStates={highlight}
        ariaLabel={`Map of India showing ${info.label}`}
      >
        {info.kind === "river" && <RiverLines showLabels={showLabels} />}
        {info.kind === "point" && (
          <PointMarks
            points={points}
            showLabels={showLabels}
            onSelect={setSelected}
            selectedId={selected?.id}
          />
        )}
      </MapCanvas>

      {info.kind === "theme" && activeTheme && (
        <Panel title={activeTheme.name}>
          <p className="text-sm leading-relaxed text-foreground/90">{activeTheme.fact}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Shaded states: {activeTheme.states.join(", ")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Shown by shading whole states, which is how the textbook lists them — not as drawn
            regions, because the real boundaries are gradual.
          </p>
        </Panel>
      )}

      {info.kind === "river" && (
        <div className="space-y-2">
          {ATLAS_RIVERS.map((river) => (
            <Panel key={river.id} title={river.name}>
              <p className="text-sm leading-relaxed text-foreground/90">{river.fact}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Passes: {river.anchors.map((a) => a.name).join(" → ")}
              </p>
            </Panel>
          ))}
          <p className="px-1 text-xs text-muted-foreground">
            Courses are drawn by joining the places each river is known to pass, in order — they
            are schematic, not surveyed channels.
          </p>
        </div>
      )}

      {info.kind === "point" && selected && (
        <Panel
          title={selected.name}
          actions={
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          }
        >
          <p className="text-sm leading-relaxed text-foreground/90">{selected.fact}</p>
          <p className="mt-2 text-xs text-muted-foreground">{selected.state}</p>
        </Panel>
      )}

      {info.kind === "point" && !selected && points.length > 0 && (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {points.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelected(p)}
                className="flex w-full items-start gap-2 rounded-lg border border-card-border bg-card p-2.5 text-left text-sm transition-colors hover:bg-muted/40"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-medium">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.state}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Practice ─────────────────────────────────────────────────────────────

const ROUND_SIZES = [5, 10, 20] as const;

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function PracticeMap() {
  const recordXp = useXpEvent();
  const mastery = useMastery();

  const [phase, setPhase] = React.useState<"setup" | "playing" | "done">("setup");
  const [chosen, setChosen] = React.useState<Set<LayerId>>(new Set(["dams", "ports", "history"]));
  const [size, setSize] = React.useState<number>(10);
  const [weakOnly, setWeakOnly] = React.useState(false);

  const [questions, setQuestions] = React.useState<MapQuestion[]>([]);
  const [index, setIndex] = React.useState(0);
  const [click, setClick] = React.useState<{ lng: number; lat: number } | null>(null);
  const [result, setResult] = React.useState<MapResult | null>(null);
  const [score, setScore] = React.useState(0);
  const [view, setView] = React.useState<ViewBox>(FULL_VIEW);
  const reported = React.useRef(false);

  const current = questions[index];

  const pool = React.useMemo(() => {
    const items = practiceItems(chosen.size > 0 ? chosen : null);
    if (!weakOnly) return items;
    // "Practise weak locations" — anything not already Strong.
    return items.filter((q) => {
      const state = mastery.stateOf(masteryKey("map", q.id));
      return state !== "strong";
    });
  }, [chosen, weakOnly, mastery]);

  function start() {
    setQuestions(shuffle(pool).slice(0, size));
    setIndex(0);
    setClick(null);
    setResult(null);
    setScore(0);
    setView(FULL_VIEW);
    reported.current = false;
    setPhase("playing");
  }

  function handleClick(coords: { lng: number; lat: number }) {
    if (!current || result) return;
    setClick(coords);
    const graded = gradeMapAnswer(current, coords);
    setResult(graded);
    const correct = graded.verdict === "correct";
    if (correct) setScore((s) => s + 1);
    recordMasteryAttempt(
      { key: masteryKey("map", current.id), domain: "map", label: current.prompt },
      { correct: correct ? 1 : 0, total: 1 },
    );
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

  const tracked = mastery.all.filter((r) => r.domain === "map");

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <Panel title="What to practise" icon={Target}>
          <div className="space-y-4">
            <div>
              <p className="text-eyebrow mb-1.5 text-muted-foreground">Layers</p>
              <div className="flex flex-wrap gap-2">
                {LAYERS.filter((l) => l.kind !== "theme").map((l) => (
                  <Chip
                    key={l.id}
                    active={chosen.has(l.id)}
                    onClick={() =>
                      setChosen((prev) => {
                        const next = new Set(prev);
                        if (next.has(l.id)) next.delete(l.id);
                        else next.add(l.id);
                        return next;
                      })
                    }
                  >
                    {l.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="text-eyebrow mb-1.5 text-muted-foreground">How many</p>
              <div className="flex flex-wrap gap-2">
                {ROUND_SIZES.map((n) => (
                  <Chip key={n} active={size === n} onClick={() => setSize(n)}>
                    {n}
                  </Chip>
                ))}
              </div>
            </div>
            {tracked.length > 0 && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft/40 p-3">
                <input
                  type="checkbox"
                  checked={weakOnly}
                  onChange={(e) => setWeakOnly(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                />
                <span>
                  <span className="block text-sm font-medium">Only places I haven&rsquo;t mastered</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {pool.length} available with this setting
                  </span>
                </span>
              </label>
            )}
          </div>
          <Button className="mt-4 w-full" onClick={start} disabled={pool.length === 0}>
            Start — {Math.min(size, pool.length)} questions
          </Button>
          {pool.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Nothing to practise with these settings. Pick another layer.
            </p>
          )}
        </Panel>

        {tracked.length > 0 && <MapProgress />}
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-card-border bg-card p-6 text-center">
          <MapPin className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
          <h2 className="mt-3 text-2xl font-bold">
            {score} of {questions.length} correct
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {score === questions.length
              ? "Every one placed correctly."
              : "The ones you missed are now marked for revision below."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={start}>Practise again</Button>
            <Button variant="outline" onClick={() => setPhase("setup")}>
              Change layers
            </Button>
          </div>
        </div>
        <MapProgress />
      </div>
    );
  }

  if (!current) return null;

  const revealState = result ? current.state : null;
  const highlight = revealState
    ? new Map([[revealState, "hsl(var(--primary) / 0.35)"]])
    : undefined;
  const target =
    result && current.kind === "point" && current.lng !== undefined && current.lat !== undefined
      ? project(current.lng, current.lat)
      : null;
  const clickXY = click ? project(click.lng, click.lat) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <MapCanvas
        view={view}
        onViewChange={setView}
        highlightStates={highlight}
        onMapClick={handleClick}
        crosshair={!result}
        ariaLabel={`Map of India. ${current.prompt}. Click to place your answer.`}
      >
        {target && (
          <g>
            <circle cx={target.x} cy={target.y} r={8} className="fill-success/30 stroke-success" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            <circle cx={target.x} cy={target.y} r={3} className="fill-success" />
          </g>
        )}
        {clickXY && (
          <g
            className={result?.verdict === "correct" ? "stroke-success" : "stroke-destructive"}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          >
            <line x1={clickXY.x - 7} y1={clickXY.y} x2={clickXY.x + 7} y2={clickXY.y} />
            <line x1={clickXY.x} y1={clickXY.y - 7} x2={clickXY.x} y2={clickXY.y + 7} />
          </g>
        )}
      </MapCanvas>

      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-card-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Question {index + 1} of {questions.length}
            </span>
            <span className="tabular-nums">{score} correct</span>
          </div>
          <ProgressBar
            value={(index / questions.length) * 100}
            size="sm"
            className="mt-2"
            label={`${index} of ${questions.length} done`}
          />
          <p className="mt-3 flex items-start gap-2 text-sm font-semibold">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            {current.kind === "state" ? "Click on " : "Mark "}
            {current.prompt}
          </p>
          {current.kind === "point" && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Within about {current.toleranceKm ?? 120} km counts.
            </p>
          )}
        </div>

        {result && (
          <div
            className={cn(
              "rounded-xl border p-4",
              result.verdict === "correct" && "border-success/30 bg-success-soft",
              result.verdict === "close" && "border-warning/30 bg-warning-soft",
              result.verdict === "wrong" && "border-destructive/30 bg-destructive-soft",
            )}
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              {result.verdict === "correct" ? (
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
              ) : result.verdict === "close" ? (
                <TriangleAlert className="h-4 w-4 text-warning" aria-hidden="true" />
              ) : (
                <X className="h-4 w-4 text-destructive" aria-hidden="true" />
              )}
              {result.message}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{current.fact}</p>
            <Button size="sm" className="mt-3 w-full" onClick={next}>
              {index + 1 >= questions.length ? "See results" : "Next"}
            </Button>
          </div>
        )}

        {!result && (
          <p className="px-1 text-xs text-muted-foreground">
            Click anywhere on the map to place your marker. Drag to pan, and use + to zoom in first
            if you want to be precise.
          </p>
        )}
      </div>
    </div>
  );
}

/** Per-location mastery, grouped so "what still needs work" is one glance. */
function MapProgress() {
  const mastery = useMastery();
  const tracked = mastery.all.filter((r) => r.domain === "map");

  if (tracked.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No map progress yet"
        description="Practise a round and each place you attempt is tracked here."
      />
    );
  }

  const strong = tracked.filter((r) => mastery.stateOf(r.key) === "strong").length;

  return (
    <Panel title="Your map progress" description={`${strong} of ${tracked.length} places mastered.`}>
      <ProgressBar
        value={(strong / tracked.length) * 100}
        tone={strong === tracked.length ? "success" : "primary"}
        label={`${strong} of ${tracked.length} mastered`}
        className="mb-3"
      />
      <ul className="flex flex-wrap gap-1.5">
        {tracked
          .slice()
          .sort((a, b) => a.recent - b.recent)
          .slice(0, 30)
          .map((record) => {
            const state = mastery.stateOf(record.key);
            return (
              <li
                key={record.key}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  MASTERY_INFO[state].className,
                )}
                title={`${MASTERY_INFO[state].label} — ${record.attempts} attempt(s)`}
              >
                {record.label.length > 34 ? `${record.label.slice(0, 34)}…` : record.label}
              </li>
            );
          })}
      </ul>
    </Panel>
  );
}

// ── Explore ──────────────────────────────────────────────────────────────

function ExploreMap() {
  const [active, setActive] = React.useState<Set<LayerId>>(new Set(["rivers", "dams"]));
  const [view, setView] = React.useState<ViewBox>(FULL_VIEW);
  const [selected, setSelected] = React.useState<AtlasPoint | null>(null);
  const [showLabels, setShowLabels] = React.useState(false);

  // `practiceItems` merges the newer atlas with the original CBSE map-work
  // dataset. Reading ATLAS_POINTS directly made Dams, Ports and National
  // Movement appear selected while showing zero markers.
  const points = React.useMemo<AtlasPoint[]>(
    () =>
      practiceItems(active)
        .filter(
          (item) =>
            item.kind === "point" &&
            typeof item.lng === "number" &&
            typeof item.lat === "number",
        )
        .map((item) => ({
          id: item.id,
          layer:
            item.category === "history"
              ? "history"
              : item.category === "transport"
                ? "ports"
                : item.category === "industry"
                  ? "industry"
                  : "dams",
          name: item.prompt,
          lng: item.lng!,
          lat: item.lat!,
          state: item.state,
          fact: item.fact,
        })),
    [active],
  );
  const shownCount = points.length + (active.has("rivers") ? ATLAS_RIVERS.length : 0);

  return (
    <div className="space-y-4">
      <div className="rail py-0.5" role="group" aria-label="Layers to show">
        {LAYERS.filter((l) => l.kind !== "theme" && l.kind !== "state").map((l) => (
          <Chip
            key={l.id}
            active={active.has(l.id)}
            onClick={() =>
              setActive((prev) => {
                const next = new Set(prev);
                if (next.has(l.id)) next.delete(l.id);
                else next.add(l.id);
                return next;
              })
            }
          >
            {l.label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowLabels((s) => !s)}>
          {showLabels ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showLabels ? "Hide labels" : "Show labels"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Drag to pan. {shownCount} places shown.
        </p>
      </div>

      <MapCanvas
        view={view}
        onViewChange={setView}
        ariaLabel="Explorable map of India"
      >
        {active.has("rivers") && <RiverLines showLabels={showLabels} />}
        <PointMarks
          points={points}
          showLabels={showLabels}
          onSelect={setSelected}
          selectedId={selected?.id}
        />
      </MapCanvas>

      {selected ? (
        <Panel
          title={selected.name}
          actions={
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          }
        >
          <p className="text-sm leading-relaxed text-foreground/90">{selected.fact}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {selected.state} · {LAYERS.find((l) => l.id === selected.layer)?.chapter}
          </p>
        </Panel>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Tap any marker to read about it. No score, no timer.
        </p>
      )}
    </div>
  );
}
