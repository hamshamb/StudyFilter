import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SubjectId } from "@workspace/cbse-content";
import type { AccentStyle } from "../hub/accents";

/**
 * A self-contained, original explanatory animation for one chapter or topic.
 *
 * Every scene is driven by a single `step` index supplied by the parent
 * AnimatedExplainer. Scenes never auto-run on their own — when `reduced` is
 * true they must render a meaningful, motion-free final state so the content is
 * still fully understandable for users who prefer reduced motion.
 */
export interface ExplainerScene {
  /** Short, learner-facing title. */
  title: string;
  /** One-line description of what the animation shows. */
  blurb: string;
  /** Per-beat captions; length defines the number of steps. */
  steps: string[];
  /** The animated visual. */
  Visual: React.ComponentType<VisualProps>;
}

export interface VisualProps {
  step: number;
  reduced: boolean;
  accent: AccentStyle;
}

const EASE = [0.22, 1, 0.36, 1] as const;

// ── Shared helpers ───────────────────────────────────────────────────────────

function ProcessNode({
  active,
  reduced,
  children,
  tone,
}: {
  active: boolean;
  reduced: boolean;
  children: React.ReactNode;
  tone: string;
}) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: active ? 1 : 0.25, scale: active ? 1 : 0.96 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={`rounded-lg border px-2.5 py-1.5 text-center text-xs font-semibold ${tone}`}
    >
      {children}
    </motion.div>
  );
}

