import React from "react";
import { Atom, FlaskConical, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  commonNeutrons,
  parseConfiguration,
  shellCounts,
  valenceElectrons,
  type ChemElement,
} from "@/lib/chem/elements";
import { GROUPS } from "@/lib/chem/layout";
import { MASTERY_INFO, type MasteryState } from "@/lib/mastery";

/** What the cell shows under the symbol. Swapped by the toggle in the toolbar. */
export type CellProperty = "mass" | "configuration" | "valency" | "electronegativity" | "state";

export const CELL_PROPERTY_LABELS: Record<CellProperty, string> = {
  mass: "Atomic mass",
  configuration: "Configuration",
  valency: "Valence electrons",
  electronegativity: "Electronegativity",
  state: "State at 25 °C",
};

function cellValue(element: ChemElement, property: CellProperty): string {
  switch (property) {
    case "mass":
      return element.massIsIsotope ? `(${element.mass})` : String(element.mass);
    case "configuration": {
      const parts = parseConfiguration(element.configuration);
      const last = parts.filter((p) => p.shell).slice(-1)[0];
      return last ? `${last.shell}${superscript(last.count ?? 0)}` : "";
    }
    case "valency": {
      const v = valenceElectrons(element);
      return v === null ? "—" : String(v);
    }
    case "electronegativity":
      return element.electronegativity === null ? "—" : element.electronegativity.toFixed(2);
    case "state":
      return element.state === "unknown" ? "—" : element.state[0]!.toUpperCase();
  }
}

const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export function superscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUPERSCRIPTS[Number(d)] ?? d)
    .join("");
}

/** Renders "[Ne] 3s² 3p⁴" from the stored "[Ne] 3s2 3p4". */
export function Configuration({ value, className }: { value: string; className?: string }) {
  const parts = parseConfiguration(value);
  return (
    <span className={cn("font-mono", className)}>
      {parts.map((part, i) =>
        part.core ? (
          <span key={i} className="text-muted-foreground">
            [{part.core}]{" "}
          </span>
        ) : (
          <span key={i}>
            {part.shell}
            <sup>{part.count}</sup>{" "}
          </span>
        ),
      )}
    </span>
  );
}

export function ElementCell({
  element,
  property,
  dimmed,
  selected,
  mastery,
  onSelect,
}: {
  element: ChemElement;
  property: CellProperty;
  /** True when a filter is active and this element isn't in it. */
  dimmed?: boolean;
  selected?: boolean;
  mastery?: MasteryState;
  onSelect: (element: ChemElement) => void;
}) {
  const category = CATEGORIES[element.category];
  return (
    <button
      type="button"
      onClick={() => onSelect(element)}
      aria-label={`${element.name}, atomic number ${element.number}, ${category.label}`}
      aria-pressed={selected}
      data-testid={`element-${element.symbol}`}
      className={cn(
        "relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-[4px] border p-0.5 text-center transition-all duration-150",
        "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        category.swatch,
        category.border,
        dimmed ? "opacity-25" : "hover:z-10 hover:scale-[1.12] hover:shadow-md",
        selected && "z-10 ring-2 ring-ring",
      )}
    >
      <span className="text-[0.5rem] leading-none tabular-nums text-muted-foreground">
        {element.number}
      </span>
      <span className={cn("text-[0.8rem] font-bold leading-tight", category.text)}>
        {element.symbol}
      </span>
      <span className="w-full truncate px-0.5 text-[0.4rem] leading-none text-muted-foreground">
        {cellValue(element, property)}
      </span>
      {/*
        Mastery is a corner dot, never a colour change: the cell's colour
        already means "chemical family", and overloading it would destroy the
        one thing the table is for.
      */}
      {mastery && mastery !== "not-started" && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full",
            mastery === "strong"
              ? "bg-success"
              : mastery === "needs-revision"
                ? "bg-warning"
                : "bg-primary",
          )}
        />
      )}
    </button>
  );
}

