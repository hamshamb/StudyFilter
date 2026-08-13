import React from "react";
import { useLocation, useSearch } from "wouter";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { Atom, Check, GraduationCap, RotateCw, Search, Table2, Target, TrendingUp, X } from "lucide-react";
import { PageShell, PageHeader, Panel } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Chip, ProgressBar } from "@/components/ui/primitives";
import { SeoHead } from "@/components/SeoHead";
import { useRecordRecent } from "@/hooks/use-recents";
import { recordMasteryAttempt, useMastery } from "@/hooks/use-mastery";
import { masteryKey } from "@/lib/mastery";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  ELEMENTS,
  elementBySymbol,
  valenceElectrons,
  type ChemElement,
  type ElementCategory,
} from "@/lib/chem/elements";
import {
  F_BLOCK,
  F_BLOCK_MARKERS,
  GRID_COLUMNS,
  GROUPS,
  MAIN_GRID,
  PERIODS,
  elementsInGroup,
  elementsInPeriod,
} from "@/lib/chem/layout";
import { CBSE_TAGS, IONISATION_KJ, RADII_PM, cbseChapters, symbolsForChapter } from "@/lib/chem/details";
import { ElementView } from "@/components/chem/ElementView";
import { useElementFavourites } from "@/lib/chem/favourites";
import { cn } from "@/lib/utils";

/**
 * The periodic table as a workspace, not a chart.
 *
 * Four modes over one table. The table never goes away and never reloads:
 * choosing an element animates the table back and the atom forward, with the
 * chemical symbol carried between the two by a shared layout animation, so the
 * eye keeps hold of the thing it clicked. Escape brings the table back with
 * the search, filters and mode exactly as they were.
 *
 * The selected element lives in the URL, so refreshing on oxygen returns to
 * oxygen and a link to an element is a real link.
 */

type Mode = "explore" | "learn" | "trends" | "practice";

const MODES: { id: Mode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "explore", label: "Explore", icon: Table2 },
  { id: "learn", label: "Learn", icon: GraduationCap },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "practice", label: "Practice", icon: Target },
];

/** Motion that matches the rest of the product: quick, eased, never springy. */
const EASE = [0.22, 1, 0.36, 1] as const;

