import { Link, useLocation } from "wouter";
import {
  Search,
  GraduationCap,
  ChevronDown,
  Check,
  Lock,
  Glasses,
  Timer,
  Pause,
  Play,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { useGrade, ALL_GRADES, isGradeAvailable } from "@/hooks/use-grade";
import { useReadingMode } from "@/hooks/use-reading-mode";
import { useFocusTimer, formatTimer } from "@/hooks/use-focus-timer";
import { useCommandPalette } from "@/components/layout/CommandPalette";

const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/chat": "Ask StudyFilter",
  "/subjects": "Subjects",
  "/practice": "Practice",
  "/library": "Library",
  "/plan": "Study plan",
  "/focus": "Focus room",
  "/saved": "Saved",
  "/dashboard": "Progress",
  "/settings": "Settings",
  "/compare": "Compare answers",
  "/leaderboard": "Leaderboard",
  "/map-practice": "Map practice",
  "/sign-in": "Sign in",
  "/sign-up": "Create account",
};

/**
 * Resolves the header title for a path.
 *
 * A flat lookup meant every nested route fell through to the brand name: a
 * student reading a chapter saw "StudyFilter" in the header rather than
 * "Subjects". Walk up the path until a section matches.
 */
function resolveTitle(path: string): string {
  const exact = PAGE_TITLES[path];
  if (exact) return exact;

  const segments = path.split("/").filter(Boolean);
  while (segments.length > 1) {
    segments.pop();
    const parent = `/${segments.join("/")}`;
    const match = PAGE_TITLES[parent];
    if (match) return match;
  }
  return "StudyFilter";
}

/**
 * The running focus session, wherever you are in the app.
 *
 * Amber, not the old brand-accent terracotta: a countdown reads as time, and
 * `accent` is now shadcn's neutral hover surface rather than a colour of its
 * own — this used `bg-accent/10 text-accent`, which would have rendered grey
 * on grey.
 */
function MiniTimer() {
  const timer = useFocusTimer();
  if (!timer.isActive) return null;
  const phaseLabel =
    timer.phase === "focus" ? "Focus" : timer.phase === "short_break" ? "Break" : "Long break";
  const running = timer.phase === "focus";
  return (
    <Link href="/focus" data-testid="link-mini-timer">
      <div
        className={cn(
          "flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium tabular-nums transition-colors",
          running
            ? "border-warning/35 bg-warning-soft text-warning hover:bg-warning-soft/70"
            : "border-success/35 bg-success-soft text-success hover:bg-success-soft/70",
        )}
      >
        <Timer className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{formatTimer(timer.remainingMs)}</span>
        <span className="hidden opacity-70 sm:inline">{phaseLabel}</span>
        {timer.status === "running" ? (
          <button
            aria-label="Pause timer"
            className="opacity-70 hover:opacity-100"
            onClick={(e) => {
              e.preventDefault();
              timer.pause();
            }}
            data-testid="button-mini-timer-pause"
          >
            <Pause className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            aria-label="Resume timer"
            className="opacity-70 hover:opacity-100"
            onClick={(e) => {
              e.preventDefault();
              timer.resume();
            }}
            data-testid="button-mini-timer-resume"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </Link>
  );
}

export function WorkspaceHeader() {
  const [location] = useLocation();
  const { grade, setGrade } = useGrade();
  const { isActive: readingActive, isAutoNight, toggle: toggleReading } = useReadingMode();
  const { open: openPalette } = useCommandPalette();

  const title = resolveTitle(location);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:px-4">
      <SidebarTrigger className="hidden md:flex" data-testid="button-sidebar-toggle" />
      {/*
        A <p>, not an <h1>. This is persistent chrome that repeats on every
        screen, and every page already renders its own <h1> through
        PageHeader — so each page was shipping two level-one headings and
        screen readers announced the chrome as the document heading.
      */}
      <p
        className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground md:text-[0.9375rem]"
        data-testid="text-page-title"
      >
        {title}
      </p>

      <div className="ml-auto flex items-center gap-1.5">
        <MiniTimer />

        {/* Global search / command palette */}
        <Button
          variant="outline"
          size="sm"
          onClick={openPalette}
          className="hidden h-8 items-center gap-2 pr-1.5 text-muted-foreground sm:flex"
          data-testid="button-open-command-palette"
        >
          <Search className="h-4 w-4" />
          <span className="text-xs">Search</span>
          <Kbd className="ml-1">Ctrl K</Kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={openPalette}
          className="h-8 w-8 text-muted-foreground sm:hidden"
          aria-label="Search"
          data-testid="button-open-command-palette-mobile"
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Class picker */}
        {grade && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 gap-1.5 px-2.5 font-semibold",
              )}
              data-testid="button-class-picker"
            >
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">Class {grade}</span>
              <span className="sm:hidden">{grade}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-eyebrow text-muted-foreground">
                Switch class
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_GRADES.map((g) => {
                const available = isGradeAvailable(g);
                return (
                  <DropdownMenuItem
                    key={g}
                    disabled={!available}
                    onSelect={() => available && setGrade(g)}
                    className="flex items-center justify-between"
                  >
                    <span>Class {g}</span>
                    {g === grade ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : !available ? (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Lock className="h-3 w-3" /> Soon
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Reading mode */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={readingActive ? "Turn off reading mode" : "Turn on reading mode"}
          aria-pressed={readingActive}
          className={cn(
            "relative h-8 w-8 transition-colors",
            readingActive
              ? "bg-warning-soft text-warning hover:bg-warning-soft/70"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={toggleReading}
          data-testid="button-reading-mode"
        >
          <Glasses className="h-4 w-4" />
          {isAutoNight && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-warning ring-1 ring-background"
            />
          )}
        </Button>
      </div>
    </header>
  );
}
