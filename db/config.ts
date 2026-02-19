import { defineDb } from "astro:db";
import { Faq, FlashcardDecks, FlashcardReviews, Flashcards, StudySessions } from "./tables";

export default defineDb({
  tables: {
    FlashcardDecks,
    Flashcards,
    StudySessions,
    FlashcardReviews,
    Faq,
  },
});
