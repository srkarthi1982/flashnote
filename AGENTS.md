⚠️ Mandatory: AI agents must read this file before writing or modifying any code in the flashnote repo.

# AGENTS.md
## FlashNote Repo – Session Notes (Codex)

This file records what was built/changed so far for the flashnote repo. Read first.

---

## 1. Current Architecture (FlashNote)

- FlashNote mini-app aligned to Ansiversa standards.
- Astro DB schema for decks, cards, sessions, and reviews.
- Astro actions for decks/cards CRUD, quiz import, and study reviews.
- Global Alpine store (`flashnote`) powering decks + study pages.
- Quiz API read-only import client.
- Parent notifications + dashboard activity webhooks wired.

---

## 2. DB Tables

- `FlashcardDecks`
- `Flashcards`
- `StudySessions`
- `FlashcardReviews`

---

## 3. Task Log (Newest first)

- 2026-01-29 Flushed app-starter into FlashNote and rebranded app metadata, README, and layouts.
- 2026-01-29 Replaced starter example module with FlashNote DB schema, actions, Alpine store, and V1 pages (landing, decks, deck detail, study flow).
- 2026-01-29 Added Quiz API import client plus parent notifications + dashboard activity hooks.
- 2026-01-29 Created repo-level AGENTS.md for FlashNote per workspace requirement.

---

## 4. Verification Log

- 2026-01-29 `npm run typecheck` (pass; 1 TypeScript hint in `src/actions/baseRepository.ts`).
- 2026-01-29 `npm run build` (pass).
- 2026-01-29 `npm run db:push` (failed; see BLOCKED).

---

## BLOCKED

- `npm run db:push` failed: "Cannot convert undefined or null to object" at `node_modules/drizzle-orm/libsql/session.js:190:17`.
