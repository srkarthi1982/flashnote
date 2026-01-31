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

- 2026-01-31 Normalized payment fields in `Astro.locals.user` to avoid undefined values (stripeCustomerId/plan/planStatus/isPaid/renewalAt).
- 2026-01-31 Added locals.session payment flags in middleware/types and a temporary `/admin/session` debug page for Phase 2 verification.
- 2026-01-30 Rebuilt landing page to match Quiz structure with FlashNote-specific content, stats, and sections.
- 2026-01-29 Manual smoke test confirmed: Quiz completion triggers notifications ("Quiz completed", "Results saved") visible in parent `/notifications` UI.
- 2026-01-29 Updated .env.example with required prod vars and dev helper notes.

- 2026-01-29 Fixed deck list Open button by switching to Alpine-bound anchor (AvButton SSR props are static).

- 2026-01-29 Fixed remote db:push by aligning schema to existing FlashNote Turso DB columns and updating FlashNote DB env URL.
- 2026-01-29 Flushed app-starter into FlashNote and rebranded app metadata, README, and layouts.
- 2026-01-29 Replaced starter example module with FlashNote DB schema, actions, Alpine store, and V1 pages (landing, decks, deck detail, study flow).
- 2026-01-29 Added Quiz API import client plus parent notifications + dashboard activity hooks.
- 2026-01-29 Created repo-level AGENTS.md for FlashNote per workspace requirement.

---

## 4. Verification Log

- 2026-01-31 Pending manual check: paid user sees non-null fields; free user sees null/false in `Astro.locals.user`.
- 2026-01-31 Pending manual check: `/admin/session` shows isPaid true for paid user and false for free user.
- 2026-01-29 `npm run typecheck` (pass; 1 TypeScript hint in `src/actions/baseRepository.ts`).
- 2026-01-29 `npm run build` (pass).
- 2026-01-29 `npm run db:push` (pass after schema alignment).

---

## 5. db:push Investigation Notes

Initial failure (before env fix):
- `npm run db:push` → "Cannot convert undefined or null to object" at `node_modules/drizzle-orm/libsql/session.js:190:17`.

After adding remote DB env:
- Detected schema mismatch against wrong DB (Resume Builder). Updated `ASTRO_DB_REMOTE_URL` to FlashNote DB.
- Subsequent schema diff errors showed existing remote columns; aligned schema to:
  - `FlashcardDecks`: ownerId, title, description, sourceType, sourceMeta, tags, isActive, createdAt, updatedAt
  - `Flashcards`: deckId, displayOrder, front, back, hint, extra, isActive (kept new fields as optional)
  - `StudySessions`: completedAt, totalCardsSeen, correctCount, wrongCount, summary
  - `FlashcardReviews`: rating (text), dueAt, deckId

Final run:
- `npm run db:push` completed successfully.
