import React from "react";
import { cn } from "@/lib/utils";

/**
 * Diagrams the app draws itself.
 *
 * The rule this file exists to enforce: **the model chooses a diagram and
 * supplies its parameters; it never draws one.** It says "a convex lens,
 * f = 15 cm, object at 30 cm" and this component computes where the image
 * actually forms and plots it. That is the difference between a figure a
 * student can trust and a confident-looking picture with the image on the
 * wrong side of the lens.
 *
 * If a spec is missing values or names a kind we cannot draw, nothing renders.
 * A missing diagram is a small loss; a wrong one is taught and remembered.
 *
 * Mermaid still handles free-form flowcharts and mind maps elsewhere
 * (components/hub/DiagramRenderer). These five are the cases where the
 * geometry has to be right, not merely plausible.
 */

export interface SchematicSpec {
  kind: string;
  caption?: string;
  spec?: unknown;
}

const AXIS = "hsl(var(--muted-foreground))";
const INK = "hsl(var(--foreground))";
const ACCENT = "hsl(var(--primary))";
const SUCCESS = "hsl(var(--success))";
const WARN = "hsl(var(--warning))";

function Figure({
  caption,
  label,
  children,
  className,
}: {
  caption?: string;
  /** Read out instead of the picture. Never optional — this is the alt text. */
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("overflow-hidden rounded-xl border border-card-border bg-card", className)}>
      <div className="overflow-x-auto p-3">
        <div role="img" aria-label={label} className="mx-auto min-w-[18rem] max-w-full">
          {children}
        </div>
      </div>
      {caption && (
        <figcaption className="border-t border-card-border px-4 py-2 text-center text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

// ── flow ─────────────────────────────────────────────────────────────────────

function FlowDiagram({ steps, caption }: { steps: string[]; caption?: string }) {
  if (steps.length < 2) return null;
  const boxW = 190;
  const boxH = 56;
  const gap = 26;
  const height = steps.length * boxH + (steps.length - 1) * gap + 8;

  return (
    <Figure caption={caption} label={`Flow diagram: ${steps.join(", then ")}`}>
      <svg viewBox={`0 0 ${boxW + 8} ${height}`} className="h-auto w-full max-w-sm">
        {steps.map((step, i) => {
          const y = i * (boxH + gap) + 4;
          return (
            <g key={i}>
              <rect
                x={4}
                y={y}
                width={boxW}
                height={boxH}
                rx={10}
                fill="hsl(var(--muted))"
                stroke={AXIS}
                strokeOpacity={0.4}
              />
              <text
                x={4 + boxW / 2}
                y={y + boxH / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={INK}
                fontSize={11}
                fontWeight={600}
              >
                {wrap(step, 28).map((line, j, all) => (
                  <tspan key={j} x={4 + boxW / 2} dy={j === 0 ? -(all.length - 1) * 6 : 13}>
                    {line}
                  </tspan>
                ))}
              </text>
              {i < steps.length - 1 && (
                <g stroke={ACCENT} strokeWidth={1.6} fill="none">
                  <line x1={4 + boxW / 2} y1={y + boxH} x2={4 + boxW / 2} y2={y + boxH + gap - 7} />
                  <path
                    d={`M${4 + boxW / 2 - 4},${y + boxH + gap - 8} L${4 + boxW / 2},${y + boxH + gap - 1} L${4 + boxW / 2 + 4},${y + boxH + gap - 8}`}
                    fill={ACCENT}
                    stroke="none"
                  />
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </Figure>
  );
}

// ── cycle ────────────────────────────────────────────────────────────────────

function CycleDiagram({ steps, caption }: { steps: string[]; caption?: string }) {
  if (steps.length < 3 || steps.length > 8) return null;
  const size = 320;
  const c = size / 2;
  const r = 108;

  return (
    <Figure caption={caption} label={`Cycle: ${steps.join(" → ")}, returning to ${steps[0]}`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full max-w-sm">
        <circle cx={c} cy={c} r={r} fill="none" stroke={AXIS} strokeOpacity={0.3} strokeDasharray="4 5" />
        {steps.map((step, i) => {
          const angle = (i / steps.length) * Math.PI * 2 - Math.PI / 2;
          const x = c + Math.cos(angle) * r;
          const y = c + Math.sin(angle) * r;
          // Arrowhead a little further round the circle, pointing the way the
          // cycle runs — a ring with no direction teaches nothing.
          const next = ((i + 0.5) / steps.length) * Math.PI * 2 - Math.PI / 2;
          const ax = c + Math.cos(next) * r;
          const ay = c + Math.sin(next) * r;
          const tangent = next + Math.PI / 2;
          return (
            <g key={i}>
              <path
                d={`M${ax - Math.cos(tangent) * 5 - Math.cos(next) * 4},${ay - Math.sin(tangent) * 5 - Math.sin(next) * 4} L${ax + Math.cos(tangent) * 6},${ay + Math.sin(tangent) * 6} L${ax - Math.cos(tangent) * 5 + Math.cos(next) * 4},${ay - Math.sin(tangent) * 5 + Math.sin(next) * 4}`}
                fill={ACCENT}
              />
              <circle cx={x} cy={y} r={26} fill="hsl(var(--card))" stroke={ACCENT} strokeOpacity={0.5} />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={INK}
                fontSize={9.5}
                fontWeight={600}
              >
                {wrap(step, 12).slice(0, 3).map((line, j, all) => (
                  <tspan key={j} x={x} dy={j === 0 ? -(all.length - 1) * 5 : 11}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>
    </Figure>
  );
}

// ── axes ─────────────────────────────────────────────────────────────────────

interface AxesSpec {
  xLabel?: string;
  yLabel?: string;
  points: [number, number][];
  line?: boolean;
}

function AxesDiagram({ spec, caption }: { spec: AxesSpec; caption?: string }) {
  const points = (spec.points ?? []).filter(
    (p): p is [number, number] =>
      Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),
  );
  if (points.length < 2) return null;

  const W = 340;
  const H = 230;
  const pad = { l: 46, r: 14, t: 14, b: 38 };
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  // Always include the origin: a V–I graph that doesn't show it hides the
  // whole point of the relationship being proportional.
  const xMax = Math.max(...xs, 0) || 1;
  const yMax = Math.max(...ys, 0) || 1;
  const xMin = Math.min(...xs, 0);
  const yMin = Math.min(...ys, 0);

  const sx = (x: number) => pad.l + ((x - xMin) / (xMax - xMin || 1)) * (W - pad.l - pad.r);
  const sy = (y: number) => H - pad.b - ((y - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b);

  const path = points
    .slice()
    .sort((a, b) => a[0] - b[0])
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`)
    .join(" ");

  return (
    <Figure
      caption={caption}
      label={`Graph of ${spec.yLabel ?? "y"} against ${spec.xLabel ?? "x"}, through ${points
        .map(([x, y]) => `(${x}, ${y})`)
        .join(", ")}`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-md">
        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke={AXIS} strokeWidth={1.2} />
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke={AXIS} strokeWidth={1.2} />

        {spec.line !== false && <path d={path} fill="none" stroke={ACCENT} strokeWidth={2} />}
        {points.map(([x, y], i) => (
          <circle key={i} cx={sx(x)} cy={sy(y)} r={3.2} fill={ACCENT} />
        ))}

        <text x={(W + pad.l) / 2} y={H - 8} textAnchor="middle" fill={AXIS} fontSize={11}>
          {spec.xLabel ?? "x"}
        </text>
        <text
          x={12}
          y={(H - pad.b + pad.t) / 2}
          textAnchor="middle"
          fill={AXIS}
          fontSize={11}
          transform={`rotate(-90 12 ${(H - pad.b + pad.t) / 2})`}
        >
          {spec.yLabel ?? "y"}
        </text>
        <text x={pad.l - 6} y={H - pad.b + 4} textAnchor="end" fill={AXIS} fontSize={9}>
          {trimNumber(Math.max(xMin, yMin))}
        </text>
        <text x={W - pad.r} y={H - pad.b + 14} textAnchor="end" fill={AXIS} fontSize={9}>
          {trimNumber(xMax)}
        </text>
        <text x={pad.l - 6} y={pad.t + 6} textAnchor="end" fill={AXIS} fontSize={9}>
          {trimNumber(yMax)}
        </text>
      </svg>
    </Figure>
  );
}

// ── circuit ──────────────────────────────────────────────────────────────────

interface CircuitSpec {
  arrangement?: string;
  cellVolts?: number;
  resistors?: { label?: string; ohms?: number }[];
}

/**
 * A series or parallel resistor circuit, drawn to match the numbers.
 *
 * The equivalent resistance and total current shown underneath are computed
 * here, from the component values — not taken from the model. If the two ever
 * disagreed, the picture would be the one a student believed.
 */
function CircuitDiagram({ spec, caption }: { spec: CircuitSpec; caption?: string }) {
  const resistors = (spec.resistors ?? [])
    .map((r, i) => ({
      label: (r.label ?? `R${i + 1}`).toString().slice(0, 6),
      ohms: Number(r.ohms),
    }))
    .filter((r) => Number.isFinite(r.ohms) && r.ohms > 0)
    .slice(0, 4);
  if (resistors.length === 0) return null;

  const parallel = String(spec.arrangement).toLowerCase() === "parallel";
  const volts = Number.isFinite(Number(spec.cellVolts)) ? Number(spec.cellVolts) : null;

  const req = parallel
    ? 1 / resistors.reduce((sum, r) => sum + 1 / r.ohms, 0)
    : resistors.reduce((sum, r) => sum + r.ohms, 0);
  const current = volts !== null && req > 0 ? volts / req : null;

  const W = 340;
  const rowH = 46;
  const H = parallel ? 90 + resistors.length * rowH : 150;

  const summary = `${parallel ? "Parallel" : "Series"} circuit: ${resistors
    .map((r) => `${r.label} = ${trimNumber(r.ohms)} ohms`)
    .join(", ")}${volts !== null ? `, cell ${trimNumber(volts)} volts` : ""}. Equivalent resistance ${trimNumber(req)} ohms${
    current !== null ? `, total current ${trimNumber(current)} amperes` : ""
  }.`;

  return (
    <Figure caption={caption} label={summary}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-md">
        <g stroke={INK} strokeWidth={1.5} fill="none" strokeLinecap="square">
          {parallel ? (
            <>
              <line x1={30} y1={40} x2={30} y2={40 + (resistors.length - 1) * rowH} />
              <line x1={310} y1={40} x2={310} y2={40 + (resistors.length - 1) * rowH} />
              {resistors.map((_, i) => (
                <g key={i}>
                  <line x1={30} y1={40 + i * rowH} x2={140} y2={40 + i * rowH} />
                  <line x1={200} y1={40 + i * rowH} x2={310} y2={40 + i * rowH} />
                </g>
              ))}
              <line x1={30} y1={40} x2={30} y2={22} />
              <line x1={310} y1={40} x2={310} y2={22} />
              <line x1={30} y1={22} x2={150} y2={22} />
              <line x1={190} y1={22} x2={310} y2={22} />
            </>
          ) : (
            <>
              <line x1={30} y1={40} x2={30} y2={110} />
              <line x1={310} y1={40} x2={310} y2={110} />
              <line x1={30} y1={110} x2={150} y2={110} />
              <line x1={190} y1={110} x2={310} y2={110} />
              <line x1={30} y1={40} x2={40} y2={40} />
              <line x1={300} y1={40} x2={310} y2={40} />
            </>
          )}
        </g>

        {/* Cell */}
        <g stroke={INK} strokeWidth={1.6}>
          <line x1={150} y1={parallel ? 14 : 102} x2={150} y2={parallel ? 30 : 118} />
          <line x1={162} y1={parallel ? 8 : 96} x2={162} y2={parallel ? 36 : 124} strokeWidth={2.6} />
          <line x1={162} y1={parallel ? 22 : 110} x2={190} y2={parallel ? 22 : 110} />
        </g>
        {volts !== null && (
          <text x={170} y={parallel ? 50 : 138} textAnchor="middle" fill={AXIS} fontSize={10}>
            {trimNumber(volts)} V
          </text>
        )}

        {/* Resistors */}
        {resistors.map((r, i) => {
          const y = parallel ? 40 + i * rowH : 40;
          const x = parallel ? 140 : 40 + i * (260 / resistors.length);
          const w = parallel ? 60 : 260 / resistors.length - 14;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y - 9}
                width={w}
                height={18}
                rx={3}
                fill="hsl(var(--card))"
                stroke={ACCENT}
                strokeWidth={1.5}
              />
              {!parallel && i < resistors.length - 1 && (
                <line
                  x1={x + w}
                  y1={y}
                  x2={x + 260 / resistors.length}
                  y2={y}
                  stroke={INK}
                  strokeWidth={1.5}
                />
              )}
              <text x={x + w / 2} y={y - 14} textAnchor="middle" fill={INK} fontSize={10} fontWeight={600}>
                {r.label}
              </text>
              <text x={x + w / 2} y={y + 22} textAnchor="middle" fill={AXIS} fontSize={9.5}>
                {trimNumber(r.ohms)} Ω
              </text>
            </g>
          );
        })}
      </svg>

      <p className="px-4 pb-1 text-center text-xs text-muted-foreground">
        R<sub>eq</sub> = {trimNumber(req)} Ω
        {current !== null ? <> · I = {trimNumber(current)} A</> : null}
      </p>
    </Figure>
  );
}

// ── ray ──────────────────────────────────────────────────────────────────────

interface RaySpec {
  optic?: string;
  focalLengthCm?: number;
  objectDistanceCm?: number;
  objectHeightCm?: number;
}

const OPTICS = ["concave-mirror", "convex-mirror", "convex-lens", "concave-lens"] as const;
type Optic = (typeof OPTICS)[number];

/**
 * Solves the mirror or lens equation, then draws the result.
 *
 * NCERT sign convention: distances are measured from the pole/optical centre,
 * and the direction of incident light is positive. Light travels left to
 * right, so the object distance u is always negative.
 *
 *   mirrors: 1/v + 1/u = 1/f,  m = −v/u,  f = −F for concave, +F for convex
 *   lenses:  1/v − 1/u = 1/f,  m =  v/u,  f = +F for convex,  −F for concave
 *
 * A real image lands on the same side as the object for a mirror (v < 0) and
 * on the far side for a lens (v > 0). Both plot at x = v in one coordinate
 * frame where positive is to the right, which is why the drawing code below
 * needs no special case for the two families.
 */
function solveOptic(optic: Optic, F: number, U: number) {
  const u = -Math.abs(U);
  const isMirror = optic.endsWith("mirror");
  const f = optic === "concave-mirror" || optic === "concave-lens" ? -Math.abs(F) : Math.abs(F);

  // At the focus the image is at infinity; there is nothing to draw.
  const invV = isMirror ? 1 / f - 1 / u : 1 / f + 1 / u;
  if (!Number.isFinite(invV) || Math.abs(invV) < 1e-9) return null;

  const v = 1 / invV;
  const m = isMirror ? -v / u : v / u;
  return { u, v, f, m, isMirror };
}

function RayDiagram({ spec, caption }: { spec: RaySpec; caption?: string }) {
  const optic = (OPTICS as readonly string[]).includes(String(spec.optic))
    ? (spec.optic as Optic)
    : null;
  const F = Number(spec.focalLengthCm);
  const U = Number(spec.objectDistanceCm);
  const hObj = Number.isFinite(Number(spec.objectHeightCm)) ? Math.abs(Number(spec.objectHeightCm)) : 4;

  if (!optic || !Number.isFinite(F) || !Number.isFinite(U) || F <= 0 || U <= 0) return null;
  const solved = solveOptic(optic, F, U);
  if (!solved) return null;

  const { v, m } = solved;
  const hImg = m * hObj;
  const real = solved.isMirror ? v < 0 : v > 0;

  const W = 380;
  const H = 220;
  const cx = W / 2;
  const cy = H / 2;

  // One scale for both axes so the geometry stays honest, sized so everything
  // that must appear actually fits.
  const spanX = Math.max(Math.abs(v), U, F * 2) * 1.15;
  const spanY = Math.max(Math.abs(hImg), hObj) * 1.6;
  const kx = (W / 2 - 24) / spanX;
  const ky = Math.min(kx, (H / 2 - 20) / (spanY || 1));

  const X = (cm: number) => cx + cm * kx;
  const Y = (cm: number) => cy - cm * ky;

  const objX = X(-U);
  const imgX = X(v);
  const fRight = X(optic === "concave-mirror" ? -F : optic === "concave-lens" ? -F : F);
  const fLeft = X(optic === "concave-mirror" ? -F : optic === "concave-lens" ? F : -F);

  const nature = `${real ? "real" : "virtual"}, ${hImg < 0 ? "inverted" : "erect"}, ${
    Math.abs(m) > 1.02 ? "enlarged" : Math.abs(m) < 0.98 ? "diminished" : "same size"
  }`;

  return (
    <Figure
      caption={caption}
      label={`Ray diagram for a ${optic.replace("-", " ")} of focal length ${trimNumber(F)} centimetres with the object at ${trimNumber(U)} centimetres. The image forms at ${trimNumber(Math.abs(v))} centimetres and is ${nature}.`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-md">
        {/* Principal axis */}
        <line x1={10} y1={cy} x2={W - 10} y2={cy} stroke={AXIS} strokeWidth={1} strokeDasharray="3 4" />

        {/* The optic */}
        {solved.isMirror ? (
          <path
            d={
              optic === "concave-mirror"
                ? `M${cx + 12},${cy - 62} Q${cx - 14},${cy} ${cx + 12},${cy + 62}`
                : `M${cx - 12},${cy - 62} Q${cx + 14},${cy} ${cx - 12},${cy + 62}`
            }
            fill="none"
            stroke={INK}
            strokeWidth={2.4}
          />
        ) : (
          <g stroke={INK} strokeWidth={2} fill="none">
            <ellipse
              cx={cx}
              cy={cy}
              rx={optic === "convex-lens" ? 11 : 5}
              ry={58}
              fill="hsl(var(--primary) / 0.08)"
            />
            {optic === "concave-lens" && (
              <>
                <line x1={cx - 11} y1={cy - 58} x2={cx + 11} y2={cy - 58} />
                <line x1={cx - 11} y1={cy + 58} x2={cx + 11} y2={cy + 58} />
              </>
            )}
          </g>
        )}

        {/* Focal points */}
        {[fLeft, fRight].map((fx, i) => (
          <g key={i}>
            <circle cx={fx} cy={cy} r={2.4} fill={AXIS} />
            <text x={fx} y={cy + 15} textAnchor="middle" fill={AXIS} fontSize={9}>
              F
            </text>
          </g>
        ))}

        {/* Object */}
        <g stroke={SUCCESS} strokeWidth={2.4}>
          <line x1={objX} y1={cy} x2={objX} y2={Y(hObj)} />
          <path d={`M${objX - 4},${Y(hObj) + 6} L${objX},${Y(hObj)} L${objX + 4},${Y(hObj) + 6}`} fill={SUCCESS} stroke="none" />
        </g>
        <text x={objX} y={Y(hObj) - 6} textAnchor="middle" fill={SUCCESS} fontSize={9.5} fontWeight={600}>
          Object
        </text>

        {/* Ray 1: parallel to the axis, then through (or from) the focus. */}
        <g stroke={ACCENT} strokeWidth={1.5} fill="none">
          <line x1={objX} y1={Y(hObj)} x2={cx} y2={Y(hObj)} />
          <line x1={cx} y1={Y(hObj)} x2={imgX} y2={Y(hImg)} />
          {/* Ray 2: through the optical centre / pole, undeviated. */}
          <line x1={objX} y1={Y(hObj)} x2={imgX} y2={Y(hImg)} strokeDasharray="1 0" />
        </g>

        {/* Image */}
        <g stroke={WARN} strokeWidth={2.4} strokeDasharray={real ? undefined : "4 3"}>
          <line x1={imgX} y1={cy} x2={imgX} y2={Y(hImg)} />
          <path
            d={`M${imgX - 4},${Y(hImg) + (hImg >= 0 ? 6 : -6)} L${imgX},${Y(hImg)} L${imgX + 4},${Y(hImg) + (hImg >= 0 ? 6 : -6)}`}
            fill={WARN}
            stroke="none"
          />
        </g>
        <text
          x={imgX}
          y={hImg >= 0 ? Y(hImg) - 6 : Y(hImg) + 14}
          textAnchor="middle"
          fill={WARN}
          fontSize={9.5}
          fontWeight={600}
        >
          Image
        </text>
      </svg>

      <p className="px-4 pb-1 text-center text-xs text-muted-foreground">
        v = {trimNumber(v)} cm · m = {trimNumber(m)} · image is {nature}
      </p>
    </Figure>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function wrap(text: string, max: number): string[] {
  const words = String(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function trimNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, "");
}

// ── entry point ──────────────────────────────────────────────────────────────

export function Schematic({ diagram }: { diagram: SchematicSpec | null | undefined }) {
  if (!diagram?.spec || typeof diagram.spec !== "object") return null;
  const spec = diagram.spec as Record<string, unknown>;
  const caption = diagram.caption;

  switch (diagram.kind) {
    case "flow": {
      const steps = Array.isArray(spec.steps) ? spec.steps.map(String).filter(Boolean) : [];
      return <FlowDiagram steps={steps.slice(0, 7)} caption={caption} />;
    }
    case "cycle": {
      const steps = Array.isArray(spec.steps) ? spec.steps.map(String).filter(Boolean) : [];
      return <CycleDiagram steps={steps.slice(0, 8)} caption={caption} />;
    }
    case "axes":
      return <AxesDiagram spec={spec as unknown as AxesSpec} caption={caption} />;
    case "circuit":
      return <CircuitDiagram spec={spec as unknown as CircuitSpec} caption={caption} />;
    case "ray":
      return <RayDiagram spec={spec as unknown as RaySpec} caption={caption} />;
    default:
      // A kind we cannot draw correctly renders nothing at all.
      return null;
  }
}