function FlowDot({
  reduced,
  delay,
  reverse,
}: {
  reduced: boolean;
  delay: number;
  reverse?: boolean;
}) {
  if (reduced) {
    return <span className="h-2 w-2 rounded-full bg-current opacity-70" />;
  }
  return (
    <motion.span
      className="h-2 w-2 rounded-full bg-current"
      initial={{ opacity: 0 }}
      animate={{
        x: reverse ? [12, -12] : [-12, 12],
        opacity: [0, 1, 1, 0],
      }}
      transition={{ duration: 1.6, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}

// ── Mathematics — animated equation solving ─────────────────────────────────
const EQUATION_LINES = ["2x + 3 = 11", "2x = 11 − 3", "2x = 8", "x = 4"];

function MathsVisual({ step, reduced, accent }: VisualProps) {
  const i = reduced ? EQUATION_LINES.length - 1 : step;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6">
      <div className="relative flex h-20 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={reduced ? "static" : i}
            initial={reduced ? false : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: 0.45, ease: EASE }}
            className={`font-mono text-4xl font-bold tracking-tight sm:text-5xl ${
              i === EQUATION_LINES.length - 1 ? accent.text : "text-foreground"
            }`}
          >
            {EQUATION_LINES[i]}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-1.5">
        {EQUATION_LINES.map((_, idx) => (
          <span
            key={idx}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx <= i ? `w-8 ${accent.solid}` : "w-3 bg-muted"
            }`}
          />
        ))}
      </div>
      {reduced ? (
        <div className="space-y-1 text-center font-mono text-sm text-muted-foreground">
          {EQUATION_LINES.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Mathematics — quadratic equation roots on a parabola ─────────────────────
function QuadraticVisual({ step, reduced, accent }: VisualProps) {
  const showEquation = reduced || step >= 0;
  const showParabola = reduced || step >= 1;
  const showRoots = reduced || step >= 2;
  const showFactors = reduced || step >= 3;

  const W = 320;
  const H = 180;
  const cx = W / 2;
  const baseline = H - 20;
  const scaleX = 35;
  const scaleY = 18;

  const parabola = Array.from({ length: 41 }, (_, i) => {
    const x = (i - 20) / 5;
    const y = x * x - 5 * x + 6;
    return { sx: cx + x * scaleX, sy: baseline - y * scaleY };
  });
  const path = parabola
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`)
    .join(" ");

  const root1x = cx + 2 * scaleX;
  const root2x = cx + 3 * scaleX;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3">
      <AnimatePresence mode="wait">
        {showEquation && (
          <motion.p
            key="eq"
            initial={reduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className={`font-mono text-lg font-bold ${accent.text}`}
          >
            x² − 5x + 6 = 0
          </motion.p>
        )}
      </AnimatePresence>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xs">
        <line
          x1="20"
          y1={baseline}
          x2={W - 10}
          y2={baseline}
          className="stroke-muted"
          strokeWidth="2"
        />

        {showParabola && (
          <motion.path
            d={path}
            fill="none"
            className={accent.text}
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
          />
        )}

        {showRoots && (
          <>
            <motion.circle
              cx={root1x}
              cy={baseline}
              r="6"
              className={accent.text}
              fill="currentColor"
              initial={reduced ? false : { scale: 0, transformOrigin: `${root1x}px ${baseline}px` }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.35, ease: EASE }}
            />
            <motion.circle
              cx={root2x}
              cy={baseline}
              r="6"
              className={accent.text}
              fill="currentColor"
              initial={reduced ? false : { scale: 0, transformOrigin: `${root2x}px ${baseline}px` }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.35, delay: 0.15, ease: EASE }}
            />
            <text
              x={root1x}
              y={baseline + 16}
              textAnchor="middle"
              className="fill-foreground text-[10px] font-bold"
              fontSize="10"
              fontWeight="bold"
            >
              x=2
            </text>
            <text
              x={root2x}
              y={baseline + 16}
              textAnchor="middle"
              className="fill-foreground text-[10px] font-bold"
              fontSize="10"
              fontWeight="bold"
            >
              x=3
            </text>
          </>
        )}
      </svg>

      {showFactors && (
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="font-mono text-sm font-semibold text-muted-foreground"
        >
          (x − 2)(x − 3) = 0
        </motion.p>
      )}
    </div>
  );
}

// ── Science — photosynthesis process flow ───────────────────────────────────
const SCIENCE_INPUTS = ["Sunlight", "Water (H₂O)", "Carbon dioxide (CO₂)"];
const SCIENCE_OUTPUTS = ["Glucose (food)", "Oxygen (O₂)"];

function ScienceVisual({ step, reduced, accent }: VisualProps) {
  const showInputs = reduced || step >= 1;
  const showConvert = reduced || step >= 2;
  const showOutputs = reduced || step >= 3;
  return (
    <div className="flex h-full w-full items-center justify-center gap-2 px-2 sm:gap-4">
      <div className="flex flex-col gap-2">
        {SCIENCE_INPUTS.map((label, idx) => (
          <ProcessNode
            key={label}
            active={reduced || step >= (idx === 0 ? 0 : 1)}
            reduced={reduced}
            tone="border-warning/30 bg-warning-soft text-warning"
          >
            {label}
          </ProcessNode>
        ))}
      </div>

      <div
        className={`flex items-center ${accent.text}`}
        style={{ opacity: showInputs ? 1 : 0.2 }}
      >
        <div className="flex gap-1">
          <FlowDot reduced={reduced} delay={0} />
          <FlowDot reduced={reduced} delay={0.5} />
        </div>
      </div>

      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.85 }}
        animate={{
          opacity: showConvert ? 1 : 0.3,
          scale: showConvert ? 1 : 0.9,
        }}
        transition={{ duration: 0.45, ease: EASE }}
        className={`relative flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-xl border-2 text-center ${accent.border} ${accent.soft}`}
      >
        {showConvert && !reduced ? (
          <motion.span
            className={`absolute inset-0 rounded-xl ${accent.solid} opacity-20`}
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        ) : null}
        <span className={`relative text-xs font-bold ${accent.text}`}>Leaf</span>
        <span className="relative text-[10px] font-semibold text-muted-foreground">
          chlorophyll
        </span>
      </motion.div>

      <div
        className={`flex items-center ${accent.text}`}
        style={{ opacity: showOutputs ? 1 : 0.2 }}
      >
        <div className="flex gap-1">
          <FlowDot reduced={reduced} delay={0.2} />
          <FlowDot reduced={reduced} delay={0.7} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {SCIENCE_OUTPUTS.map((label) => (
          <ProcessNode
            key={label}
            active={showOutputs}
            reduced={reduced}
            tone="border-success/30 bg-success-soft text-success"
          >
            {label}
          </ProcessNode>
        ))}
      </div>
    </div>
  );
}

