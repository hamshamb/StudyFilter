import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Atom,
  BookOpen,
  FlaskConical,
  History,
  Lightbulb,
  MessageSquareText,
  Star,
  Target,
  Thermometer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AtomView } from "./AtomView";
import { Configuration } from "./ElementPieces";
import {
  CATEGORIES,
  commonNeutrons,
  shellCounts,
  valenceElectrons,
  type ChemElement,
} from "@/lib/chem/elements";
import { GROUPS } from "@/lib/chem/layout";
import {
  CBSE_TAGS,
  DETAILS,
  IONISATION_KJ,
  OXIDATION_STATES,
  RADII_PM,
} from "@/lib/chem/details";
import { useElementFavourites } from "@/lib/chem/favourites";
import { MASTERY_INFO, masteryKey } from "@/lib/mastery";
import { useMastery } from "@/hooks/use-mastery";
import { useOptionalStudyWorkspace } from "@/components/workspace/StudyWorkspace";
import { GRADE } from "@workspace/cbse-content";

/**
 * One element, in full.
 *
 * Sections rather than one long list, because the questions a student brings
 * here are different in kind: "what is it" is a different visit from "what is
 * its electron configuration" or "who found it". Every section hides the
 * fields it has no reliable value for — a screen of "N/A" makes the real data
 * look doubtful too.
 */

// ── Sections ─────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "atomic", label: "Atomic", icon: Atom },
  { id: "physical", label: "Physical", icon: Thermometer },
  { id: "chemical", label: "Chemical", icon: FlaskConical },
  { id: "uses", label: "Uses", icon: Lightbulb },
  { id: "discovery", label: "Discovery", icon: History },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ElementView({
  element,
  onBack,
  onPractise,
  onCompare,
}: {
  element: ChemElement;
  onBack: () => void;
  onPractise: (element: ChemElement) => void;
  onCompare: (element: ChemElement) => void;
}) {
  const [tab, setTab] = React.useState<TabId>("overview");
  const reduce = useReducedMotion();
  const category = CATEGORIES[element.category];
  const detail = DETAILS[element.symbol];
  const mastery = useMastery();
  const favs = useElementFavourites();
  const workspace = useOptionalStudyWorkspace();

  const state = mastery.stateOf(masteryKey("element", element.symbol));

  /** Opens the study panel without leaving the table. */
  function ask(question: string) {
    workspace?.open({
      kind: "explain",
      scope: { classLevel: GRADE, subjectId: "science", chapterId: null, topic: element.name },
      question,
      title: `${element.name} — ${question}`,
    });
  }

  const askShortcuts = [
    `Why is ${element.name.toLowerCase()} in group ${element.group}?`,
    `What is the electron configuration of ${element.name.toLowerCase()}?`,
    detail?.reactivity ? `Why is ${element.name.toLowerCase()} reactive?` : `How is ${element.name.toLowerCase()} used?`,
  ];

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-table">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the table
        </Button>
        <div className="flex items-center gap-1.5">
          <Button
            variant={favs.has(element.symbol) ? "default" : "outline"}
            size="sm"
            onClick={() => favs.toggle(element.symbol)}
            aria-pressed={favs.has(element.symbol)}
          >
            <Star className={cn("h-3.5 w-3.5", favs.has(element.symbol) && "fill-current")} aria-hidden="true" />
            {favs.has(element.symbol) ? "Saved" : "Save"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onCompare(element)}>
            Compare
          </Button>
          <Button size="sm" onClick={() => onPractise(element)}>
            <Target className="h-3.5 w-3.5" aria-hidden="true" />
            Practise
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* The atom leads on every screen size — it is the reason to be here. */}
        <AtomView element={element} className="min-h-[20rem]" />

        <div className="min-w-0">
          <header className={cn("rounded-xl border p-4", category.swatch, category.border)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs tabular-nums text-muted-foreground">{element.number}</p>
                {/*
                  The same layoutId as the tile in the grid. Framer tweens the
                  symbol from its cell to here, so the thing the student
                  clicked is the thing that grows — the transition reads as one
                  continuous movement rather than a page swap.
                */}
                <motion.h2
                  layoutId={`element-symbol-${element.symbol}`}
                  className={cn("text-4xl font-bold leading-none", category.text)}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  {element.symbol}
                </motion.h2>
                <p className="mt-1 text-lg font-semibold">{element.name}</p>
                <p className={cn("mt-1 text-xs font-semibold", category.text)}>{category.label}</p>
              </div>
              <dl className="shrink-0 space-y-1 text-right text-xs">
                <Mini label={element.massIsIsotope ? "Mass number" : "Atomic mass"} value={element.massIsIsotope ? `(${element.mass})` : `${element.mass} u`} />
                <Mini label="Group" value={String(element.group)} />
                <Mini label="Period" value={String(element.period)} />
                <Mini label="Block" value={`${element.block}`} />
              </dl>
            </div>
            {state !== "not-started" && (
              <p className={cn("mt-3 inline-block rounded-full border px-2.5 py-1 text-xs font-medium", MASTERY_INFO[state].className)}>
                {MASTERY_INFO[state].label}
              </p>
            )}
          </header>

          <div className="rail mt-3 py-0.5" role="tablist" aria-label="Element information">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === id
                    ? "border-primary/35 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="mt-3">
            {tab === "overview" && <Overview element={element} />}
            {tab === "atomic" && <AtomicSection element={element} />}
            {tab === "physical" && <PhysicalSection element={element} />}
            {tab === "chemical" && <ChemicalSection element={element} />}
            {tab === "uses" && <UsesSection element={element} />}
            {tab === "discovery" && <DiscoverySection element={element} />}
          </div>
        </div>
      </div>

      {workspace && (
        <section className="rounded-xl border border-card-border bg-card p-4">
          <h3 className="text-card-title mb-2 flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Ask StudyFilter about {element.name}
          </h3>
          <div className="flex flex-wrap gap-2">
            {askShortcuts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Answers open in the study panel — the table stays where it is.
          </p>
        </section>
      )}
    </motion.div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-card-border bg-card p-4 [&+section]:mt-3">
      {title && <h3 className="text-card-title mb-2.5">{title}</h3>}
      {children}
    </section>
  );
}

