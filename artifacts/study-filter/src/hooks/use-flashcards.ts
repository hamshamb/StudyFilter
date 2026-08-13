import React from "react";
import { createStore, isObject, list, newId, num, oneOf, str, useStore } from "@/lib/store";

/**
 * Flashcards, with a spaced-repetition schedule simple enough to explain.
 *
 * The scheduling is a plain Leitner-style ladder, not SM-2 and not anything
 * claiming to be adaptive. Each card sits on a box, each box has a fixed
 * interval, and the four review buttons move it:
 *
 *   Again → back to box 0, due in 10 minutes
 *   Hard  → stays on its box, due at that box's interval
 *   Good  → up one box
 *   Easy  → up two boxes
 *
 * Intervals: 10 minutes, 1 day, 3 days, 7 days, 16 days, 35 days.
 *
 * That is the entire model, and it is written on the screen where a student
 * can see it. A more sophisticated algorithm would be easy to *claim* and
 * impossible to justify from the handful of reviews this app will ever see;
 * an honest ladder that visibly does what it says is worth more than a
 * half-implemented SM-2 with invented ease factors.
 */

export const BOX_INTERVALS_MS = [
  10 * 60 * 1000,
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
  16 * 24 * 60 * 60 * 1000,
  35 * 24 * 60 * 60 * 1000,
] as const;

export const BOX_LABELS = [
  "New",
  "Seen once",
  "Getting there",
  "Familiar",
  "Well known",
  "Long term",
] as const;

export const MAX_BOX = BOX_INTERVALS_MS.length - 1;

export const GRADES = ["again", "hard", "good", "easy"] as const;
export type CardGrade = (typeof GRADES)[number];

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  hint?: string;
  box: number;
  /** Epoch ms this card next becomes due. */
  dueAt: number;
  reviews: number;
  lapses: number;
  createdAt: number;
}

export interface Deck {
  id: string;
  title: string;
  subjectId?: string;
  chapterId?: string;
  /** Free-text topic when the deck isn't tied to a chapter. */
  topic?: string;
  createdAt: number;
  /** Where the cards came from — shown so a student can judge them. */
  source: "chapter" | "selection" | "answer" | "manual";
}

interface FlashcardData {
  decks: Deck[];
  cards: Flashcard[];
}

const SOURCES = ["chapter", "selection", "answer", "manual"] as const;

const store = createStore<FlashcardData>({
  key: "sf_flashcards",
  version: 1,
  fallback: () => ({ decks: [], cards: [] }),
  parse: (raw) => {
    if (!isObject(raw)) return null;
    const decks = list<Deck>(raw.decks, (item) => {
      if (!isObject(item)) return null;
      const id = str(item.id);
      const title = str(item.title);
      if (!id || !title) return null;
      const deck: Deck = {
        id,
        title,
        createdAt: num(item.createdAt, Date.now()),
        source: oneOf(item.source, SOURCES, "manual"),
      };
      const subjectId = str(item.subjectId);
      const chapterId = str(item.chapterId);
      const topic = str(item.topic);
      if (subjectId) deck.subjectId = subjectId;
      if (chapterId) deck.chapterId = chapterId;
      if (topic) deck.topic = topic;
      return deck;
    });
    const cards = list<Flashcard>(raw.cards, (item) => {
      if (!isObject(item)) return null;
      const id = str(item.id);
      const front = str(item.front);
      const back = str(item.back);
      if (!id || !front || !back) return null;
      const card: Flashcard = {
        id,
        deckId: str(item.deckId),
        front,
        back,
        box: Math.max(0, Math.min(MAX_BOX, num(item.box))),
        dueAt: num(item.dueAt, Date.now()),
        reviews: Math.max(0, num(item.reviews)),
        lapses: Math.max(0, num(item.lapses)),
        createdAt: num(item.createdAt, Date.now()),
      };
      const hint = str(item.hint);
      if (hint) card.hint = hint;
      return card;
    });
    // A card whose deck was deleted has nowhere to be shown.
    const deckIds = new Set(decks.map((d) => d.id));
    return { decks, cards: cards.filter((c) => deckIds.has(c.deckId)) };
  },
});

export interface DraftCard {
  front: string;
  back: string;
  hint?: string;
}

/**
 * Creates a deck from reviewed drafts.
 *
 * Deliberately takes drafts rather than saving generated cards directly: the
 * generator is good but not always right, and a wrong flashcard is actively
 * harmful — it is designed to be memorised. Every path into this function goes
 * through a screen where the student can edit or drop each card first.
 */
