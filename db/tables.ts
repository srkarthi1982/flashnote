import { column, defineTable, NOW } from "astro:db";

/**
 * A flashcard deck created by a user.
 * Example: "Class 11 – Physics: Kinematics"
 */
export const FlashcardDecks = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    // Owner from parent Users.id
    ownerId: column.text(),

    title: column.text(),
    description: column.text({ optional: true }),

    // Where this deck came from
    sourceType: column.text({
      enum: ["manual", "note", "pdf", "web", "other"],
      default: "manual",
    }),

    // JSON metadata: original note id, file name, URL, etc.
    sourceMeta: column.json({ optional: true }),

    // Basic tags / subject info (simple for now)
    tags: column.text({ optional: true }),

    isActive: column.boolean({ default: true }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

/**
 * Individual flashcards inside a deck.
 */
export const Flashcards = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    deckId: column.number({ references: () => FlashcardDecks.columns.id }),

    // Order inside the deck
    displayOrder: column.number({ default: 0 }),

    // Card content
    front: column.text(),
    back: column.text(),

    // Optional extra fields
    hint: column.text({ optional: true }),
    extra: column.json({ optional: true }), // examples, references, etc.

    isActive: column.boolean({ default: true }),
  },
});

/**
 * A study session for a given deck.
 * One row ~= one "sit-down" revision session.
 */
export const StudySessions = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    deckId: column.number({ references: () => FlashcardDecks.columns.id }),

    // learner
    userId: column.text({ optional: true }),

    startedAt: column.date({ default: NOW }),
    completedAt: column.date({ optional: true }),

    totalCardsSeen: column.number({ default: 0 }),
    correctCount: column.number({ default: 0 }),
    wrongCount: column.number({ default: 0 }),

    // Any extra session stats
    summary: column.json({ optional: true }),
  },
});

/**
 * Per-card review info (for spaced repetition / history).
 */
export const FlashcardReviews = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    deckId: column.number({ references: () => FlashcardDecks.columns.id }),
    cardId: column.number({ references: () => Flashcards.columns.id }),

    // Who reviewed
    userId: column.text({ optional: true }),

    // Optional link to a session
    sessionId: column.number({
      references: () => StudySessions.columns.id,
      optional: true,
    }),

    // Rating given after seeing the card
    rating: column.text({
      enum: ["again", "hard", "good", "easy"],
      default: "good",
    }),

    // Basic spaced repetition fields
    reviewedAt: column.date({ default: NOW }),
    dueAt: column.date({ optional: true }),
    intervalDays: column.number({ default: 0 }),

    easeFactor: column.number({ optional: true }), // e.g. 2.5
  },
});

export const flashnoteTables = {
  FlashcardDecks,
  Flashcards,
  StudySessions,
  FlashcardReviews,
} as const;