/** Only renders when there is something to say. */
function Facts({ rows }: { rows: [string, string | null | undefined][] }) {
  const present = rows.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (present.length === 0) return null;
  return (
    <dl className="space-y-2 text-sm">
      {present.map(([label, value]) => (
        <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Overview({ element }: { element: ChemElement }) {
  const detail = DETAILS[element.symbol];
  const tags = CBSE_TAGS[element.symbol];
  return (
    <>
      {detail?.summary && (
        <Card>
          <p className="text-sm leading-relaxed text-foreground/90">{detail.summary}</p>
        </Card>
      )}
      <Card title="At a glance">
        <Facts
          rows={[
            ["Atomic number", String(element.number)],
            [element.massIsIsotope ? "Mass number" : "Atomic mass", element.massIsIsotope ? `(${element.mass})` : `${element.mass} u`],
            ["Group", String(element.group)],
            ["Period", String(element.period)],
            ["Category", CATEGORIES[element.category].label],
            ["State at 25 °C", element.state === "unknown" ? null : element.state],
          ]}
        />
      </Card>
      {tags && tags.length > 0 && (
        <Card title={`In your Class ${GRADE} syllabus`}>
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <li key={t} className="rounded-full border border-primary/30 bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary">
                {t}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {!detail?.summary && (
        <Card>
          <p className="text-sm text-muted-foreground">
            No written summary for this element yet — the measured values in the other tabs are
            still complete.
          </p>
        </Card>
      )}
    </>
  );
}

function AtomicSection({ element }: { element: ChemElement }) {
  const shells = shellCounts(element);
  const valence = valenceElectrons(element);
  return (
    <>
      <Card title="Electron configuration">
        <p className="text-base">
          <Configuration value={element.configuration} />
        </p>
        {/* Each subshell as its own chip, outermost highlighted — the picture
            a student needs when they are asked for valence electrons. */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {element.configuration
            .replace(/^\[[A-Za-z]+\]\s*/, "")
            .split(/\s+/)
            .filter(Boolean)
            .map((token, i, all) => (
              <span
                key={token}
                className={cn(
                  "rounded-md border px-2 py-1 font-mono text-xs",
                  i === all.length - 1
                    ? "border-primary/40 bg-primary/10 font-semibold text-primary"
                    : "border-border bg-muted/50 text-muted-foreground",
                )}
              >
                {token}
              </span>
            ))}
        </div>
        {element.configuration.startsWith("[") && (
          <p className="mt-2 text-xs text-muted-foreground">
            {element.configuration.match(/^\[([A-Za-z]+)\]/)?.[1]} core shown in shorthand; the
            highlighted subshell is the outermost.
          </p>
        )}
      </Card>

      <Card title="Shell distribution">
        <div className="flex flex-wrap items-end gap-2">
          {shells.map((count, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-bold tabular-nums",
                  i === shells.length - 1
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-muted/50",
                )}
              >
                {count}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {["K", "L", "M", "N", "O", "P", "Q"][i]}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2.5 font-mono text-sm">{shells.join(", ")}</p>
        {valence !== null && (
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">Valence electrons: </span>
            <span className="font-semibold">{valence}</span>
          </p>
        )}
      </Card>

      <Card title="Particles">
        <Facts
          rows={[
            ["Protons", String(element.number)],
            ["Electrons", String(element.number)],
            ["Neutrons", `${commonNeutrons(element)} in the ${element.massIsIsotope ? "most stable" : "most common"} isotope`],
          ]}
        />
      </Card>
    </>
  );
}

function PhysicalSection({ element }: { element: ChemElement }) {
  const radius = RADII_PM[element.symbol];
  const kToC = (k: number) => `${Math.round((k - 273.15) * 10) / 10} °C`;
  return (
    <Card title="Physical properties">
      <Facts
        rows={[
          ["State at 25 °C", element.state === "unknown" ? null : element.state],
          ["Melting point", element.melt === null ? null : `${element.melt} K · ${kToC(element.melt)}`],
          ["Boiling point", element.boil === null ? null : `${element.boil} K · ${kToC(element.boil)}`],
          ["Density", element.density === null ? null : `${element.density} g/cm³`],
          ["Atomic radius", radius ? `${radius} pm (empirical)` : null],
        ]}
      />
      {element.number > 103 && (
        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
          Physical properties of this element have never been measured — only a few atoms have
          existed, briefly. Predicted values are deliberately not shown here.
        </p>
      )}
    </Card>
  );
}

function ChemicalSection({ element }: { element: ChemElement }) {
  const oxidation = OXIDATION_STATES[element.symbol];
  const ionisation = IONISATION_KJ[element.symbol];
  const valence = valenceElectrons(element);
  const detail = DETAILS[element.symbol];
  const group = GROUPS.find((g) => g.group === element.group);
  return (
    <>
      <Card title="Chemical properties">
        <Facts
          rows={[
            ["Category", CATEGORIES[element.category].label],
            ["Block", `${element.block}-block`],
            ["Valence electrons", valence === null ? null : String(valence)],
            [
              "Common oxidation states",
              oxidation ? oxidation.map((n) => (n > 0 ? `+${n}` : String(n))).join(", ") : null,
            ],
            ["Electronegativity", element.electronegativity === null ? null : `${element.electronegativity} (Pauling)`],
            ["First ionisation energy", ionisation ? `${ionisation} kJ/mol` : null],
          ]}
        />
      </Card>
      {detail?.reactivity && (
        <Card title="How it behaves">
          <p className="text-sm leading-relaxed text-foreground/90">{detail.reactivity}</p>
        </Card>
      )}
      {group && (
        <Card title={group.name ?? `Group ${group.group}`}>
          <p className="text-sm leading-relaxed text-foreground/90">{group.summary}</p>
        </Card>
      )}
    </>
  );
}

function UsesSection({ element }: { element: ChemElement }) {
  const uses = DETAILS[element.symbol]?.uses;
  if (!uses || uses.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          No uses recorded for {element.name} yet. Rather than list something vague, this section
          stays empty until there is a real one to give.
        </p>
      </Card>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {uses.map((use) => (
        <div key={use.area} className="rounded-xl border border-card-border bg-card p-3.5">
          <p className="text-sm font-semibold">{use.area}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{use.note}</p>
        </div>
      ))}
    </div>
  );
}

function DiscoverySection({ element }: { element: ChemElement }) {
  const detail = DETAILS[element.symbol];
  const has = detail?.discoveredBy || detail?.discoveryYear || detail?.nameOrigin;
  if (!has) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          No reliable discovery record for {element.name} here. Many elements were known long
          before anyone recorded finding them.
        </p>
      </Card>
    );
  }
  return (
    <Card title="Discovery">
      <Facts
        rows={[
          ["Discovered by", detail?.discoveredBy ?? null],
          ["Year", detail?.discoveryYear ? String(detail.discoveryYear) : null],
        ]}
      />
      {detail?.nameOrigin && (
        <p className="mt-2.5 border-t border-border pt-2.5 text-sm leading-relaxed text-foreground/90">
          <span className="text-muted-foreground">Name: </span>
          {detail.nameOrigin}
        </p>
      )}
    </Card>
  );
}
