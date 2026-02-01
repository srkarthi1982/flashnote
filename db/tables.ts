import { column, defineTable, NOW } from "astro:db";

export const FlashcardDecks = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),
    ownerId: column.text(),
    title: column.text(),
    description: column.text({ optional: true }),
    sourceType: column.text({ optional: true }),
    sourceMeta: column.text({ optional: true }),
    tags: column.text({ optional: true }),
    isActive: column.boolean({ default: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const Flashcards = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),
    deckId: column.number({ references: () => FlashcardDecks.columns.id }),
    displayOrder: column.number({ default: 0 }),
    userId: column.text({ optional: true }),
    front: column.text(),
    back: column.text(),
    hint: column.text({ optional: true }),
    extra: column.text({ optional: true }),
    isActive: column.boolean({ default: true }),
    sourceType: column.text({ enum: ["manual", "quiz", "ai"], default: "manual" }),
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
    completedAt: column.date({ optional: true }),
    totalCardsSeen: column.number({ default: 0 }),
    correctCount: column.number({ default: 0 }),
    wrongCount: column.number({ default: 0 }),
    summary: column.json({ optional: true }),
  },
});

export const FlashcardReviews = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),
    userId: column.text(),
    cardId: column.number({ references: () => Flashcards.columns.id }),
    deckId: column.number({ references: () => FlashcardDecks.columns.id }),
    sessionId: column.number({ references: () => StudySessions.columns.id, optional: true }),
    rating: column.text(),
    reviewedAt: column.date({ default: NOW }),
    dueAt: column.date({ optional: true }),
    intervalDays: column.number({ optional: true }),
    easeFactor: column.number({ optional: true }),
  },
});

export const flashnoteTables = {
  FlashcardDecks,
  Flashcards,
  StudySessions,
  FlashcardReviews,
} as const;