// ── Science — Light: Reflection & Refraction ─────────────────────────────────
function RefractionVisual({ step, reduced, accent }: VisualProps) {
  const showIncident = reduced || step >= 0;
  const showNormal = reduced || step >= 1;
  const showReflected = reduced || step >= 2;
  const showRefracted = reduced || step >= 3;

  const W = 300;
  const H = 200;
  const surfaceY = H / 2;
  const cx = W / 2;

  const incidentFrom = { x: cx - 80, y: 20 };
  const incidentTo = { x: cx, y: surfaceY };
  const reflectedTo = { x: cx + 80, y: 20 };
  const refractedTo = { x: cx + 50, y: H - 20 };

  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xs">
        <rect
          x="0"
          y={surfaceY}
          width={W}
          height={H - surfaceY}
          className="fill-primary"
          rx="0"
        />
        <line
          x1="0"
          y1={surfaceY}
          x2={W}
          y2={surfaceY}
          className="stroke-border"
          strokeWidth="2"
          strokeDasharray="6 3"
        />
        <text
          x={W - 8}
          y={surfaceY - 6}
          textAnchor="end"
          fontSize="9"
          className="fill-muted-foreground"
        >
          Air
        </text>
        <text
          x={W - 8}
          y={surfaceY + 14}
          textAnchor="end"
          fontSize="9"
          className="fill-muted-foreground"
        >
          Glass
        </text>

        {showNormal && (
          <line
            x1={cx}
            y1={surfaceY - 60}
            x2={cx}
            y2={surfaceY + 60}
            strokeWidth="1"
            strokeDasharray="4 3"
            className="stroke-muted-foreground"
          />
        )}

        {showIncident && (
          <motion.line
            x1={incidentFrom.x}
            y1={incidentFrom.y}
            x2={incidentTo.x}
            y2={incidentTo.y}
            stroke="currentColor"
            className={accent.text}
            strokeWidth="2.5"
            strokeLinecap="round"
            markerEnd="url(#arrowhead)"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
          />
        )}

        {showReflected && (
          <motion.line
            x1={incidentTo.x}
            y1={incidentTo.y}
            x2={reflectedTo.x}
            y2={reflectedTo.y}
            stroke="currentColor"
            className={accent.text}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="6 3"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
          />
        )}

        {showRefracted && (
          <motion.line
            x1={incidentTo.x}
            y1={incidentTo.y}
            x2={refractedTo.x}
            y2={refractedTo.y}
            stroke="currentColor"
            className="text-warning"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.2, ease: EASE }}
          />
        )}

        {showIncident && (
          <text x={incidentFrom.x + 4} y={incidentFrom.y + 14} fontSize="9" className="fill-foreground font-semibold">
            Incident ray
          </text>
        )}
        {showReflected && (
          <text x={reflectedTo.x - 4} y={reflectedTo.y + 14} textAnchor="end" fontSize="9" className="fill-foreground font-semibold">
            Reflected
          </text>
        )}
        {showRefracted && (
          <text x={refractedTo.x + 4} y={refractedTo.y - 4} fontSize="9" className="fill-warning font-semibold">
            Refracted
          </text>
        )}

        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" className={accent.text} fill="currentColor" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}

