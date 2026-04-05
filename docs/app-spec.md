# App Spec: flashnote

## 1) App Overview
- **App Name:** FlashNote
- **Category:** Learning
- **Version:** V1
- **App Type:** Hybrid
- **Purpose:** Help an authenticated user build flashcard decks, add cards manually or from supported sources, and run study sessions with persisted review history.
- **Primary User:** A single signed-in learner using personal decks.

## 2) User Stories
- As a user, I want to create decks and cards, so that I can build focused study material.
- As a user, I want to study a deck and record review outcomes, so that I can revisit cards over time.
- As a user, I want to import or generate cards from supported sources, so that I can bootstrap decks faster when those integrations are available.

## 3) Core Workflow
1. User signs in and opens `/decks`.
2. User creates a deck, then adds cards manually or through supported import/generation flows.
3. User opens `/decks/[id]` to manage card content and deck metadata.
4. User starts a study session at `/study/[deckId]`, reviews cards, and records outcomes.
5. The app stores decks, cards, sessions, and review history for later reuse.

## 4) Functional Behavior
- FlashNote persists deck, card, session, and review data in Astro DB for the authenticated user.
- The app supports manual deck/card CRUD plus source-aware card creation (`manual`, `quiz`, `ai`) in the current schema.
- Quiz import is read-only and depends on an external Quiz API configuration.
- Current implementation also includes AI-assisted generation/history flows and Pro-style gating around premium generation paths.
- Study sessions track total seen, correct, wrong, and per-card review rows rather than being a temporary browser-only drill.
- The app includes bookmarks, FAQs, parent notification hooks, and dashboard activity integration in addition to the core deck workflow.

## 5) Data & Storage
- **Storage type:** Astro DB plus external integration reads
- **Main entities:** `FlashcardDecks`, `Flashcards`, `StudySessions`, `FlashcardReviews`, `Bookmark`, `Faq`
- **Persistence expectations:** Decks, cards, and review history persist per authenticated user; external imports feed into local storage rather than remaining remote-only.
- **User model:** Single-user per deck ownership

## 6) Special Logic (Optional)
- Card origin tracking allows the app to distinguish manual, Quiz-imported, and AI-generated cards in V1.
- Study progress is persisted through both session-level summaries and per-card review rows, enabling future spaced-repetition-style behavior.
- External integrations are additive only; FlashNote remains usable as a standalone deck-and-study app even when import/generation paths are unavailable.

## 7) Edge Cases & Error Handling
- Missing parent auth: Protected routes rely on the parent Ansiversa session and should redirect rather than exposing orphaned app state.
- Missing external configuration: Quiz import or AI generation should fail safely instead of corrupting local deck data.
- Missing deck/card IDs: Invalid deck detail or study routes should not expose another user’s data.
- Free-tier limits or premium gating: Premium generation flows should return clear gating errors rather than silent failure.

## 8) Tester Verification Guide
### Core flow tests
- [ ] Create a deck, add multiple cards manually, and confirm they persist after refresh.
- [ ] Start a study session, review cards, and confirm session totals plus review history update.
- [ ] Edit or delete deck/card content and confirm later study views use the updated data.

### Safety tests
- [ ] Attempt to open an invalid deck or study route and confirm the app fails safely.
- [ ] If Quiz import is configured, import into a deck and confirm imported cards persist locally.
- [ ] If AI generation is enabled, verify the gating path is truthful for free vs. paid users.

### Negative tests
- [ ] Confirm FlashNote does not own authentication or billing inside this repo.
- [ ] Confirm the app still works for manual deck/card study even if external import/generation integrations are unavailable.

## 9) Out of Scope (V1)
- Shared classrooms or collaborative deck editing
- Calendar scheduling for study plans
- Offline-first sync conflict resolution
- Independent billing implementation inside the mini-app

## 10) Freeze Notes
- V1 freeze: this document reflects the persisted deck/card/study implementation plus the currently wired source integrations.
- Some integration details depend on configured Quiz/AI services; where not browser-verified in this task, this spec stays conservative and implementation-aligned.
- During freeze, only verification fixes, cleanup, and documentation updates are allowed.