export function ElementDetail({
  element,
  mastery,
}: {
  element: ChemElement;
  mastery?: MasteryState;
}) {
  const category = CATEGORIES[element.category];
  const shells = shellCounts(element);
  const valence = valenceElectrons(element);
  const group = GROUPS.find((g) => g.group === element.group);

  return (
    <div className="space-y-4">
      <header className={cn("rounded-xl border p-4", category.swatch, category.border)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tabular-nums text-muted-foreground">{element.number}</p>
            <p className={cn("text-4xl font-bold leading-none", category.text)}>{element.symbol}</p>
            <p className="mt-1 text-lg font-semibold">{element.name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {element.massIsIsotope ? "Most stable isotope" : "Atomic mass"}
            </p>
            <p className="text-lg font-bold tabular-nums">
              {element.massIsIsotope ? `(${element.mass})` : element.mass}
            </p>
          </div>
        </div>
        <p className={cn("mt-2 text-xs font-semibold", category.text)}>{category.label}</p>
        {element.synthetic && (
          <p className="mt-1 text-xs text-muted-foreground">
            Made artificially — it does not occur naturally on Earth.
          </p>
        )}
      </header>

      {mastery && (
        <div className={cn("rounded-lg border px-3 py-2 text-xs font-medium", MASTERY_INFO[mastery].className)}>
          {MASTERY_INFO[mastery].label} — {MASTERY_INFO[mastery].hint}
        </div>
      )}

      <Facts
        title="Position"
        icon={Atom}
        rows={[
          ["Group", element.block === "f" ? `${element.group} (f-block)` : String(element.group)],
          ["Period", String(element.period)],
          ["Block", `${element.block}-block`],
        ]}
      />

      <section className="rounded-xl border border-card-border bg-card p-4">
        <h3 className="text-card-title mb-2.5 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Electrons
        </h3>
        <dl className="space-y-2 text-sm">
          <Row label="Configuration">
            <Configuration value={element.configuration} className="text-[0.8125rem]" />
          </Row>
          <Row label="Shells (K, L, M…)">
            <span className="font-mono tabular-nums">{shells.join(", ")}</span>
          </Row>
          {valence !== null && (
            <Row label="Valence electrons">
              <span className="tabular-nums">{valence}</span>
            </Row>
          )}
          <Row label="Protons / electrons">
            <span className="tabular-nums">{element.number}</span>
          </Row>
          <Row label="Neutrons">
            <span className="tabular-nums">{commonNeutrons(element)}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">
              in the {element.massIsIsotope ? "most stable" : "most common"} isotope
            </span>
          </Row>
        </dl>
        {valence === null && element.block !== "f" && (
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            Valence electrons aren&rsquo;t quoted for transition metals — they use several
            oxidation states, so a single number would be misleading.
          </p>
        )}
      </section>

      <Facts
        title="Physical properties"
        icon={Thermometer}
        rows={[
          ["State at 25 °C", element.state === "unknown" ? "Not known" : capitalise(element.state)],
          ["Melting point", element.melt === null ? "Not measured" : `${element.melt} K (${kToC(element.melt)} °C)`],
          ["Boiling point", element.boil === null ? "Not measured" : `${element.boil} K (${kToC(element.boil)} °C)`],
          ["Density", element.density === null ? "Not measured" : `${element.density} g/cm³`],
          [
            "Electronegativity",
            element.electronegativity === null
              ? "No accepted value"
              : `${element.electronegativity} (Pauling)`,
          ],
        ]}
      />

      {group && (
        <section className="rounded-xl border border-card-border bg-card p-4">
          <h3 className="text-card-title mb-2">
            {group.name ?? `Group ${group.group}`}
          </h3>
          <p className="text-sm leading-relaxed text-foreground/90">{group.summary}</p>
        </section>
      )}

      {element.number > 103 && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Only a few atoms of this element have ever existed, for fractions of a second.
          Its physical properties are predicted by theory rather than measured, so they are
          left blank here rather than shown as facts.
        </p>
      )}
    </div>
  );
}

function Facts({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: [string, string][];
}) {
  return (
    <section className="rounded-xl border border-card-border bg-card p-4">
      <h3 className="text-card-title mb-2.5 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {title}
      </h3>
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <Row key={label} label={label}>
            <span className="tabular-nums">{value}</span>
          </Row>
        ))}
      </dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function kToC(k: number): string {
  const c = k - 273.15;
  return (Math.round(c * 10) / 10).toString();
}

function capitalise(s: string): string {
  return s[0]!.toUpperCase() + s.slice(1);
}
