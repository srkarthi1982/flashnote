import { defineDb } from "astro:db";
import { Bookmark, Faq, FlashcardDecks, FlashcardReviews, Flashcards, StudySessions } from "./tables";

export default defineDb({
  tables: {
    FlashcardDecks,
    Flashcards,
    StudySessions,
    FlashcardReviews,
    Bookmark,
    Faq,
  },
});
