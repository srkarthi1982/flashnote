import {
  FlashcardDecks,
  FlashcardReviews,
  Flashcards,
  StudySessions,
  and,
  count,
  db,
  desc,
  eq,
  gte,
} from "astro:db";

export type FlashnoteDashboardSummaryV1 = {
  appId: "flashnote";
  version: 1;
  updatedAt: string;
  decksCount: number;
  cardsCount: number;
  reviewsToday: number;
  lastStudyAt: string | null;
  lastImportedFromQuizAt: string | null;
};

const toIso = (value?: Date | string | null) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const buildFlashnoteDashboardSummary = async (
  userId: string,
): Promise<FlashnoteDashboardSummaryV1> => {
  const updatedAt = new Date().toISOString();

  const [{ total: decksRaw } = { total: 0 }] = await db
    .select({ total: count() })
    .from(FlashcardDecks)
    .where(eq(FlashcardDecks.ownerId, userId));

  const [{ total: cardsRaw } = { total: 0 }] = await db
    .select({ total: count() })
    .from(Flashcards)
    .where(eq(Flashcards.userId, userId));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [{ total: reviewsRaw } = { total: 0 }] = await db
    .select({ total: count() })
    .from(FlashcardReviews)
    .where(and(eq(FlashcardReviews.userId, userId), gte(FlashcardReviews.reviewedAt, todayStart)));

  const lastSessionRow = await db
    .select({ completedAt: StudySessions.completedAt, startedAt: StudySessions.startedAt })
    .from(StudySessions)
    .where(eq(StudySessions.userId, userId))
    .orderBy(desc(StudySessions.completedAt), desc(StudySessions.startedAt), desc(StudySessions.id))
    .limit(1);

  const lastStudyAt =
    toIso(lastSessionRow?.[0]?.completedAt) ?? toIso(lastSessionRow?.[0]?.startedAt) ?? null;

  const lastImportRow = await db
    .select({ createdAt: Flashcards.createdAt })
    .from(Flashcards)
    .where(and(eq(Flashcards.userId, userId), eq(Flashcards.sourceType, "quiz")))
    .orderBy(desc(Flashcards.createdAt), desc(Flashcards.id))
    .limit(1);

  const lastImportedFromQuizAt = toIso(lastImportRow?.[0]?.createdAt);

  return {
    appId: "flashnote",
    version: 1,
    updatedAt,
    decksCount: Number(decksRaw ?? 0),
    cardsCount: Number(cardsRaw ?? 0),
    reviewsToday: Number(reviewsRaw ?? 0),
    lastStudyAt,
    lastImportedFromQuizAt,
  };
};
