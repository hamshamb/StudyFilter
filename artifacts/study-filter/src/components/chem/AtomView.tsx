import React from "react";
import { Eye, EyeOff, Pause, Play, RotateCcw, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MODEL_CAVEAT,
  buildAtom,
  describeAtom,
  electronPosition,
  orbitPath,
  project,
  rotate,
  type AtomModel,
} from "@/lib/chem/atom";
import { CATEGORIES, type ChemElement } from "@/lib/chem/elements";

/**
 * The atom.
 *
 * A canvas, a projection and a painter's-algorithm sort — no WebGL, so it
 * renders identically on every device and cannot fail to acquire a context.
 * Everything drawn comes from the element's own data.
 *
 * Three things keep it from looking like a school slideshow:
 *
 *  - **Depth.** Every sphere is sorted back-to-front and scaled by
 *    perspective, and each is a radial gradient with a lighter side, so the
 *    nucleus reads as a cluster of balls rather than a flat disc.
 *  - **Orbits pass behind.** Each ring is drawn in two halves — the far half
 *    before the nucleus, the near half after — so the nucleus genuinely
 *    occludes the back of every orbit. This is the single detail that makes
 *    the picture read as 3D rather than as concentric circles.
 *  - **Weight.** Motion is slow and even. Nothing bounces, nothing glows,
 *    there is no bloom and no starfield.
 *
 * Colours are read from the theme's CSS variables on every resize, so all six
 * StudyFilter themes work without a palette of their own.
 */

interface Palette {
  proton: string;
  neutron: string;
  electron: string;
  orbit: string;
  orbitFar: string;
  label: string;
  muted: string;
}

function readPalette(host: HTMLElement): Palette {
  const styles = getComputedStyle(host);
  const v = (name: string, fallback: string) => {
    const raw = styles.getPropertyValue(name).trim();
    return raw ? `hsl(${raw})` : fallback;
  };
  const hsla = (name: string, alpha: number, fallback: string) => {
    const raw = styles.getPropertyValue(name).trim();
    return raw ? `hsl(${raw} / ${alpha})` : fallback;
  };
  return {
    // Protons carry the destructive/warm token, neutrons the muted one: the
    // pairing is conventional in textbooks and survives every theme.
    proton: v("--destructive", "#d64545"),
    neutron: v("--muted-foreground", "#8b8f96"),
    electron: v("--primary", "#625bf6"),
    orbit: hsla("--muted-foreground", 0.45, "rgba(120,120,130,0.45)"),
    orbitFar: hsla("--muted-foreground", 0.16, "rgba(120,120,130,0.16)"),
    label: v("--foreground", "#15171a"),
    muted: v("--muted-foreground", "#8b8f96"),
  };
}

export interface AtomViewProps {
  element: ChemElement;
  className?: string;
  /** Starts paused and hides the controls — for the small preview in a tile. */
  compact?: boolean;
}