export function createDeck(
  deck: Omit<Deck, "id" | "createdAt">,
  drafts: DraftCard[],
): string {
  const deckId = newId();
  const now = Date.now();
  const cards: Flashcard[] = drafts
    .filter((d) => d.front.trim() && d.back.trim())
    .map((d) => ({
      id: newId(),
      deckId,
      front: d.front.trim(),
      back: d.back.trim(),
      ...(d.hint?.trim() ? { hint: d.hint.trim() } : {}),
      box: 0,
      // New cards are due immediately — the point of making them is to study
      // them now.
      dueAt: now,
      reviews: 0,
      lapses: 0,
      createdAt: now,
    }));

  store.set((prev) => ({
    decks: [{ ...deck, id: deckId, createdAt: now }, ...prev.decks],
    cards: [...cards, ...prev.cards],
  }));
  return deckId;
}

export function addCardsToDeck(deckId: string, drafts: DraftCard[]): void {
  const now = Date.now();
  const cards: Flashcard[] = drafts
    .filter((d) => d.front.trim() && d.back.trim())
    .map((d) => ({
      id: newId(),
      deckId,
      front: d.front.trim(),
      back: d.back.trim(),
      ...(d.hint?.trim() ? { hint: d.hint.trim() } : {}),
      box: 0,
      dueAt: now,
      reviews: 0,
      lapses: 0,
      createdAt: now,
    }));
  store.set((prev) => ({ ...prev, cards: [...cards, ...prev.cards] }));
}

export function deleteDeck(deckId: string): void {
  store.set((prev) => ({
    decks: prev.decks.filter((d) => d.id !== deckId),
    cards: prev.cards.filter((c) => c.deckId !== deckId),
  }));
}

export function deleteCard(cardId: string): void {
  store.set((prev) => ({ ...prev, cards: prev.cards.filter((c) => c.id !== cardId) }));
}

export function updateCard(cardId: string, patch: Partial<Pick<Flashcard, "front" | "back" | "hint">>): void {
  store.set((prev) => ({
    ...prev,
    cards: prev.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)),
  }));
}

/** Applies one review. Pure schedule, exactly as documented at the top. */
export function gradeCard(cardId: string, grade: CardGrade, now = Date.now()): void {
  store.set((prev) => ({
    ...prev,
    cards: prev.cards.map((card) => {
      if (card.id !== cardId) return card;
      let box = card.box;
      let lapses = card.lapses;
      switch (grade) {
        case "again":
          box = 0;
          lapses += 1;
          break;
        case "hard":
          break;
        case "good":
          box = Math.min(MAX_BOX, box + 1);
          break;
        case "easy":
          box = Math.min(MAX_BOX, box + 2);
          break;
      }
      return {
        ...card,
        box,
        lapses,
        reviews: card.reviews + 1,
        dueAt: now + BOX_INTERVALS_MS[box]!,
      };
    }),
  }));
}

export function describeSchedule(box: number): string {
  const ms = BOX_INTERVALS_MS[Math.max(0, Math.min(MAX_BOX, box))]!;
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / 60000)} minutes`;
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  return days === 1 ? "1 day" : `${days} days`;
}

export interface DeckSummary extends Deck {
  total: number;
  due: number;
  /** Cards that have never been reviewed. */
  fresh: number;
  /** 0–100: how far the deck has climbed the ladder overall. */
  strength: number;
}

export function summariseDeck(deck: Deck, cards: Flashcard[], now = Date.now()): DeckSummary {
  const mine = cards.filter((c) => c.deckId === deck.id);
  const strength =
    mine.length === 0
      ? 0
      : Math.round((mine.reduce((sum, c) => sum + c.box, 0) / (mine.length * MAX_BOX)) * 100);
  return {
    ...deck,
    total: mine.length,
    due: mine.filter((c) => c.dueAt <= now).length,
    fresh: mine.filter((c) => c.reviews === 0).length,
    strength,
  };
}

export function useFlashcards() {
  const data = useStore(store);

  return React.useMemo(() => {
    const now = Date.now();
    const summaries = data.decks.map((deck) => summariseDeck(deck, data.cards, now));
    return {
      decks: summaries,
      cards: data.cards,
      deck: (deckId: string) => summaries.find((d) => d.id === deckId) ?? null,
      cardsIn: (deckId: string) => data.cards.filter((c) => c.deckId === deckId),
      /**
       * The next batch to study. Due cards first, oldest due first, so a
       * backlog drains in the order it built up rather than randomly.
       */
      dueIn: (deckId: string, limit: number) =>
        data.cards
          .filter((c) => c.deckId === deckId && c.dueAt <= now)
          .sort((a, b) => a.dueAt - b.dueAt)
          .slice(0, limit),
      dueEverywhere: data.cards.filter((c) => c.dueAt <= now).length,
      totalCards: data.cards.length,
    };
  }, [data]);
}

export function readDecks(): Deck[] {
  return store.get().decks;
}

export function clearFlashcards(): void {
  store.clear();
}
