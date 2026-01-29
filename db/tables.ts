import { column, defineTable, NOW } from "astro:db";

export const FlashcardDecks = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),
    userId: column.text(),
    title: column.text(),
    description: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const Flashcards = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),
    deckId: column.number({ references: () => FlashcardDecks.columns.id }),
    userId: column.text(),
    front: column.text(),
    back: column.text(),
    sourceType: column.text({ enum: ["manual", "quiz"], default: "manual" }),
    sourceRefId: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const StudySessions = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),
    userId: column.text(),
    deckId: column.number({ references: () => FlashcardDecks.columns.id }),
    startedAt: column.date({ default: NOW }),
    endedAt: column.date({ optional: true }),
  },
});

export const FlashcardReviews = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),
    userId: column.text(),
    cardId: column.number({ references: () => Flashcards.columns.id }),
    sessionId: column.number({ references: () => StudySessions.columns.id, optional: true }),
    rating: column.number(),
    nextReviewAt: column.date({ optional: true }),
    reviewedAt: column.date({ default: NOW }),
    easeFactor: column.number({ optional: true }),
    intervalDays: column.number({ optional: true }),
  },
});

export const flashnoteTables = {
  FlashcardDecks,
  Flashcards,
  StudySessions,
  FlashcardReviews,
} as const;
