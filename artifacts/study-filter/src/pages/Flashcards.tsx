import React from "react";
import { ArrowLeft, Check, Info, Layers, Play, Trash2 } from "lucide-react";
import { PageShell, PageHeader, EmptyState } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/primitives";
import { SeoHead } from "@/components/SeoHead";
import { FlashcardMaker } from "@/components/study/FlashcardMaker";
import { useScopedRoute } from "@/hooks/use-study-scope";
import { usePreferences } from "@/hooks/use-preferences";
import { useRecordRecent } from "@/hooks/use-recents";
import { recordMasteryAttempt } from "@/hooks/use-mastery";
import { chapterKey } from "@/lib/mastery";
import { scopeToSearch } from "@/lib/scope";
import {
  BOX_LABELS,
  GRADES,
  deleteDeck,
  describeSchedule,
  gradeCard,
  useFlashcards,
  type CardGrade,
  type Flashcard,
} from "@/hooks/use-flashcards";
import { cn } from "@/lib/utils";

/**
 * Flashcards: the decks, and the studying.
 *
 * The review screen is the whole feature, so it does the one thing a paper
 * flashcard cannot: it schedules. Every grade is explained on screen — "Good"
 * literally says when the card comes back — because a student who does not
 * know why a card disappeared for a week stops trusting the deck.
 */

const GRADE_INFO: Record<CardGrade, { label: string; hint: string; className: string }> = {
  again: {
    label: "Again",
    hint: "Didn't know it",
    className: "border-destructive/40 text-destructive hover:bg-destructive-soft",
  },
  hard: {
    label: "Hard",
    hint: "Got there slowly",
    className: "border-warning/40 text-warning hover:bg-warning-soft",
  },
  good: { label: "Good", hint: "Knew it", className: "border-primary/40 text-primary hover:bg-primary/10" },
  easy: { label: "Easy", hint: "Instantly", className: "border-success/40 text-success hover:bg-success-soft" },
};