export default function PeriodicTable() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [mode, setMode] = React.useState<Mode>("explore");
  const reduce = useReducedMotion();

  const selected = React.useMemo(() => {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const raw = params.get("element");
    return raw ? (elementBySymbol(raw) ?? ELEMENTS.find((e) => e.name.toLowerCase() === raw.toLowerCase()) ?? null) : null;
  }, [search]);

  const select = React.useCallback(
    (element: ChemElement | null) => {
      navigate(element ? `/tools/periodic-table?element=${element.symbol}` : "/tools/periodic-table");
    },
    [navigate],
  );

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [selected?.symbol]);

  useRecordRecent({
    kind: "elements",
    title: selected ? `${selected.name} — periodic table` : "Periodic table",
    subtitle: "Chemistry",
    href: selected ? `/tools/periodic-table?element=${selected.symbol}` : "/tools/periodic-table",
  });

  // Escape always returns to the table, from anywhere in the element view.
  React.useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, select]);

  const [compare, setCompare] = React.useState<ChemElement[]>([]);
  const [practiceSeed, setPracticeSeed] = React.useState<ChemElement | null>(null);

  return (
    <>
      <SeoHead
        title={
          selected
            ? `${selected.name} (${selected.symbol}) — Interactive Periodic Table | StudyFilter`
            : "Interactive Periodic Table — CBSE Chemistry | StudyFilter"
        }
        description={
          selected
            ? `${selected.name}: atomic number ${selected.number}, electron configuration, properties and uses, with an interactive atomic model.`
            : "Explore all 118 elements with an interactive atomic model, periodic trends, guided learning and practice built for CBSE."
        }
        canonical="/tools/periodic-table"
      />
      <PageShell>
        <LayoutGroup>
          <AnimatePresence mode="wait" initial={false}>
            {selected ? (
              <motion.div
                key="element"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <ElementView
                  element={selected}
                  onBack={() => select(null)}
                  onPractise={(el) => {
                    setPracticeSeed(el);
                    setMode("practice");
                    select(null);
                  }}
                  onCompare={(el) => {
                    setCompare((prev) =>
                      prev.some((p) => p.number === el.number) ? prev : [...prev, el].slice(-4),
                    );
                    select(null);
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="table"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <PageHeader
                  icon={Atom}
                  title="Periodic table"
                  eyebrow="Chemistry"
                  description="All 118 elements, from stored reference data. Pick one to see its atom."
                />

                <div className="rail mb-4 py-0.5" role="tablist" aria-label="Periodic table mode">
                  {MODES.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={mode === id}
                      onClick={() => setMode(id)}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
                        mode === id
                          ? "border-primary/35 bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      data-testid={`tab-${id}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>

                <div role="tabpanel">
                  {mode === "explore" && (
                    <ExploreMode onOpen={select} compare={compare} setCompare={setCompare} />
                  )}
                  {mode === "learn" && <LearnMode onOpen={select} />}
                  {mode === "trends" && <TrendsMode onOpen={select} />}
                  {mode === "practice" && <PracticeMode seed={practiceSeed} onOpen={select} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </PageShell>
    </>
  );
}

// ── The grid ─────────────────────────────────────────────────────────────

type Emphasis = "on" | "off" | "normal";

interface GridProps {
  onPick: (element: ChemElement) => void;
  emphasis?: (element: ChemElement) => Emphasis;
  /** A short value drawn under the symbol — trend values, mostly. */
  badge?: (element: ChemElement) => string | null;
  /** Colour override, used by Trends to shade by value. */
  tint?: (element: ChemElement) => string | null;
  onGroupClick?: (group: number) => void;
  onPeriodClick?: (period: number) => void;
  focusedNumber?: number | null;
  showMastery?: boolean;
}

function PeriodicGrid({
  onPick,
  emphasis,
  badge,
  tint,
  onGroupClick,
  onPeriodClick,
  focusedNumber,
  showMastery,
}: GridProps) {
  const mastery = useMastery();
  const [hovered, setHovered] = React.useState<ChemElement | null>(null);

  const cell = (element: ChemElement, column: number, row: number, key: string) => {
    const state = emphasis?.(element) ?? "normal";
    const category = CATEGORIES[element.category];
    const shade = tint?.(element) ?? null;
    const value = badge?.(element) ?? null;
    const m = showMastery ? mastery.stateOf(masteryKey("element", element.symbol)) : "not-started";

    return (
      <div key={key} style={{ gridColumn: column, gridRow: row }}>
        <button
          type="button"
          onClick={() => onPick(element)}
          onMouseEnter={() => setHovered(element)}
          onMouseLeave={() => setHovered((h) => (h?.number === element.number ? null : h))}
          onFocus={() => setHovered(element)}
          onBlur={() => setHovered((h) => (h?.number === element.number ? null : h))}
          aria-label={`${element.name}, symbol ${element.symbol}, atomic number ${element.number}, ${category.label}`}
          data-testid={`element-${element.symbol}`}
          className={cn(
            "group relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-md border p-0.5 text-center",
            "transition-[transform,box-shadow,opacity,background-color] duration-150 ease-out",
            "focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            shade ? "border-transparent" : cn(category.swatch, category.border),
            state === "off" && "opacity-20",
            state === "on" && "ring-1 ring-primary/50",
            focusedNumber === element.number && "z-20 ring-2 ring-ring",
            // The lift: small, fast, and only on the hovered tile so the grid
            // around it stays completely still.
            "hover:z-20 hover:-translate-y-0.5 hover:scale-[1.14] hover:shadow-lg",
          )}
          style={shade ? { backgroundColor: shade } : undefined}
        >
          <span className="text-[0.5rem] leading-none tabular-nums text-muted-foreground">
            {element.number}
          </span>
          <motion.span
            layoutId={`element-symbol-${element.symbol}`}
            className={cn("text-[0.82rem] font-bold leading-tight", shade ? "text-foreground" : category.text)}
          >
            {element.symbol}
          </motion.span>
          <span className="w-full truncate px-0.5 text-[0.38rem] leading-tight text-muted-foreground">
            {value ?? element.name}
          </span>
          {showMastery && m !== "not-started" && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full",
                m === "strong" ? "bg-success" : m === "needs-revision" ? "bg-warning" : "bg-primary",
              )}
            />
          )}
        </button>
      </div>
    );
  };

  return (
    <div>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {/* 18 columns cannot reflow — a wrapped periodic table is not one. On a
            phone it scrolls sideways at a legible size, which is how a printed
            table behaves on a desk. */}
        <div className="min-w-[49.375rem]">
          <div
            className="grid gap-[3px]"
            style={{
              gridTemplateColumns: `1rem repeat(${GRID_COLUMNS}, 2.5rem)`,
              gridTemplateRows: "1rem repeat(7, 2.5rem)",
            }}
          >
            {onGroupClick &&
              Array.from({ length: 18 }, (_, i) => i + 1).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onGroupClick(g)}
                  style={{ gridColumn: g + 1, gridRow: 1 }}
                  className="flex h-full w-full items-center justify-center rounded text-[0.55rem] font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Highlight group ${g}`}
                >
                  {g}
                </button>
              ))}
            {onPeriodClick &&
              PERIODS.map((p) => (
                <button
                  key={p.period}
                  type="button"
                  onClick={() => onPeriodClick(p.period)}
                  style={{ gridColumn: 1, gridRow: p.period + 1 }}
                  className="flex h-full w-full items-center justify-center rounded text-[0.55rem] font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Highlight period ${p.period}`}
                >
                  {p.period}
                </button>
              ))}
            {MAIN_GRID.map(({ element, column, row }) =>
              cell(element, column + 1, row + 1, String(element.number)),
            )}
            {F_BLOCK_MARKERS.map((marker) => (
              <div
                key={marker.label}
                style={{ gridColumn: marker.column + 1, gridRow: marker.row + 1 }}
                className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-border text-[0.5rem] font-semibold text-muted-foreground"
                title={marker.title}
              >
                {marker.label}
              </div>
            ))}
          </div>

          <div
            className="mt-2 grid gap-[3px]"
            style={{
              gridTemplateColumns: `1rem repeat(${GRID_COLUMNS}, 2.5rem)`,
              gridTemplateRows: "repeat(2, 2.5rem)",
            }}
          >
            {F_BLOCK.map(({ element, column, row }) =>
              cell(element, column + 3, row, String(element.number)),
            )}
          </div>
        </div>
      </div>

      {/* Hover preview. A fixed slot rather than a floating tooltip, so it
          never covers the tile you are pointing at and never causes reflow. */}
      <div className="mt-2 min-h-[2.5rem]">
        {hovered ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg border border-card-border bg-card px-3 py-2 text-sm">
            <span className="font-semibold">{hovered.name}</span>
            <span className="text-xs text-muted-foreground">
              {hovered.symbol} · atomic number {hovered.number} · {CATEGORIES[hovered.category].label}
            </span>
            <span className="ml-auto text-xs text-primary">Click to explore</span>
          </div>
        ) : (
          <p className="px-1 text-xs text-muted-foreground">
            Hover an element for a preview. Click to open its atom.
          </p>
        )}
      </div>
    </div>
  );
}

