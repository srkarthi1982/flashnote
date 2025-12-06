import { defineDb } from "astro:db";
import {
  FlashcardDecks,
  Flashcards,
  StudySessions,
  FlashcardReviews,
} from "./tables";

// https://astro.build/db/config
export default defineDb({
  tables: {
    FlashcardDecks,
    Flashcards,
    StudySessions,
    FlashcardReviews,
  },
});