// ── Science — Electricity: circuit current flow ───────────────────────────────
function ElectricityVisual({ step, reduced, accent }: VisualProps) {
  const showCircuit = reduced || step >= 0;
  const showFlow = reduced || step >= 1;
  const showBulb = reduced || step >= 2;
  const showLabel = reduced || step >= 3;

  const W = 280;
  const H = 180;
  const left = 40;
  const right = W - 40;
  const top = 30;
  const bottom = H - 30;
  const midY = H / 2;

  const bulbX = (left + right) / 2;

  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xs">
        {showCircuit && (
          <>
            <line x1={left} y1={top} x2={right} y2={top} className="stroke-border" strokeWidth="2.5" strokeLinecap="round" />
            <line x1={right} y1={top} x2={right} y2={bottom} className="stroke-border" strokeWidth="2.5" strokeLinecap="round" />
            <line x1={right} y1={bottom} x2={left} y2={bottom} className="stroke-border" strokeWidth="2.5" strokeLinecap="round" />
            <line x1={left} y1={bottom} x2={left} y2={midY + 18} className="stroke-border" strokeWidth="2.5" strokeLinecap="round" />
            <line x1={left} y1={midY - 18} x2={left} y2={top} className="stroke-border" strokeWidth="2.5" strokeLinecap="round" />

            <rect
              x={left - 14}
              y={midY - 18}
              width="28"
              height="36"
              rx="4"
              className={`${accent.soft} ${accent.border}`}
              strokeWidth="1.5"
              stroke="currentColor"
            />
            <text x={left} y={midY + 4} textAnchor="middle" fontSize="8" className={`font-bold ${accent.text}`} fill="currentColor">
              BAT
            </text>
          </>
        )}

        {showBulb && (
          <>
            <motion.circle
              cx={bulbX}
              cy={top}
              r="12"
              className="fill-warning stroke-warning"
              strokeWidth="2"
              animate={showBulb && !reduced ? { opacity: [0.6, 1, 0.6] } : { opacity: 1 }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <text x={bulbX} y={top + 4} textAnchor="middle" fontSize="10" className="fill-warning font-bold">
              ☀
            </text>
          </>
        )}

        {showFlow && !reduced && (
          <>
            <motion.circle
              cx={left}
              cy={top}
              r="4"
              className={accent.text}
              fill="currentColor"
              animate={{
                cx: [left, right, right, left, left],
                cy: [top, top, bottom, bottom, top],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <motion.circle
              cx={left}
              cy={bottom}
              r="4"
              className={accent.text}
              fill="currentColor"
              opacity="0.6"
              animate={{
                cx: [right, right, left, left, right],
                cy: [top, bottom, bottom, top, top],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 1.5 }}
            />
          </>
        )}

        {showFlow && reduced && (
          <>
            <circle cx={left + 40} cy={top} r="4" className={accent.text} fill="currentColor" />
            <circle cx={right - 20} cy={top} r="4" className={accent.text} fill="currentColor" opacity="0.6" />
            <circle cx={right} cy={midY} r="4" className={accent.text} fill="currentColor" opacity="0.4" />
          </>
        )}

        {showLabel && (
          <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="9" className="fill-muted-foreground">
            Conventional current flows + → −
          </text>
        )}
      </svg>
    </div>
  );
}

// ── Social Science — timeline of events ─────────────────────────────────────
const TIMELINE = [
  { year: "1789", label: "French Revolution" },
  { year: "1830s", label: "Spread of liberalism" },
  { year: "1848", label: "Year of revolutions" },
  { year: "1871", label: "Unification of Germany" },
];

function SocialVisual({ step, reduced, accent }: VisualProps) {
  const reached = reduced ? TIMELINE.length - 1 : step;
  const fill = ((reached + 1) / TIMELINE.length) * 100;
  return (
    <div className="flex h-full w-full items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
        <motion.div
          className={`absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full ${accent.solid}`}
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${fill}%` }}
          transition={{ duration: 0.5, ease: EASE }}
        />
        <div className="relative flex justify-between">
          {TIMELINE.map((event, idx) => {
            const on = idx <= reached;
            return (
              <div
                key={event.year}
                className="flex w-1/4 flex-col items-center"
              >
                <p
                  className={`mb-2 h-8 text-center text-xs font-bold transition-opacity duration-300 ${
                    on ? accent.text : "opacity-0"
                  }`}
                >
                  {event.year}
                </p>
                <motion.span
                  initial={reduced ? false : { scale: 0 }}
                  animate={{ scale: on ? 1 : 0.4, opacity: on ? 1 : 0.4 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className={`h-4 w-4 rounded-full border-2 border-background ${
                    on ? accent.solid : "bg-muted"
                  }`}
                />
                <p
                  className={`mt-2 h-10 text-center text-[11px] font-medium leading-tight transition-opacity duration-300 ${
                    on ? "text-foreground" : "opacity-30"
                  }`}
                >
                  {event.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Social Science — Nationalism in India: cause-effect ──────────────────────
const INDIA_EVENTS = [
  { cause: "Rowlatt Act (1919)", effect: "Mass outrage & protests" },
  { cause: "Non-Cooperation (1920)", effect: "Boycott of British goods" },
  { cause: "Civil Disobedience (1930)", effect: "Salt March defiance" },
  { cause: "Quit India (1942)", effect: "Mass arrests & independence push" },
];

function NationalismIndiaVisual({ step, reduced, accent }: VisualProps) {
  const reached = reduced ? INDIA_EVENTS.length - 1 : step;
  return (
    <div className="flex h-full w-full flex-col justify-center gap-2 overflow-hidden px-3">
      {INDIA_EVENTS.map((ev, idx) => {
        const on = idx <= reached;
        return (
          <motion.div
            key={ev.cause}
            initial={reduced ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: on ? 1 : 0.2, x: 0 }}
            transition={{ duration: 0.4, delay: reduced ? 0 : idx * 0.05, ease: EASE }}
            className="flex items-center gap-2 text-xs"
          >
            <span
              className={`shrink-0 rounded-md px-2 py-1 font-semibold ${
                on
                  ? `${accent.soft} ${accent.text}`
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {ev.cause}
            </span>
            <span
              className={`shrink-0 font-bold transition-colors ${
                on ? accent.text : "text-muted-foreground"
              }`}
            >
              →
            </span>
            <span
              className={`font-medium transition-colors ${
                on ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {ev.effect}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── English — story arc (plot structure) ────────────────────────────────────
const ARC_POINTS = [
  { x: 30, y: 150, label: "Exposition" },
  { x: 115, y: 105, label: "Rising action" },
  { x: 205, y: 45, label: "Climax" },
  { x: 290, y: 120, label: "Resolution" },
];

function EnglishVisual({ step, reduced, accent }: VisualProps) {
  const reached = reduced ? ARC_POINTS.length - 1 : step;
  const linePath = ARC_POINTS.slice(0, reached + 1)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const marker = ARC_POINTS[reached];
  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 320 180" className="h-full w-full max-w-md">
        <line
          x1="20"
          y1="160"
          x2="300"
          y2="160"
          className="stroke-muted"
          strokeWidth="2"
        />
        <motion.path
          d={linePath}
          fill="none"
          className={accent.text}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
        />
        {ARC_POINTS.map((p, idx) => {
          const on = idx <= reached;
          return (
            <g key={p.label} opacity={on ? 1 : 0.25}>
              <circle
                cx={p.x}
                cy={p.y}
                r={idx === reached ? 7 : 5}
                className={on ? accent.text : "text-muted-foreground"}
                fill="currentColor"
              />
              <text
                x={p.x}
                y={p.y - 14}
                textAnchor="middle"
                className="fill-foreground text-[10px] font-semibold"
              >
                {p.label}
              </text>
            </g>
          );
        })}
        {!reduced ? (
          <motion.circle
            cx={marker.x}
            cy={marker.y}
            r="10"
            className={accent.text}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            animate={{ r: [8, 12, 8], opacity: [0.8, 0.2, 0.8] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
        ) : null}
      </svg>
    </div>
  );
}

// ── Hindi — word-meaning cards ──────────────────────────────────────────────
const HINDI_WORDS = [
  { word: "नीरस", meaning: "जिसमें रस न हो" },
  { word: "कलरव", meaning: "पक्षियों का मधुर स्वर" },
  { word: "तरु", meaning: "वृक्ष / पेड़" },
  { word: "अनुपम", meaning: "जिसकी उपमा न हो" },
];

function HindiVisual({ step, reduced, accent }: VisualProps) {
  if (reduced) {
    return (
      <div className="grid w-full max-w-md grid-cols-2 gap-3 px-4">
        {HINDI_WORDS.map((w) => (
          <div
            key={w.word}
            className={`rounded-xl border p-3 text-center ${accent.border} ${accent.soft}`}
          >
            <p className={`text-lg font-bold ${accent.text}`}>{w.word}</p>
            <p className="mt-1 text-xs text-muted-foreground">{w.meaning}</p>
          </div>
        ))}
      </div>
    );
  }
  const current = HINDI_WORDS[step] ?? HINDI_WORDS[0];
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <span className="absolute h-40 w-60 translate-x-3 translate-y-3 rounded-xl border bg-muted/40" />
      <span className="absolute h-40 w-60 translate-x-1.5 translate-y-1.5 rounded-xl border bg-muted/60" />
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, rotateY: -25, y: 12 }}
          animate={{ opacity: 1, rotateY: 0, y: 0 }}
          exit={{ opacity: 0, rotateY: 25, y: -12 }}
          transition={{ duration: 0.45, ease: EASE }}
          className={`relative flex h-40 w-60 flex-col items-center justify-center rounded-xl border-2 ${accent.border} ${accent.soft}`}
        >
          <p className={`text-4xl font-bold ${accent.text}`}>{current.word}</p>
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {current.meaning}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Subject default scenes ───────────────────────────────────────────────────
const SUBJECT_SCENES: Record<SubjectId, ExplainerScene> = {
  mathematics: {
    title: "Solving a linear equation",
    blurb: "Watch each operation move across the equals sign, step by step.",
    steps: [
      "Start with the equation 2x + 3 = 11.",
      "Subtract 3 from both sides to isolate the x-term.",
      "Simplify the right-hand side to get 2x = 8.",
      "Divide both sides by 2 — the solution is x = 4.",
    ],
    Visual: MathsVisual,
  },
  science: {
    title: "How photosynthesis works",
    blurb: "Follow the inputs through the leaf and out as food and oxygen.",
    steps: [
      "Sunlight falls on the green leaf.",
      "Roots draw up water while the leaf takes in carbon dioxide.",
      "Chlorophyll converts light energy into chemical energy.",
      "Glucose is made for food and oxygen is released into the air.",
    ],
    Visual: ScienceVisual,
  },
  "social-science": {
    title: "Rise of nationalism in Europe",
    blurb: "See how key events build along the historical timeline.",
    steps: [
      "1789 — the French Revolution sparks the idea of the nation.",
      "1830s — liberal and national ideas spread across Europe.",
      "1848 — a wave of revolutions demands national unity.",
      "1871 — Germany is unified, completing the movement.",
    ],
    Visual: SocialVisual,
  },
  english: {
    title: "The shape of a story",
    blurb: "Trace a narrative as it climbs to its climax and resolves.",
    steps: [
      "Exposition — characters and setting are introduced.",
      "Rising action — the central conflict builds tension.",
      "Climax — the story reaches its turning point.",
      "Resolution — loose ends are tied and the story closes.",
    ],
    Visual: EnglishVisual,
  },
  hindi: {
    title: "शब्द और अर्थ",
    blurb: "कठिन शब्दों के अर्थ कार्ड के रूप में एक-एक करके समझिए।",
    steps: HINDI_WORDS.map((w) => `${w.word} — ${w.meaning}`),
    Visual: HindiVisual,
  },
};

// ── Topic-specific scene overrides ───────────────────────────────────────────
/**
 * Each entry defines a set of chapter-title keywords to match against.
 * The first match for (subjectId, chapterTitle) wins.
 */
const TOPIC_SCENES: Array<{
  subjectId: SubjectId;
  keywords: string[];
  scene: ExplainerScene;
}> = [
  // Science — Ch 9: Light – Reflection and Refraction
  {
    subjectId: "science",
    keywords: ["reflection", "refraction", "light"],
    scene: {
      title: "Reflection & Refraction of Light",
      blurb:
        "Watch a ray of light bounce off a surface and bend as it enters glass.",
      steps: [
        "A ray of light travels from air and hits a smooth glass surface.",
        "The normal — a perpendicular line — marks the point of incidence.",
        "The ray reflects back into air at the same angle it arrived (angle of reflection = angle of incidence).",
        "A second ray bends (refracts) as it enters the denser glass medium, slowing down and changing direction.",
      ],
      Visual: RefractionVisual,
    },
  },
  // Science — Ch 11: Electricity
  {
    subjectId: "science",
    keywords: ["electricity", "electric current", "circuit"],
    scene: {
      title: "How an electric circuit works",
      blurb:
        "See how a battery drives current through a conductor to light a bulb.",
      steps: [
        "A battery provides the potential difference (voltage) that pushes charge around the circuit.",
        "Free electrons in the wire drift from the negative terminal toward the positive terminal.",
        "Energy is transferred to the bulb filament, making it glow white-hot.",
        "Conventional current flows in the opposite direction — from + to − — completing the circuit.",
      ],
      Visual: ElectricityVisual,
    },
  },
  // Social Science — Ch 2: Nationalism in India
  {
    subjectId: "social-science",
    keywords: ["nationalism in india", "non-cooperation", "civil disobedience", "quit india"],
    scene: {
      title: "Nationalism in India: cause & effect",
      blurb:
        "Trace the chain of British actions and Indian responses that led to independence.",
      steps: [
        "The Rowlatt Act (1919) gave the British sweeping power to arrest without trial, sparking fury.",
        "Gandhi launched Non-Cooperation (1920) — Indians boycotted schools, courts and foreign goods.",
        "The Civil Disobedience Movement (1930) began with the iconic Salt March to defy unjust laws.",
        "The Quit India Movement (1942) demanded immediate independence — mass arrests followed.",
      ],
      Visual: NationalismIndiaVisual,
    },
  },
  // Mathematics — Ch 4: Quadratic Equations
  {
    subjectId: "mathematics",
    keywords: ["quadratic"],
    scene: {
      title: "Finding roots of a quadratic equation",
      blurb:
        "See how the parabola reveals the two solutions where it crosses the x-axis.",
      steps: [
        "The equation x² − 5x + 6 = 0 is a quadratic — highest power is 2.",
        "Plotting y = x² − 5x + 6 gives a U-shaped parabola.",
        "Where the parabola crosses the x-axis (y = 0), the roots are x = 2 and x = 3.",
        "Factorising confirms: (x − 2)(x − 3) = 0 gives the same two roots.",
      ],
      Visual: QuadraticVisual,
    },
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the best matching scene for a given subject and optional chapter title.
 * Topic-specific scenes take priority; subject default is the fallback.
 */
export function getScene(
  subjectId: SubjectId,
  chapterTitle?: string,
): ExplainerScene {
  if (chapterTitle) {
    const lower = chapterTitle.toLowerCase();
    const match = TOPIC_SCENES.find(
      (t) =>
        t.subjectId === subjectId &&
        t.keywords.some((k) => lower.includes(k)),
    );
    if (match) return match.scene;
  }
  return SUBJECT_SCENES[subjectId] ?? SUBJECT_SCENES.science;
}
