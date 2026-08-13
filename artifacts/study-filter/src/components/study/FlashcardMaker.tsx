import React from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Layers, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/primitives";
import { UnitError } from "@/components/hub/UnitState";
import { errorMessage } from "@/lib/api";
import { generateFlashcards } from "@/lib/study-content";
import { createDeck, type DraftCard } from "@/hooks/use-flashcards";
import type { ResolvedScope } from "@/lib/scope";
import { cn } from "@/lib/utils";

/**
 * Generate → review → save.
 *
 * The review step is not decoration. A flashcard is a thing a student sets out
 * to memorise, so a wrong one does more damage than a wrong paragraph in an
 * explanation — they will drill it until they believe it. Nothing generated
 * here is written to a deck until a person has looked at it, and every card is
 * editable and removable in place.
 */
export function FlashcardMaker({
  scope,
  passage,
  source = "chapter",
  defaultCount = 12,
  onSaved,
}: {
  scope: ResolvedScope;
  /** Selected text to build cards from, instead of the whole chapter. */
  passage?: string;
  source?: "chapter" | "selection" | "answer" | "manual";
  defaultCount?: number;
  onSaved?: (deckId: string) => void;
}) {
  const [drafts, setDrafts] = React.useState<DraftCard[] | null>(null);
  const [savedId, setSavedId] = React.useState<string | null>(null);

  const generate = useMutation({
    mutationFn: () =>
      generateFlashcards({
        classLevel: scope.classLevel,
        ...(scope.subject ? { subject: scope.subject.name } : {}),
        ...(scope.chapter ? { chapter: scope.chapter.title } : {}),
        ...(scope.topic ? { topic: scope.topic } : {}),
        ...(passage ? { passage } : {}),
        count: defaultCount,
      }),
    onSuccess: (result) => setDrafts(result.cards.map((c) => ({ ...c }))),
  });

  function update(index: number, patch: Partial<DraftCard>) {
    setDrafts((prev) => prev?.map((card, i) => (i === index ? { ...card, ...patch } : card)) ?? prev);
  }

  function remove(index: number) {
    setDrafts((prev) => prev?.filter((_, i) => i !== index) ?? prev);
  }

  function save() {
    if (!drafts || drafts.length === 0) return;
    const title =
      scope.topic ?? scope.chapter?.title ?? scope.subject?.name ?? "Flashcards";
    const deckId = createDeck(
      {
        title,
        ...(scope.subjectId ? { subjectId: scope.subjectId } : {}),
        ...(scope.chapterId ? { chapterId: scope.chapterId } : {}),
        ...(scope.topic ? { topic: scope.topic } : {}),
        source,
      },
      drafts,
    );
    setSavedId(deckId);
    onSaved?.(deckId);
  }

  if (savedId) {
    return (
      <div className="rounded-xl border border-success/35 bg-success-soft/50 p-4 text-center">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-success">
          <Check className="h-4 w-4" aria-hidden="true" />
          Deck saved
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {drafts?.length} cards, all due now. Study them whenever you like.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => {
            setSavedId(null);
            setDrafts(null);
          }}
        >
          Make another set
        </Button>
      </div>
    );
  }

  if (generate.isError) {
    return (
      <UnitError
        message={errorMessage(generate.error, "We couldn't make cards for that.")}
        onRetry={() => generate.mutate()}
        retrying={generate.isPending}
      />
    );
  }

  if (!drafts) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/60 p-5 text-center">
        <Layers className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium">
          {passage ? "Cards from the passage you selected" : `Cards from ${scope.chapter?.title ?? "this topic"}`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          You&rsquo;ll see every card before anything is saved.
        </p>
        <Button className="mt-3" onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? <Spinner /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}
          {generate.isPending ? "Writing cards…" : "Generate cards"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {drafts.length} cards. Edit anything that isn&rsquo;t right, drop what you don&rsquo;t want.
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDrafts([...drafts, { front: "", back: "" }])}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add a card
        </Button>
      </div>

      <ol className="space-y-2">
        {drafts.map((card, i) => (
          <li key={i} className="rounded-xl border border-card-border bg-card p-3">
            <div className="flex items-start gap-2">
              <span className="mt-2 text-xs font-semibold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <CardField
                  label="Front"
                  value={card.front}
                  onChange={(value) => update(i, { front: value })}
                />
                <CardField
                  label="Back"
                  value={card.back}
                  onChange={(value) => update(i, { back: value })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(i)}
                aria-label={`Remove card ${i + 1}`}
                className="h-8 w-8 shrink-0 text-muted-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={drafts.length === 0} className="flex-1">
          Save {drafts.length} cards
        </Button>
        <Button variant="ghost" onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? <Spinner /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}
          Regenerate
        </Button>
      </div>
    </div>
  );
}

function CardField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <textarea
        rows={value.length > 70 ? 3 : 1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className={cn(
          "w-full resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-sm",
          "focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15",
        )}
      />
    </label>
  );
}
