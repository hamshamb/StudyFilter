import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Responsive overlay shell used by the Study Hub. Full-screen on mobile, a
 * large centred panel on desktop. Locks body scroll and closes on Escape.
 */
export function StudyOverlay({
  open,
  onClose,
  header,
  children,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  /** Sticky header content (breadcrumb, title, actions). */
  header: React.ReactNode;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-card shadow-2xl animate-in zoom-in-95 fade-in duration-200 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl sm:border dark:border-border/50">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-card/95 px-5 py-4 backdrop-blur dark:bg-card/80 dark:border-border/40 dark:backdrop-blur-md">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <div className="relative min-w-0 flex-1">{header}</div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 shrink-0 rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
