import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  PenLine,
  BookOpen,
  CalendarDays,
  FolderOpen,
  Menu,
  Target,
  Timer,
  Bookmark,
  LineChart,
  Settings,
  Pause,
  Play,
  X,
  MapPin,
  Trophy,
  Scale,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useFocusTimer, formatTimer } from "@/hooks/use-focus-timer";
import { cn } from "@/lib/utils";

/**
 * Mobile is not the desktop nav squeezed smaller.
 *
 * Four thumb-reachable destinations plus More, chosen by what a student does
 * most on a phone: land, ask a doubt, open a chapter, look something up. The
 * bar used to carry five items including Study Plan — a screen you build once
 * a term — while Practice and Progress were buried in the sheet.
 *
 * Every item is a 56px-tall target, which is above the 44px minimum and
 * matters more here than anywhere else in the product.
 */
const BOTTOM_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/chat", label: "Ask", icon: PenLine },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/library", label: "Library", icon: FolderOpen },
];

/**
 * The sheet is the *entire* rest of the navigation on a phone — the sidebar
 * trigger in the header is `hidden md:flex` — so everything with a route has
 * to be in here.
 */
const MENU_ITEMS = [
  { href: "/practice", label: "Practice", icon: Target },
  { href: "/dashboard", label: "Progress", icon: LineChart },
  { href: "/plan", label: "Study plan", icon: CalendarDays },
  { href: "/focus", label: "Focus room", icon: Timer },
  { href: "/maps", label: "Map work", icon: MapPin },
  { href: "/compare", label: "Compare", icon: Scale },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/settings", label: "Settings", icon: Settings },
];

function MobileMiniPlayer() {
  const timer = useFocusTimer();
  if (!timer.isActive) return null;
  const phaseLabel =
    timer.phase === "focus" ? "Focusing" : timer.phase === "short_break" ? "Short break" : "Long break";
  return (
    <Link href="/focus">
      <div
        className="mx-3 mb-2 flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 shadow-sm"
        data-testid="mobile-mini-player"
      >
        <div className="relative h-8 w-8">
          <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90" aria-hidden="true">
            <circle cx="18" cy="18" r="15" fill="none" className="stroke-muted" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              className={timer.phase === "focus" ? "stroke-warning" : "stroke-success"}
              strokeWidth="3"
              strokeDasharray={`${timer.progress * 94.2} 94.2`}
              strokeLinecap="round"
            />
          </svg>
          <Timer className="absolute inset-0 m-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold tabular-nums text-foreground">
            {formatTimer(timer.remainingMs)}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {phaseLabel}
            {timer.link.label ? ` · ${timer.link.label}` : ""}
          </div>
        </div>
        {timer.status === "running" ? (
          <button
            aria-label="Pause timer"
            className="rounded-lg p-2 text-foreground hover:bg-muted"
            onClick={(e) => {
              e.preventDefault();
              timer.pause();
            }}
          >
            <Pause className="h-4 w-4" />
          </button>
        ) : (
          <button
            aria-label="Resume timer"
            className="rounded-lg p-2 text-foreground hover:bg-muted"
            onClick={(e) => {
              e.preventDefault();
              timer.resume();
            }}
          >
            <Play className="h-4 w-4" />
          </button>
        )}
        <button
          aria-label="Stop timer"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          onClick={(e) => {
            e.preventDefault();
            timer.stop();
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </Link>
  );
}

export function MobileNavigation() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const inMenu = MENU_ITEMS.some((i) => i.href === location);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <MobileMiniPlayer />
      <nav
        className="flex items-stretch justify-around border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85"
        data-testid="mobile-bottom-nav"
        aria-label="Primary"
      >
        {BOTTOM_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
              data-testid={`link-mobile-${label.toLowerCase()}`}
            >
              {/* A 2px rule at the top of the active tab — clearer than colour
                  alone, and it survives a colourblind reading. */}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary"
                />
              )}
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors",
                inMenu ? "text-primary" : "text-muted-foreground",
              )}
              data-testid="button-mobile-menu"
            >
              {inMenu && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary"
                />
              )}
              <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          >
            <SheetHeader>
              <SheetTitle className="text-section">More</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-2 px-4 pb-2">
              {MENU_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    location === href
                      ? "border-primary/35 bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  )}
                  data-testid={`link-mobile-menu-${label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