export default function Flashcards() {
  const { scope } = useScopedRoute("/flashcards");
  const { decks, dueEverywhere, totalCards } = useFlashcards();
  const [studying, setStudying] = React.useState<string | null>(null);
  const [making, setMaking] = React.useState(false);

  useRecordRecent({
    kind: "flashcards",
    title: "Flashcards",
    subtitle: totalCards > 0 ? `${dueEverywhere} due of ${totalCards}` : "No cards yet",
    href: `/flashcards${scopeToSearch(scope)}`,
  });

  if (studying) {
    return <StudySession deckId={studying} onExit={() => setStudying(null)} />;
  }

  return (
    <>
      <SeoHead
        title="Flashcards — CBSE revision | StudyFilter"
        description="Make flashcards from any chapter, review them before saving, and study them on a simple spaced-repetition schedule."
        canonical="/flashcards"
      />
      <PageShell width="content">
        <PageHeader
          icon={Layers}
          title="Flashcards"
          eyebrow={dueEverywhere > 0 ? `${dueEverywhere} due now` : undefined}
          description="Short, single-fact cards. Grade each one honestly and the schedule does the rest."
          actions={
            scope.hasChapter && !making ? (
              <Button size="sm" onClick={() => setMaking(true)}>
                New deck from {scope.chapter!.title.slice(0, 24)}
                {scope.chapter!.title.length > 24 ? "…" : ""}
              </Button>
            ) : undefined
          }
        />

        {making && (
          <div className="mb-5 rounded-xl border border-card-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-card-title">New deck</h2>
              <Button variant="ghost" size="sm" onClick={() => setMaking(false)}>
                Cancel
              </Button>
            </div>
            <FlashcardMaker scope={scope} onSaved={() => setMaking(false)} />
          </div>
        )}

        {decks.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No decks yet"
            description={
              scope.hasChapter
                ? "Make one from the chapter you're on — you'll see every card before it's saved."
                : "Open a chapter and use “Make flashcards”, or create one here once you've picked a chapter."
            }
            action={
              scope.hasChapter ? <Button onClick={() => setMaking(true)}>Make a deck</Button> : undefined
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {decks.map((deck) => (
              <li key={deck.id} className="rounded-xl border border-card-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-card-title">{deck.title}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {deck.total} cards · {deck.due} due
                      {deck.fresh > 0 ? ` · ${deck.fresh} never seen` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button size="sm" onClick={() => setStudying(deck.id)} disabled={deck.total === 0}>
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      {deck.due > 0 ? `Study ${deck.due}` : "Study"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      aria-label={`Delete the deck ${deck.title}`}
                      onClick={() => {
                        if (window.confirm(`Delete “${deck.title}” and its ${deck.total} cards?`)) {
                          deleteDeck(deck.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <ProgressBar
                  value={deck.strength}
                  size="sm"
                  className="mt-3"
                  tone={deck.strength >= 70 ? "success" : "primary"}
                  label={`${deck.strength}% of the way through the schedule`}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>
            How the schedule works: cards sit on a ladder of six steps — 10 minutes, 1 day, 3 days,
            7 days, 16 days, 35 days. <strong>Again</strong> sends a card back to the bottom,{" "}
            <strong>Hard</strong> keeps it where it is, <strong>Good</strong> moves it up one and{" "}
            <strong>Easy</strong> moves it up two. That is the whole algorithm.
          </p>
        </div>
      </PageShell>
    </>
  );
}

function StudySession({ deckId, onExit }: { deckId: string; onExit: () => void }) {
  const { deck, dueIn, cardsIn } = useFlashcards();
  const { prefs } = usePreferences();

  const [queue, setQueue] = React.useState<Flashcard[]>([]);
  const [position, setPosition] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const [graded, setGraded] = React.useState<{ correct: number; total: number }>({
    correct: 0,
    total: 0,
  });

  // The queue is fixed when the session starts. Recomputing it as cards are
  // graded would pull a card back in the moment its 10-minute step elapsed,
  // which turns a 20-card session into an endless one.
  React.useEffect(() => {
    const due = dueIn(deckId, prefs.flashcardBatch);
    setQueue(due.length > 0 ? due : cardsIn(deckId).slice(0, prefs.flashcardBatch));
    setPosition(0);
    setRevealed(false);
    setGraded({ correct: 0, total: 0 });
    // Intentionally only on deck change — see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, prefs.flashcardBatch]);

  const card = queue[position];
  const info = deck(deckId);
  const done = queue.length > 0 && position >= queue.length;

  function grade(grade: CardGrade) {
    if (!card) return;
    gradeCard(card.id, grade);
    const correct = grade === "good" || grade === "easy" ? 1 : 0;
    const next = { correct: graded.correct + correct, total: graded.total + 1 };
    setGraded(next);

    if (position + 1 >= queue.length) {
      // One mastery entry per session, not per card — a card review is much
      // weaker evidence than a quiz question, and reporting twenty of them
      // would let flashcards dominate the mastery signal.
      if (info?.subjectId && info?.chapterId) {
        recordMasteryAttempt(
          {
            key: chapterKey(info.subjectId, info.chapterId),
            domain: "chapter",
            label: info.title,
            subjectId: info.subjectId,
            chapterId: info.chapterId,
          },
          { correct: next.correct, total: next.total },
        );
      }
    }
    setPosition((p) => p + 1);
    setRevealed(false);
  }

  if (!info) {
    return (
      <PageShell width="content">
        <EmptyState icon={Layers} title="Deck not found" action={<Button onClick={onExit}>Back</Button>} />
      </PageShell>
    );
  }

  if (done) {
    const pct = graded.total > 0 ? Math.round((graded.correct / graded.total) * 100) : 0;
    return (
      <PageShell width="content">
        <div className="rounded-xl border border-card-border bg-card p-6 text-center">
          <Check className="mx-auto h-8 w-8 text-success" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-bold">Session done</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {graded.total} cards reviewed · {pct}% you knew straight away
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={onExit}>Back to decks</Button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!card) {
    return (
      <PageShell width="content">
        <EmptyState
          icon={Layers}
          title="Nothing due"
          description="Every card in this deck is scheduled for later. That is the schedule working."
          action={<Button onClick={onExit}>Back to decks</Button>}
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="content">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {info.title}
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">
          {position + 1} / {queue.length}
        </span>
      </div>

      <ProgressBar
        value={(position / queue.length) * 100}
        label={`${position} of ${queue.length} reviewed`}
        className="mb-5"
      />

      <div className="rounded-xl border border-card-border bg-card p-6 text-center">
        <p className="text-eyebrow text-muted-foreground">{BOX_LABELS[card.box]}</p>
        <p className="mt-3 text-lg font-medium leading-snug">{card.front}</p>

        {revealed ? (
          <>
            <hr className="my-5 border-border" />
            <p className="text-[0.9375rem] leading-relaxed text-foreground/90">{card.back}</p>
          </>
        ) : (
          <>
            {card.hint && <p className="mt-3 text-xs text-muted-foreground">Hint: {card.hint}</p>}
            <Button className="mt-5" onClick={() => setRevealed(true)} data-testid="button-reveal-card">
              Reveal
            </Button>
          </>
        )}
      </div>

      {revealed && (
        <div className="mt-4">
          <p className="text-eyebrow mb-2 text-center text-muted-foreground">How did that go?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => grade(g)}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center rounded-xl border bg-card px-2 py-2.5 transition-colors",
                  GRADE_INFO[g].className,
                )}
              >
                <span className="text-sm font-semibold">{GRADE_INFO[g].label}</span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">{GRADE_INFO[g].hint}</span>
                <span className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {describeSchedule(
                    g === "again" ? 0 : g === "hard" ? card.box : g === "good" ? card.box + 1 : card.box + 2,
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
