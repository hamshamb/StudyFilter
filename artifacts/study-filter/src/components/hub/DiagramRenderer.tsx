import React from "react";
import mermaid from "mermaid";
import type { Diagram } from "@workspace/api-client-react";

let mermaidReady = false;
function ensureMermaid(dark: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: dark ? "dark" : "neutral",
    fontFamily: "inherit",
  });
  mermaidReady = true;
}

function useIsDark() {
  const [dark, setDark] = React.useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );
  React.useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    update();
    return () => observer.disconnect();
  }, []);
  return dark;
}

let diagramSeq = 0;

function SingleDiagram({ diagram, dark }: { diagram: Diagram; dark: boolean }) {
  const [svg, setSvg] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const code = diagram.mermaid?.trim();
    if (!code) {
      setFailed(true);
      return;
    }
    ensureMermaid(dark);
    const id = `sf-diagram-${diagramSeq++}`;
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (!cancelled) {
          setSvg(svg);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [diagram.mermaid, dark]);

  if (failed) return null;

  return (
    <figure className="rounded-xl border bg-card p-4">
      {diagram.title ? (
        <figcaption className="mb-3 text-sm font-semibold">
          {diagram.title}
        </figcaption>
      ) : null}
      {svg ? (
        <div
          className="flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      )}
      {diagram.caption ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {diagram.caption}
        </p>
      ) : null}
    </figure>
  );
}

/**
 * Renders a list of Mermaid diagrams. Each diagram fails silently (renders
 * nothing) if its definition is invalid, so a bad diagram never breaks the page.
 */
export function DiagramRenderer({ diagrams }: { diagrams?: Diagram[] }) {
  const dark = useIsDark();
  void mermaidReady;
  if (!diagrams?.length) return null;
  return (
    <div className="space-y-3">
      {diagrams.map((d, i) => (
        <SingleDiagram key={i} diagram={d} dark={dark} />
      ))}
    </div>
  );
}