function Legend({
  active,
  onToggle,
  onClear,
}: {
  active: Set<ElementCategory>;
  onToggle: (c: ElementCategory) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {CATEGORY_ORDER.map((c) => {
        const on = active.has(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() => onToggle(c)}
            aria-pressed={on}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              on ? "border-primary/45 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-sm border", CATEGORIES[c].swatch, CATEGORIES[c].border)} />
            {CATEGORIES[c].label}
          </button>
        );
      })}
      {active.size > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs">
          Clear filters
        </Button>
      )}
    </div>
  );
}

// ── Explore ──────────────────────────────────────────────────────────────

function ExploreMode({
  onOpen,
  compare,
  setCompare,
}: {
  onOpen: (e: ChemElement) => void;
  compare: ChemElement[];
  setCompare: React.Dispatch<React.SetStateAction<ChemElement[]>>;
}) {
  const [query, setQuery] = React.useState("");
  const [categories, setCategories] = React.useState<Set<ElementCategory>>(new Set());
  const [group, setGroup] = React.useState<number | null>(null);
  const [period, setPeriod] = React.useState<number | null>(null);
  const [focused, setFocused] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const favs = useElementFavourites();

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const n = Number(q);
    return new Set(
      ELEMENTS.filter(
        (e) =>
          e.name.toLowerCase().startsWith(q) ||
          e.symbol.toLowerCase() === q ||
          (Number.isFinite(n) && e.number === n),
      ).map((e) => e.number),
    );
  }, [query]);

  // "/" focuses search, arrows walk the table, Enter opens what is focused.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (typing) return;
      if (!e.key.startsWith("Arrow") && e.key !== "Enter") return;
      const current = focused ?? 1;
      const element = ELEMENTS.find((x) => x.number === current);
      if (!element) return;
      if (e.key === "Enter") {
        e.preventDefault();
        onOpen(element);
        return;
      }
      e.preventDefault();
      // Left/right step through atomic number; up/down move a period, which
      // is the movement the table's shape implies.
      const delta =
        e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? 18 : -18;
      const next = Math.min(118, Math.max(1, current + delta));
      setFocused(next);
      document.querySelector<HTMLElement>(`[data-testid="element-${ELEMENTS[next - 1]!.symbol}"]`)?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, onOpen]);

  function emphasis(e: ChemElement): Emphasis {
    if (matches) return matches.has(e.number) ? "on" : "off";
    if (group !== null) return e.group === group && e.block !== "f" ? "on" : "off";
    if (period !== null) return e.period === period ? "on" : "off";
    if (categories.size > 0) return categories.has(e.category) ? "on" : "off";
    return "normal";
  }

  const groupInfo = group !== null ? GROUPS.find((g) => g.group === group) : null;
  const periodInfo = period !== null ? PERIODS.find((p) => p.period === period) : null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches && matches.size > 0) {
              const first = ELEMENTS.find((x) => matches.has(x.number));
              if (first) onOpen(first);
            }
          }}
          placeholder="Search by name, symbol or atomic number — press / from anywhere"
          aria-label="Search elements"
          className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
          data-testid="input-element-search"
        />
      </div>

      <Legend
        active={categories}
        onToggle={(c) => {
          setGroup(null);
          setPeriod(null);
          setCategories((prev) => {
            const next = new Set(prev);
            if (next.has(c)) next.delete(c);
            else next.add(c);
            return next;
          });
        }}
        onClear={() => setCategories(new Set())}
      />

      {(groupInfo || periodInfo) && (
        <Panel
          title={groupInfo ? (groupInfo.name ?? `Group ${group}`) : `Period ${period}`}
          actions={
            <Button variant="ghost" size="sm" onClick={() => { setGroup(null); setPeriod(null); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          }
        >
          <p className="text-sm leading-relaxed text-foreground/90">
            {groupInfo ? groupInfo.summary : periodInfo?.summary}
          </p>
        </Panel>
      )}

      <PeriodicGrid
        onPick={onOpen}
        emphasis={emphasis}
        onGroupClick={(g) => { setGroup(group === g ? null : g); setPeriod(null); setCategories(new Set()); }}
        onPeriodClick={(p) => { setPeriod(period === p ? null : p); setGroup(null); setCategories(new Set()); }}
        focusedNumber={focused}
        showMastery
      />

      {compare.length > 0 && <CompareTable elements={compare} onClear={() => setCompare([])} />}

      {favs.saved.length > 0 && (
        <Panel title="Saved elements" description="Starred from an element's page.">
          <div className="flex flex-wrap gap-1.5">
            {favs.saved.map((symbol) => {
              const e = elementBySymbol(symbol);
              if (!e) return null;
              return (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => onOpen(e)}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                >
                  {e.symbol} · {e.name}
                </button>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ── Compare ──────────────────────────────────────────────────────────────

function CompareTable({ elements, onClear }: { elements: ChemElement[]; onClear: () => void }) {
  const rows: [string, (e: ChemElement) => string][] = [
    ["Atomic number", (e) => String(e.number)],
    ["Atomic mass", (e) => (e.massIsIsotope ? `(${e.mass})` : String(e.mass))],
    ["Group", (e) => String(e.group)],
    ["Period", (e) => String(e.period)],
    ["Category", (e) => CATEGORIES[e.category].label],
    ["Shells", (e) => shellsOf(e)],
    ["Valence electrons", (e) => String(valenceElectrons(e) ?? "—")],
    ["Atomic radius", (e) => (RADII_PM[e.symbol] ? `${RADII_PM[e.symbol]} pm` : "—")],
    ["Electronegativity", (e) => (e.electronegativity === null ? "—" : String(e.electronegativity))],
    ["Ionisation energy", (e) => (IONISATION_KJ[e.symbol] ? `${IONISATION_KJ[e.symbol]} kJ/mol` : "—")],
    ["Melting point", (e) => (e.melt === null ? "—" : `${e.melt} K`)],
  ];

  const sameGroup = elements.every((e) => e.group === elements[0]!.group);
  const samePeriod = elements.every((e) => e.period === elements[0]!.period);

  return (
    <Panel
      title={`Comparing ${elements.map((e) => e.symbol).join(" · ")}`}
      actions={
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      }
      flush
    >
      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[24rem] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-border px-2 py-2 text-left font-medium text-muted-foreground">Property</th>
              {elements.map((e) => (
                <th key={e.number} className="border-b border-border px-2 py-2 text-left font-semibold">
                  {e.symbol}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, get]) => (
              <tr key={label} className="border-b border-border/60 last:border-0">
                <td className="px-2 py-1.5 text-muted-foreground">{label}</td>
                {elements.map((e) => (
                  <td key={e.number} className="px-2 py-1.5 tabular-nums">
                    {get(e)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {elements.length >= 2 && (
          <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
            <p>
              <span className="font-semibold">Similar because: </span>
              {sameGroup
                ? "same group — the same number of valence electrons, so they react in the same way."
                : samePeriod
                  ? "same period — their electrons are going into the same outermost shell."
                  : "both are in the table's main body; compare their groups to see how their bonding differs."}
            </p>
            <p>
              <span className="font-semibold">Different because: </span>
              {sameGroup
                ? "each step down the group adds a shell, so the atom gets larger and the outer electron is held less tightly."
                : "moving across a period the nuclear charge grows while the shell stays the same, pulling the electrons in tighter."}
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}

function shellsOf(e: ChemElement): string {
  const parts: number[] = [];
  const conf = e.configuration.replace(/^\[([A-Za-z]+)\]/, (_, core: string) => {
    const base = elementBySymbol(core);
    if (base) parts.push(...shellsOf(base).split(",").map((n) => Number(n.trim())));
    return "";
  });
  for (const token of conf.trim().split(/\s+/).filter(Boolean)) {
    const m = token.match(/^(\d)[spdf](\d+)$/);
    if (!m) continue;
    const shell = Number(m[1]);
    while (parts.length < shell) parts.push(0);
    parts[shell - 1] = (parts[shell - 1] ?? 0) + Number(m[2]);
  }
  return parts.join(", ");
}

// ── Learn ────────────────────────────────────────────────────────────────

function LearnMode({ onOpen }: { onOpen: (e: ChemElement) => void }) {
  const [lens, setLens] = React.useState<"category" | "group" | "period" | "cbse">("category");
  const [category, setCategory] = React.useState<ElementCategory>("alkali-metal");
  const [group, setGroup] = React.useState(1);
  const [period, setPeriod] = React.useState(2);
  const [chapter, setChapter] = React.useState(cbseChapters()[0] ?? "");

  const cbseSet = React.useMemo(() => new Set(symbolsForChapter(chapter)), [chapter]);

  function emphasis(e: ChemElement): Emphasis {
    if (lens === "category") return e.category === category ? "on" : "off";
    if (lens === "group") return e.group === group && e.block !== "f" ? "on" : "off";
    if (lens === "period") return e.period === period ? "on" : "off";
    return cbseSet.has(e.symbol) ? "on" : "off";
  }

  const highlighted = ELEMENTS.filter((e) => emphasis(e) === "on");

  return (
    <div className="space-y-3">
      <div className="rail py-0.5">
        {([
          ["category", "By family"],
          ["group", "By group"],
          ["period", "By period"],
          ["cbse", `Class ${10} focus`],
        ] as const).map(([id, label]) => (
          <Chip key={id} active={lens === id} onClick={() => setLens(id)}>
            {label}
          </Chip>
        ))}
      </div>

      <div className="rail py-0.5">
        {lens === "category" &&
          CATEGORY_ORDER.filter((c) => c !== "unknown").map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {CATEGORIES[c].label}
            </Chip>
          ))}
        {lens === "group" &&
          GROUPS.map((g) => (
            <Chip key={g.group} active={group === g.group} onClick={() => setGroup(g.group)}>
              {g.name ?? `Group ${g.group}`}
            </Chip>
          ))}
        {lens === "period" &&
          PERIODS.map((p) => (
            <Chip key={p.period} active={period === p.period} onClick={() => setPeriod(p.period)}>
              Period {p.period}
            </Chip>
          ))}
        {lens === "cbse" &&
          cbseChapters().map((c) => (
            <Chip key={c} active={chapter === c} onClick={() => setChapter(c)}>
              {c}
            </Chip>
          ))}
      </div>

      <PeriodicGrid onPick={onOpen} emphasis={emphasis} />

      <Panel
        title={
          lens === "category"
            ? CATEGORIES[category].label
            : lens === "group"
              ? (GROUPS.find((g) => g.group === group)?.name ?? `Group ${group}`)
              : lens === "period"
                ? `Period ${period}`
                : chapter
        }
        description={`${highlighted.length} element${highlighted.length === 1 ? "" : "s"} highlighted.`}
      >
        <p className="text-sm leading-relaxed text-foreground/90">
          {lens === "group"
            ? GROUPS.find((g) => g.group === group)?.summary
            : lens === "period"
              ? PERIODS.find((p) => p.period === period)?.summary
              : lens === "cbse"
                ? `The elements this chapter actually uses. Taken from the chapter list in your syllabus, not chosen at random — so what is highlighted is what you will meet in questions.`
                : categoryBlurb(category)}
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {highlighted.slice(0, 40).map((e) => (
            <li key={e.number}>
              <button
                type="button"
                onClick={() => onOpen(e)}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
              >
                {e.symbol} · {e.name}
              </button>
            </li>
          ))}
        </ul>
        {lens === "cbse" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Nobody is expected to memorise all 118. These are the ones Class {10} keeps coming back to.
          </p>
        )}
      </Panel>
    </div>
  );
}

function categoryBlurb(c: ElementCategory): string {
  switch (c) {
    case "alkali-metal":
      return "One electron in the outermost shell, lost easily. Soft, low-melting metals that react with water, and get more reactive going down the group.";
    case "alkaline-earth-metal":
      return "Two outer electrons, given up as a pair to form 2+ ions. Harder and less reactive than group 1.";
    case "transition-metal":
      return "The d-block. Hard, high-melting, good conductors, and they show several oxidation states and form coloured compounds.";
    case "post-transition-metal":
      return "Metals after the transition series. Softer and lower-melting, with more covalent character in their bonding.";
    case "metalloid":
      return "Between metals and non-metals. Their semiconducting behaviour is what makes modern electronics possible.";
    case "reactive-nonmetal":
      return "Gain or share electrons rather than losing them. They make up most of living matter.";
    case "halogen":
      return "Seven outer electrons, one short of full — the most reactive non-metals. Reactivity falls going down the group.";
    case "noble-gas":
      return "A complete outer shell, so almost no reactions. Their stability is the target every other element's bonding aims at.";
    case "lanthanide":
      return "The 4f series. Chemically very similar to each other, and used in magnets, lasers and phosphors.";
    case "actinide":
      return "The 5f series. All radioactive; everything past uranium is made artificially.";
    default:
      return "Elements whose chemical properties have not been measured.";
  }
}

// ── Trends ───────────────────────────────────────────────────────────────

type TrendId = "radius" | "electronegativity" | "ionisation" | "mass" | "melt";

const TRENDS: {
  id: TrendId;
  label: string;
  unit: string;
  value: (e: ChemElement) => number | null;
  across: string;
  down: string;
}[] = [
  {
    id: "radius",
    label: "Atomic radius",
    unit: "pm",
    value: (e) => RADII_PM[e.symbol] ?? null,
    across: "generally decreases across a period — the nuclear charge grows while the shell stays the same",
    down: "generally increases down a group — each period adds a shell",
  },
  {
    id: "electronegativity",
    label: "Electronegativity",
    unit: "",
    value: (e) => e.electronegativity,
    across: "generally increases across a period",
    down: "generally decreases down a group",
  },
  {
    id: "ionisation",
    label: "Ionisation energy",
    unit: "kJ/mol",
    value: (e) => IONISATION_KJ[e.symbol] ?? null,
    across: "generally increases across a period",
    down: "generally decreases down a group",
  },
  { id: "mass", label: "Atomic mass", unit: "u", value: (e) => e.mass, across: "increases with atomic number", down: "increases with atomic number" },
  { id: "melt", label: "Melting point", unit: "K", value: (e) => e.melt, across: "varies — it peaks in the middle of a period", down: "varies by group" },
];

function TrendsMode({ onOpen }: { onOpen: (e: ChemElement) => void }) {
  const [trend, setTrend] = React.useState<TrendId>("electronegativity");
  const spec = TRENDS.find((t) => t.id === trend)!;

  const values = ELEMENTS.map(spec.value).filter((v): v is number => v !== null);
  const min = Math.min(...values);
  const max = Math.max(...values);

  function tint(e: ChemElement): string | null {
    const v = spec.value(e);
    if (v === null) return null;
    // A single-hue ramp, not a rainbow: intensity is the variable, so the
    // ordering is readable even for someone who cannot separate hues.
    const t = max === min ? 0.5 : (v - min) / (max - min);
    return `hsl(var(--primary) / ${(0.08 + t * 0.62).toFixed(3)})`;
  }

  return (
    <div className="space-y-3">
      <div className="rail py-0.5">
        {TRENDS.map((t) => (
          <Chip key={t.id} active={trend === t.id} onClick={() => setTrend(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>

      <Panel title={spec.label}>
        <ul className="space-y-1 text-sm">
          <li>
            <span className="font-semibold">Across a period → </span>
            {spec.across}.
          </li>
          <li>
            <span className="font-semibold">Down a group ↓ </span>
            {spec.down}.
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          &ldquo;Generally&rdquo; is doing real work in those sentences — every periodic trend has
          exceptions, and the exceptions are often what gets examined.
        </p>
        {spec.id === "radius" && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Radii shown are empirical values. Covalent and van der Waals radii differ, so one
            convention is used throughout rather than mixing sources.
          </p>
        )}
      </Panel>

      <PeriodicGrid
        onPick={onOpen}
        tint={tint}
        badge={(e) => {
          const v = spec.value(e);
          return v === null ? "—" : String(v);
        }}
      />

      <p className="text-xs text-muted-foreground">
        Elements with no reliable value for {spec.label.toLowerCase()} are left uncoloured and show
        a dash, rather than being given an invented number.
      </p>
    </div>
  );
}

// ── Practice ─────────────────────────────────────────────────────────────

type Question =
  | { kind: "pick"; prompt: string; answer: ChemElement; explain: string }
  | { kind: "choice"; prompt: string; options: string[]; answer: string; explain: string };

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const PRACTICE_POOL = ELEMENTS.filter((e) => e.number <= 20 || CBSE_TAGS[e.symbol]);

function buildQuestions(count: number, seed: ChemElement | null): Question[] {
  const pool = shuffle(PRACTICE_POOL);
  const chosen = seed ? [seed, ...pool.filter((e) => e.number !== seed.number)] : pool;
  const questions: Question[] = [];

  for (const element of chosen) {
    if (questions.length >= count) break;
    const shells = shellsOf(element);
    const valence = valenceElectrons(element);
    const variants: Question[] = [
      {
        kind: "pick",
        prompt: `Select ${element.name} on the table.`,
        answer: element,
        explain: `${element.name} is ${element.symbol}, atomic number ${element.number}, in group ${element.group} and period ${element.period}.`,
      },
      {
        kind: "pick",
        prompt: `Select the element with atomic number ${element.number}.`,
        answer: element,
        explain: `Atomic number ${element.number} is ${element.name} (${element.symbol}).`,
      },
      {
        kind: "pick",
        prompt: `Which element has the electron distribution ${shells}?`,
        answer: element,
        explain: `${shells} adds up to ${element.number} electrons, which is ${element.name}.`,
      },
      {
        kind: "pick",
        prompt: `Select the element in group ${element.group}, period ${element.period}.`,
        answer: element,
        explain: `Group ${element.group}, period ${element.period} is ${element.name}.`,
      },
    ];
    if (valence !== null) {
      variants.push({
        kind: "choice",
        prompt: `How many valence electrons does ${element.name} have?`,
        options: shuffle([...new Set([String(valence), String((valence % 8) + 1), String(Math.max(1, valence - 1)), String(Math.min(8, valence + 2))])]).slice(0, 4),
        answer: String(valence),
        explain: `${element.name} is ${element.configuration}. Its outermost shell holds ${valence}.`,
      });
    }
    questions.push(shuffle(variants)[0]!);
  }
  return questions.slice(0, count);
}

function PracticeMode({ seed, onOpen }: { seed: ChemElement | null; onOpen: (e: ChemElement) => void }) {
  const [count, setCount] = React.useState(10);
  const [questions, setQuestions] = React.useState<Question[] | null>(null);
  const [index, setIndex] = React.useState(0);
  const [given, setGiven] = React.useState<string | null>(null);
  const [score, setScore] = React.useState(0);
  const [wrong, setWrong] = React.useState<Question[]>([]);

  const current = questions?.[index];

  function start() {
    setQuestions(buildQuestions(count, seed));
    setIndex(0);
    setGiven(null);
    setScore(0);
    setWrong([]);
  }

  function answer(value: string, element?: ChemElement) {
    if (!current || given) return;
    const correct =
      current.kind === "pick" ? element?.number === current.answer.number : value === current.answer;
    setGiven(value);
    if (correct) setScore((s) => s + 1);
    else setWrong((w) => [...w, current]);

    const target = current.kind === "pick" ? current.answer : null;
    if (target) {
      recordMasteryAttempt(
        { key: masteryKey("element", target.symbol), domain: "element", label: `${target.name} (${target.symbol})` },
        { correct: correct ? 1 : 0, total: 1 },
      );
    }
  }

  function next() {
    if (!questions) return;
    if (index + 1 >= questions.length) {
      setIndex(questions.length);
      return;
    }
    setIndex((i) => i + 1);
    setGiven(null);
  }

  if (!questions) {
    return (
      <Panel title="Practise the table" icon={Target}>
        <p className="text-sm text-muted-foreground">
          Questions mix table-finding prompts with short multiple-choice checks on atomic structure
          and periodic trends.
        </p>
        {seed && (
          <p className="mt-2 text-sm">
            Starting with <span className="font-semibold">{seed.name}</span>.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {[5, 10, 20].map((n) => (
            <Chip key={n} active={count === n} onClick={() => setCount(n)}>
              {n} questions
            </Chip>
          ))}
        </div>
        <Button className="mt-4 w-full" onClick={start}>
          Start
        </Button>
      </Panel>
    );
  }

  if (index >= questions.length) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-card-border bg-card p-6 text-center">
          <h2 className="text-3xl font-bold tabular-nums">
            {score} / {questions.length}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{pct}% accuracy</p>
          <ProgressBar
            value={pct}
            tone={pct >= 80 ? "success" : pct >= 50 ? "primary" : "warning"}
            className="mx-auto mt-4 max-w-xs"
            label={`Scored ${score} of ${questions.length}`}
          />
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={start}>
              <RotateCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
            <Button variant="outline" onClick={() => setQuestions(null)}>
              Change settings
            </Button>
          </div>
        </div>
        {wrong.length > 0 && (
          <Panel title="Review what you missed">
            <ul className="space-y-2.5">
              {wrong.map((q, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium">{q.prompt}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{q.explain}</p>
                  {q.kind === "pick" && (
                    <button
                      type="button"
                      onClick={() => onOpen(q.answer)}
                      className="mt-1 text-xs font-medium text-primary hover:underline"
                    >
                      Open {q.answer.name}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    );
  }

  if (!current) return null;
  const correct =
    given !== null &&
    (current.kind === "pick" ? given === current.answer.symbol : given === current.answer);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-card-border bg-card p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <span className="tabular-nums">{score} correct</span>
        </div>
        <ProgressBar value={(index / questions.length) * 100} size="sm" className="mt-2" label={`${index} done`} />
        <p className="mt-3 text-base font-medium">{current.prompt}</p>

        {given !== null && (
          <div
            className={cn(
              "mt-3 rounded-lg border px-3 py-2.5 text-sm",
              correct ? "border-success/40 bg-success-soft" : "border-destructive/40 bg-destructive-soft",
            )}
          >
            <p className="flex items-center gap-2 font-semibold">
              {correct ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />}
              {correct ? "Correct" : "Not quite"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{current.explain}</p>
            <Button size="sm" className="mt-2.5" onClick={next}>
              {index + 1 >= questions.length ? "See results" : "Next"}
            </Button>
          </div>
        )}
      </div>

      {current.kind === "choice" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {current.options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={given !== null}
              onClick={() => answer(option)}
              className={cn(
                "min-h-11 rounded-lg border px-3.5 py-3 text-left text-sm transition-colors",
                given !== null && option === current.answer
                  ? "border-success/45 bg-success-soft"
                  : given === option
                    ? "border-destructive/45 bg-destructive-soft"
                    : "border-border hover:border-primary/40 hover:bg-muted/60",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <PeriodicGrid
          onPick={(e) => (given === null ? answer(e.symbol, e) : undefined)}
          emphasis={(e) =>
            given !== null && e.number === (current as Extract<Question, { kind: "pick" }>).answer.number
              ? "on"
              : "normal"
          }
        />
      )}
    </div>
  );
}
