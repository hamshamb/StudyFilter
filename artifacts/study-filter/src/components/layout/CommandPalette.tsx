import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useLocation } from "wouter";
import {
  PenLine,
  BookOpen,
  Target,
  LineChart,
  FolderOpen,
  Bookmark,
  Home,
  CalendarDays,
  Timer,
  Settings,
  Moon,
  Sun,
  FileText,
  ScrollText,
  NotebookPen,
  Plus,
  Play,
  MapPin,
  Trophy,
  Scale,
  ListChecks,
  Sparkles,
  Calculator,
  Layers,
  Atom,
} from "lucide-react";
import { readStickyScope } from "@/hooks/use-study-scope";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useTheme } from "@/hooks/use-theme";
import { useFocusTimer } from "@/hooks/use-focus-timer";
import { SUBJECTS } from "@workspace/cbse-content";

interface CommandPaletteContextValue {
  open: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx)
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  return ctx;
}

/**
 * Sourced from the shared content model rather than a local list of names.
 * The previous hardcoded array only had display names, so search results
 * navigated to /subjects?subject=English — a query parameter the Subjects
 * page never reads, which dumped every search straight onto the generic
 * subject listing. Routing needs the id ("english"), not the label.
 */
const SUBJECT_ITEMS = SUBJECTS.map((s) => ({
  id: s.id,
  name: s.name,
  chapters: s.chapters,
}));

/** Every chapter, flattened, so a student can jump straight to one by name. */
const CHAPTER_ITEMS = SUBJECTS.flatMap((s) =>
  s.chapters.map((c) => ({
    subjectId: s.id,
    subjectName: s.name,
    chapterId: c.id,
    title: c.title,
  })),
);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const timer = useFocusTimer();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = useCallback((fn: () => void) => {
    setOpen(false);
    fn();
  }, []);

  const go = useCallback(
    (path: string) => run(() => setLocation(path)),
    [run, setLocation],
  );

  /** Same, but carrying the chapter the student was last working in. */
  const goScoped = useCallback(
    (path: string) => {
      const scope = readStickyScope();
      const params = new URLSearchParams();
      if (scope.subjectId) params.set("subject", scope.subjectId);
      if (scope.chapterId) params.set("chapter", scope.chapterId);
      const query = params.toString();
      run(() => setLocation(query ? `${path}?${query}` : path));
    },
    [run, setLocation],
  );

  return (
    <CommandPaletteContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          aria-label="Search StudyFilter"
          placeholder="Search chapters, subjects, actions…"
          data-testid="input-command-palette"
        />
        <CommandList>
          <CommandEmpty>
            <p className="text-sm font-medium">No matches</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a chapter name like “Electricity”, or a subject like “Science”.
            </p>
          </CommandEmpty>

          <CommandGroup heading="Study">
            <CommandItem onSelect={() => go("/chat")} data-testid="command-ask-question">
              <PenLine className="mr-2 h-4 w-4" />
              Ask a question
            </CommandItem>
            {/*
              These five carry the chapter you were last in, so "Start a quiz"
              from the palette opens the builder already scoped rather than
              asking you to pick everything again.
            */}
            <CommandItem onSelect={() => goScoped("/quiz")} data-testid="command-start-quiz">
              <ListChecks className="mr-2 h-4 w-4" />
              Start a quiz
            </CommandItem>
            <CommandItem onSelect={() => goScoped("/revise")}>
              <NotebookPen className="mr-2 h-4 w-4" />
              Revise a chapter
            </CommandItem>
            <CommandItem onSelect={() => goScoped("/explain")}>
              <Sparkles className="mr-2 h-4 w-4" />
              Explain a concept
            </CommandItem>
            <CommandItem onSelect={() => goScoped("/solve")}>
              <Calculator className="mr-2 h-4 w-4" />
              Solve a problem
            </CommandItem>
            <CommandItem onSelect={() => goScoped("/flashcards")}>
              <Layers className="mr-2 h-4 w-4" />
              Study flashcards
            </CommandItem>
            <CommandItem onSelect={() => go("/practice")}>
              <Target className="mr-2 h-4 w-4" />
              Start a mock exam
            </CommandItem>
            <CommandItem onSelect={() => go("/library")}>
              <FileText className="mr-2 h-4 w-4" />
              Open NCERT books
            </CommandItem>
            <CommandItem onSelect={() => go("/library")}>
              <ScrollText className="mr-2 h-4 w-4" />
              Open sample papers &amp; PYQs
            </CommandItem>
            <CommandItem onSelect={() => go("/saved")}>
              <Bookmark className="mr-2 h-4 w-4" />
              Search saved answers
            </CommandItem>
            <CommandItem onSelect={() => go("/maps")}>
              <MapPin className="mr-2 h-4 w-4" />
              Practise map work
            </CommandItem>
            <CommandItem onSelect={() => go("/tools/periodic-table")}>
              <Atom className="mr-2 h-4 w-4" />
              Open the periodic table
            </CommandItem>
            <CommandItem onSelect={() => go("/compare")}>
              <Scale className="mr-2 h-4 w-4" />
              Compare two answers
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Planner & Focus">
            <CommandItem onSelect={() => go("/plan")} data-testid="command-open-plan">
              <CalendarDays className="mr-2 h-4 w-4" />
              Open today&rsquo;s plan
            </CommandItem>
            <CommandItem onSelect={() => go("/plan?new=task")}>
              <Plus className="mr-2 h-4 w-4" />
              Create a study task
            </CommandItem>
            <CommandItem
              onSelect={() =>
                run(() => {
                  if (!timer.isActive) timer.start("focus");
                  setLocation("/focus");
                })
              }
              data-testid="command-start-pomodoro"
            >
              <Play className="mr-2 h-4 w-4" />
              Start a Pomodoro
            </CommandItem>
            <CommandItem onSelect={() => go("/focus")}>
              <Timer className="mr-2 h-4 w-4" />
              Open Focus Room
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Subjects">
            {SUBJECT_ITEMS.map((s) => (
              <CommandItem
                key={s.id}
                value={s.name}
                onSelect={() => go(`/subjects/${s.id}`)}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                {s.name}
                <span className="ml-auto text-xs text-muted-foreground">
                  {s.chapters.length} chapters
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Chapters">
            {CHAPTER_ITEMS.map((c) => (
              <CommandItem
                key={`${c.subjectId}/${c.chapterId}`}
                // Include the subject name so searching "science light" matches,
                // and so identically-titled chapters stay distinguishable.
                value={`${c.title} ${c.subjectName}`}
                onSelect={() => go(`/subjects/${c.subjectId}/${c.chapterId}`)}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                <span className="truncate">{c.title}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {c.subjectName}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => go("/")}>
              <Home className="mr-2 h-4 w-4" />
              Home
            </CommandItem>
            <CommandItem onSelect={() => go("/dashboard")}>
              <LineChart className="mr-2 h-4 w-4" />
              Dashboard
            </CommandItem>
            <CommandItem onSelect={() => go("/library")}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Library
            </CommandItem>
            <CommandItem onSelect={() => go("/leaderboard")}>
              <Trophy className="mr-2 h-4 w-4" />
              Leaderboard
            </CommandItem>
            <CommandItem onSelect={() => go("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </CommandItem>
            <CommandItem
              onSelect={() => run(() => setTheme(theme === "dark" ? "light" : "dark"))}
              data-testid="command-toggle-theme"
            >
              {theme === "dark" ? (
                <Sun className="mr-2 h-4 w-4" />
              ) : (
                <Moon className="mr-2 h-4 w-4" />
              )}
              Switch to {theme === "dark" ? "light" : "dark"} mode
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  );
}