export function AtomView({ element, className, compact = false }: AtomViewProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const [playing, setPlaying] = React.useState(!compact);
  const [showLabels, setShowLabels] = React.useState(!compact);
  const [showOrbits, setShowOrbits] = React.useState(true);
  const [showNucleus, setShowNucleus] = React.useState(true);
  const [reduced, setReduced] = React.useState(false);

  const model = React.useMemo(() => buildAtom(element), [element]);

  /*
   * Camera and clock live in refs, not state.
   *
   * They change every frame and on every pointer move; putting them in state
   * would re-render the whole panel sixty times a second for a value only the
   * draw loop reads.
   */
  const cam = React.useRef({ pitch: -0.42, yaw: 0.6, zoom: 1, spin: 0 });
  const clock = React.useRef(0);
  const drag = React.useRef<{ x: number; y: number; pitch: number; yaw: number } | null>(null);
  const pinch = React.useRef<{ distance: number; zoom: number } | null>(null);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches || document.documentElement.dataset.motion === "reduced");
    sync();
    media.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    return () => {
      media.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  // Reduced motion means a still atom, not a slower one.
  const animating = playing && !reduced;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let palette = readPalette(host);
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let resizeRaf = 0;
    let last = performance.now();

    function resize() {
      const rect = host!.getBoundingClientRect();
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.max(0, rect.width);
      const nextHeight = Math.max(0, rect.height);
      const bitmapWidth = Math.max(1, Math.floor(nextWidth * nextDpr));
      const bitmapHeight = Math.max(1, Math.floor(nextHeight * nextDpr));

      dpr = nextDpr;
      width = nextWidth;
      height = nextHeight;

      // The canvas already fills its host through `h-full w-full`. Writing
      // CSS width/height here changes the box that ResizeObserver is watching
      // and can create an endless observer loop in embedded previews. Only
      // update the backing-store resolution, and only when it really changed.
      if (canvas!.width !== bitmapWidth) canvas!.width = bitmapWidth;
      if (canvas!.height !== bitmapHeight) canvas!.height = bitmapHeight;
      // Re-read on resize so a theme change picked up mid-session applies.
      palette = readPalette(host!);
    }

    function scheduleResize() {
      if (resizeRaf) return;
      // ResizeObserver callbacks run during layout. Deferring the canvas
      // mutation to the next frame prevents a resize-notification cycle.
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        resize();
      });
    }

    resize();
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(host);

    function draw(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (animating) clock.current += dt;

      const c = ctx!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      // Fit the whole atom with a margin, whatever the panel size.
      const fit = (Math.min(width, height) / 2 - 24) / model.extent;
      const zoom = fit * cam.current.zoom;
      const { pitch, yaw } = cam.current;

      // ── Orbits, far halves ──────────────────────────────────────────
      if (showOrbits) {
        for (const shell of model.shells) {
          strokeOrbit(c, shell, pitch, yaw, cx, cy, zoom, palette, "far");
        }
      }

      // ── Nucleus ─────────────────────────────────────────────────────
      if (showNucleus) {
        const nucleons = model.nucleons
          .map((n) => {
            const r = rotate(n.position, pitch, yaw);
            return { kind: n.kind, p: project(r, cx, cy, zoom) };
          })
          .sort((a, b) => b.p.depth - a.p.depth);

        for (const n of nucleons) {
          sphere(
            c,
            n.p.x,
            n.p.y,
            Math.max(1.5, 7 * n.p.scale),
            n.kind === "proton" ? palette.proton : palette.neutron,
          );
        }
      } else {
        sphere(c, cx, cy, Math.max(6, 16 * zoom), palette.neutron);
      }

      // ── Orbits, near halves ─────────────────────────────────────────
      if (showOrbits) {
        for (const shell of model.shells) {
          strokeOrbit(c, shell, pitch, yaw, cx, cy, zoom, palette, "near");
        }
      }

      // ── Electrons ───────────────────────────────────────────────────
      const electrons: { p: ReturnType<typeof project>; shellLabel: string }[] = [];
      for (const shell of model.shells) {
        for (let i = 0; i < shell.electrons; i++) {
          const pos = electronPosition(shell, i, clock.current);
          const r = rotate(pos, pitch, yaw);
          electrons.push({ p: project(r, cx, cy, zoom), shellLabel: shell.label });
        }
      }
      electrons.sort((a, b) => b.p.depth - a.p.depth);
      for (const e of electrons) {
        sphere(c, e.p.x, e.p.y, Math.max(1.6, 4.6 * e.p.scale), palette.electron);
      }

      // ── Shell labels ────────────────────────────────────────────────
      if (showLabels) {
        c.font = `600 11px ${getComputedStyle(host!).fontFamily}`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        for (const shell of model.shells) {
          // Label at the top of each orbit, which stays clear of the nucleus.
          const pos = { x: 0, y: -shell.radius * Math.sin(shell.tilt), z: -shell.radius * Math.cos(shell.tilt) };
          const flat = { x: 0, y: pos.y, z: pos.z };
          const r = rotate(flat, pitch, yaw);
          const p = project(r, cx, cy, zoom);
          const text = `${shell.label} · ${shell.electrons}`;
          c.lineWidth = 3;
          c.strokeStyle = getComputedStyle(host!).getPropertyValue("--sf-canvas-bg") || "transparent";
          c.fillStyle = palette.muted;
          c.globalAlpha = p.depth > 0 ? 0.45 : 1;
          c.fillText(text, p.x, p.y);
          c.globalAlpha = 1;
        }
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      observer.disconnect();
    };
  }, [model, animating, showLabels, showOrbits, showNucleus]);

  // ── Pointer control ───────────────────────────────────────────────────

  function onPointerDown(e: React.PointerEvent) {
    if (compact) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, pitch: cam.current.pitch, yaw: cam.current.yaw };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    cam.current.yaw = drag.current.yaw + dx * 0.008;
    // Clamped so the atom can never be rotated past vertical and flip.
    cam.current.pitch = Math.max(
      -Math.PI / 2 + 0.05,
      Math.min(Math.PI / 2 - 0.05, drag.current.pitch + dy * 0.008),
    );
  }

  function endDrag(e: React.PointerEvent) {
    drag.current = null;
    pinch.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  function onWheel(e: React.WheelEvent) {
    if (compact) return;
    // No preventDefault: the page should still scroll past the atom on a
    // phone. Zoom follows the wheel but never traps the scroll.
    cam.current.zoom = Math.max(0.55, Math.min(2.4, cam.current.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length !== 2) return;
    const [a, b] = [e.touches[0]!, e.touches[1]!];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (!pinch.current) {
      pinch.current = { distance, zoom: cam.current.zoom };
      return;
    }
    cam.current.zoom = Math.max(
      0.55,
      Math.min(2.4, pinch.current.zoom * (distance / pinch.current.distance)),
    );
  }

  function reset() {
    cam.current = { pitch: -0.42, yaw: 0.6, zoom: 1, spin: 0 };
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const step = 0.12;
    if (e.key === "ArrowLeft") cam.current.yaw -= step;
    else if (e.key === "ArrowRight") cam.current.yaw += step;
    else if (e.key === "ArrowUp") cam.current.pitch = Math.max(-1.5, cam.current.pitch - step);
    else if (e.key === "ArrowDown") cam.current.pitch = Math.min(1.5, cam.current.pitch + step);
    else if (e.key === "+" || e.key === "=") cam.current.zoom = Math.min(2.4, cam.current.zoom * 1.12);
    else if (e.key === "-") cam.current.zoom = Math.max(0.55, cam.current.zoom * 0.89);
    else if (e.key.toLowerCase() === "r") reset();
    else return;
    e.preventDefault();
  }

  const description = describeAtom(model);
  const accent = CATEGORIES[element.category];

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        ref={hostRef}
        className={cn(
          "relative flex-1 overflow-hidden rounded-xl border border-card-border bg-card",
          !compact && "cursor-grab active:cursor-grabbing",
        )}
        style={{ minHeight: compact ? 120 : 280 }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={description}
          tabIndex={compact ? -1 : 0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
          onTouchMove={onTouchMove}
          onKeyDown={onKeyDown}
          className="block h-full w-full touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        {/* The symbol, anchored — this is the element that stays put through
            the table→atom transition, so the eye never loses the thread. */}
        {!compact && (
          <div className="pointer-events-none absolute left-4 top-4">
            <p className={cn("text-3xl font-bold leading-none", accent.text)}>{element.symbol}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{element.name}</p>
          </div>
        )}

        {!compact && (
          <p className="pointer-events-none absolute inset-x-3 bottom-2 text-center text-[10px] leading-tight text-muted-foreground">
            {MODEL_CAVEAT}
          </p>
        )}
      </div>

      {!compact && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setPlaying((p) => !p)} disabled={reduced}>
              {playing && !reduced ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing && !reduced ? "Pause" : "Play"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowLabels((s) => !s)}>
              <Tag className="h-3.5 w-3.5" />
              {showLabels ? "Hide labels" : "Labels"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowOrbits((s) => !s)}>
              {showOrbits ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              Shells
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowNucleus((s) => !s)}>
              Nucleus
            </Button>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>

          {reduced && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Motion is paused because your device asks for reduced motion. Drag to rotate.
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Legend colour="bg-destructive" label={`${model.protons} protons`} />
            <Legend colour="bg-muted-foreground" label={`${model.neutrons} neutrons`} />
            <Legend colour="bg-primary" label={`${element.number} electrons`} />
            {model.nucleusSampled && (
              <span>Nucleus drawn as a representative cluster, in proportion.</span>
            )}
          </div>

          {/* The information the picture carries, in words. Not a caption —
              a genuine equivalent, so nothing here needs the canvas. */}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Describe this atom in words
            </summary>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">{description}</p>
          </details>
        </>
      )}
    </div>
  );
}

