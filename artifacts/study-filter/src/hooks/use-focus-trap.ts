import React from "react";

/**
 * Keeps Tab inside a container while it is modal, and hands focus back where
 * it came from on close.
 *
 * The app already has Radix Dialog for genuinely modal things. This exists for
 * the Study Workspace, which is deliberately *non*-modal on desktop — the
 * whole idea is that the PDF stays readable and usable beside it — but becomes
 * a modal bottom sheet on a phone, where it covers the page. One component,
 * two behaviours, so the trap has to be switchable rather than baked into the
 * markup.
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

function focusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export interface FocusTrapOptions {
  /** Trap and restore. When false the hook does nothing at all. */
  active: boolean;
  /** Move focus into the container when it activates. */
  autoFocus?: boolean;
  onEscape?: () => void;
}

export function useFocusTrap<T extends HTMLElement>(
  options: FocusTrapOptions,
): React.RefObject<T | null> {
  const { active, autoFocus = true, onEscape } = options;
  const ref = React.useRef<T | null>(null);
  const restoreTo = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    restoreTo.current = document.activeElement as HTMLElement | null;

    if (autoFocus) {
      // Prefer the first real control; fall back to the panel itself, which
      // carries tabIndex={-1} so a screen reader lands on its label.
      const [first] = focusable(container);
      (first ?? container).focus({ preventScroll: true });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onEscape?.();
        return;
      }
      if (event.key !== "Tab") return;
      const node = ref.current;
      if (!node) return;
      const items = focusable(node);
      if (items.length === 0) {
        event.preventDefault();
        node.focus({ preventScroll: true });
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const activeEl = document.activeElement;
      if (event.shiftKey && (activeEl === first || activeEl === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // Only restore if focus is still somewhere inside us; if the student
      // clicked elsewhere on the way out, yanking focus back is worse.
      const node = ref.current;
      if (node && node.contains(document.activeElement)) {
        restoreTo.current?.focus?.({ preventScroll: true });
      }
    };
  }, [active, autoFocus, onEscape]);

  return ref;
}

/**
 * Locks body scroll without the layout shift that removing the scrollbar
 * causes. Refcounted, because two sheets can be open in sequence and the
 * second must not unlock while the first still wants it locked.
 */
let lockCount = 0;
let previousOverflow = "";
let previousPadding = "";

export function useBodyScrollLock(active: boolean): void {
  React.useEffect(() => {
    if (!active) return;
    if (lockCount === 0) {
      const { body } = document;
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      previousOverflow = body.style.overflow;
      previousPadding = body.style.paddingRight;
      body.style.overflow = "hidden";
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = previousOverflow;
        document.body.style.paddingRight = previousPadding;
      }
    };
  }, [active]);
}
