import { FlashcardDecks, FlashcardReviews, Flashcards, StudySessions } from "astro:db";
import { BaseRepository } from "./baseRepository";

type DeckRow = typeof FlashcardDecks.$inferSelect;
type CardRow = typeof Flashcards.$inferSelect;
type SessionRow = typeof StudySessions.$inferSelect;
type ReviewRow = typeof FlashcardReviews.$inferSelect;

export const flashcardDeckRepository = new BaseRepository<typeof FlashcardDecks, DeckRow>(
  FlashcardDecks,
);
export const flashcardRepository = new BaseRepository<typeof Flashcards, CardRow>(Flashcards);
export const studySessionRepository = new BaseRepository<typeof StudySessions, SessionRow>(
  StudySessions,
);
export const flashcardReviewRepository = new BaseRepository<typeof FlashcardReviews, ReviewRow>(
  FlashcardReviews,
);