function Legend({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", colour)} />
      {label}
    </span>
  );
}

// ── Drawing helpers ──────────────────────────────────────────────────────

/** A shaded ball. The offset highlight is what stops it reading as a flat dot. */
function sphere(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string) {
  const gradient = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  gradient.addColorStop(0, mix(colour, "#ffffff", 0.45));
  gradient.addColorStop(0.55, colour);
  gradient.addColorStop(1, mix(colour, "#000000", 0.32));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Strokes half an orbit — the half behind the nucleus, or the half in front.
 *
 * Splitting on the sign of the rotated z is what lets the nucleus occlude the
 * back of the ring. Drawn as separate segments rather than one path so a ring
 * seen almost edge-on does not close itself across the middle.
 */
function strokeOrbit(
  ctx: CanvasRenderingContext2D,
  shell: Parameters<typeof orbitPath>[0],
  pitch: number,
  yaw: number,
  cx: number,
  cy: number,
  zoom: number,
  palette: Palette,
  half: "near" | "far",
) {
  const points = orbitPath(shell).map((p) => {
    const r = rotate(p, pitch, yaw);
    return project(r, cx, cy, zoom);
  });

  ctx.strokeStyle = half === "far" ? palette.orbitFar : palette.orbit;
  ctx.lineWidth = half === "far" ? 1 : 1.25;

  let drawing = false;
  ctx.beginPath();
  for (const p of points) {
    const belongs = half === "far" ? p.depth > 0 : p.depth <= 0;
    if (belongs) {
      if (!drawing) {
        ctx.moveTo(p.x, p.y);
        drawing = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    } else {
      drawing = false;
    }
  }
  ctx.stroke();
}

/** Blends two colours. Accepts anything the canvas accepts, via a scratch ctx. */
const scratch =
  typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
const rgbCache = new Map<string, [number, number, number]>();

function toRgb(colour: string): [number, number, number] {
  const cached = rgbCache.get(colour);
  if (cached) return cached;
  if (!scratch) return [120, 120, 130];
  scratch.fillStyle = "#000";
  scratch.fillStyle = colour;
  const resolved = scratch.fillStyle as string;
  let rgb: [number, number, number] = [120, 120, 130];
  if (resolved.startsWith("#")) {
    const hex = resolved.length === 4
      ? resolved.slice(1).split("").map((c) => c + c).join("")
      : resolved.slice(1);
    rgb = [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  } else {
    const m = resolved.match(/(\d+(\.\d+)?)/g);
    if (m && m.length >= 3) rgb = [Number(m[0]), Number(m[1]), Number(m[2])];
  }
  rgbCache.set(colour, rgb);
  return rgb;
}

function mix(colour: string, towards: string, amount: number): string {
  const [r1, g1, b1] = toRgb(colour);
  const [r2, g2, b2] = toRgb(towards);
  const r = Math.round(r1 + (r2 - r1) * amount);
  const g = Math.round(g1 + (g2 - g1) * amount);
  const b = Math.round(b1 + (b2 - b1) * amount);
  return `rgb(${r} ${g} ${b})`;
}
