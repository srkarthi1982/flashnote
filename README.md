# FlashNote

FlashNote is the Ansiversa mini-app for building flashcard decks, importing Quiz questions, and running focused study sessions.

## Freeze status

FlashNote V1 (Freeze Phase) — verification + bug fixes only.

## Quick start

1) Install dependencies

```
npm ci
```

2) Configure env vars (see `src/env.d.ts` for the full list)

- `ANSIVERSA_AUTH_SECRET`
- `ANSIVERSA_SESSION_SECRET`
- `ANSIVERSA_COOKIE_DOMAIN`
- `PUBLIC_ROOT_APP_URL` (optional)
- `PARENT_APP_URL` (optional)
- `ANSIVERSA_WEBHOOK_SECRET` (dashboard + notifications)
- `QUIZ_API_BASE_URL` (Quiz import)
- `PARENT_NOTIFICATION_WEBHOOK_URL` (optional override)

3) Run the app

```
npm run dev
```

## How FlashNote works

- **Parent app** (ansiversa.com) handles auth, notifications, and dashboard aggregation.
- **FlashNote** trusts the parent session cookie and uses shared shells + middleware.
- Decks, cards, and reviews live in FlashNote’s Astro DB.
- Quiz import is read-only from the Quiz app API.

## Local dev without parent app

Enable the DEV bypass in `.env` to inject a dummy session locally:

```
DEV_BYPASS_AUTH=true npm run dev
```

Optional overrides:

```
DEV_BYPASS_USER_ID=dev-user
DEV_BYPASS_EMAIL=dev@local
DEV_BYPASS_ROLE_ID=1
```

## First run checklist

You should be able to:

- Open `/` and see the FlashNote landing
- Open `/decks` and create a deck
- Open `/decks/[id]` and add cards
- Open `/study/[deckId]` and review cards
- Import from Quiz (requires `QUIZ_API_BASE_URL` and a valid session)

## Commands

- `npm run dev`
- `npm run typecheck`
- `npm run build`
- `npm run db:push`

## Database workflow (standard)

FlashNote uses file-based remote DB locally for consistency.
`npm run dev` and `npm run build` run in `--remote` mode against `.astro/content.db`.
Use `npm run db:push` as the single schema push command.

---

Ansiversa motto: Make it simple — but not simpler.
