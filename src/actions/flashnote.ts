import { ActionError, defineAction, type ActionAPIContext } from "astro:actions";
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
  inArray,
} from "astro:db";
import { z } from "astro:schema";
import { requireUser } from "./_guards";
import { fetchQuizQuestions } from "../lib/quizApi";
import { notifyParent } from "../lib/notifyParent";
import { buildFlashnoteDashboardSummary } from "../dashboard/summary.schema";
import { pushFlashnoteActivity } from "../lib/pushActivity";

const normalizeText = (value?: string | null) => (value ?? "").toString().trim();

const parseNumberId = (value: string | number, label: string) => {
  const raw = typeof value === "string" ? Number.parseInt(value, 10) : value;
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new ActionError({ code: "BAD_REQUEST", message: `${label} is invalid.` });
  }
  return raw;
};

const requireDeck = async (userId: string, deckId: number) => {
  const deck = await db
    .select()
    .from(FlashcardDecks)
    .where(and(eq(FlashcardDecks.id, deckId), eq(FlashcardDecks.ownerId, userId)))
    .get();

  if (!deck) {
    throw new ActionError({ code: "NOT_FOUND", message: "Deck not found." });
  }

  return deck;
};

const requireCard = async (userId: string, cardId: number) => {
  const card = await db
    .select()
    .from(Flashcards)
    .where(and(eq(Flashcards.id, cardId), eq(Flashcards.userId, userId)))
    .get();

  if (!card) {
    throw new ActionError({ code: "NOT_FOUND", message: "Card not found." });
  }

  return card;
};

const deckPayloadSchema = z.object({
  title: z.string().min(1, "Title is required."),
  description: z.string().optional(),
});

const cardPayloadSchema = z.object({
  deckId: z.union([z.number(), z.string()]),
  front: z.string().min(1, "Front text is required."),
  back: z.string().min(1, "Back text is required."),
});

const reviewSchema = z.object({
  cardId: z.union([z.number(), z.string()]),
  rating: z.number().int().min(0).max(5),
  sessionId: z.union([z.number(), z.string()]).optional(),
});

const importSchema = z.object({
  deckId: z.union([z.number(), z.string()]),
  quizId: z.union([z.number(), z.string()]).optional(),
  topicId: z.union([z.number(), z.string()]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

const sessionSchema = z.object({
  deckId: z.union([z.number(), z.string()]),
});

const completeSessionSchema = z.object({
  sessionId: z.union([z.number(), z.string()]),
});

const buildReviewSchedule = (
  rating: number,
  previous?: { intervalDays?: number | null; easeFactor?: number | null },
) => {
  const prevInterval = previous?.intervalDays && previous.intervalDays > 0 ? previous.intervalDays : 1;
  const prevEase = previous?.easeFactor && previous.easeFactor > 0 ? previous.easeFactor : 2.5;

  let easeFactor = prevEase;
  let intervalDays = prevInterval;

  if (rating < 3) {
    intervalDays = 1;
    easeFactor = Math.max(1.3, prevEase - 0.2);
  } else {
    const quality = Math.max(0, Math.min(5, rating));
    easeFactor = Math.max(
      1.3,
      prevEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
    );
    intervalDays = previous?.intervalDays ? Math.round(prevInterval * easeFactor) : rating >= 4 ? 4 : 2;
  }

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);

  return { intervalDays, easeFactor, nextReviewAt };
};

const pushDashboard = async (userId: string, event: string, entityId?: string) => {
  try {
    const summary = await buildFlashnoteDashboardSummary(userId);
    pushFlashnoteActivity({
      userId,
      activity: {
        event,
        occurredAt: new Date().toISOString(),
        entityId,
      },
      summary,
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("pushFlashnoteActivity failed", error);
    }
  }
};

export const flashnote = {
  listDecks: defineAction({
    accept: "json",
    handler: async (_input, context: ActionAPIContext) => {
      const user = requireUser(context);

      const decks = await db
        .select()
        .from(FlashcardDecks)
        .where(eq(FlashcardDecks.ownerId, user.id))
        .orderBy(desc(FlashcardDecks.updatedAt), desc(FlashcardDecks.createdAt));

      const counts = await db
        .select({
          deckId: Flashcards.deckId,
          total: count(),
        })
        .from(Flashcards)
        .where(eq(Flashcards.userId, user.id))
        .groupBy(Flashcards.deckId);

      const countMap = new Map<number, number>(
        counts.map((row) => [Number(row.deckId), Number(row.total ?? 0)]),
      );

      return {
        items: decks.map((deck) => ({
          ...deck,
          cardsCount: countMap.get(Number(deck.id)) ?? 0,
        })),
      };
    },
  }),

  createDeck: defineAction({
    accept: "json",
    input: deckPayloadSchema,
    handler: async (input, context: ActionAPIContext) => {
      const user = requireUser(context);
      const title = normalizeText(input.title);
      if (!title) {
        throw new ActionError({ code: "BAD_REQUEST", message: "Title is required." });
      }

      const now = new Date();
      const description = normalizeText(input.description ?? "") || null;

      const [deck] = await db
        .insert(FlashcardDecks)
        .values({
          ownerId: user.id,
          title,
          description,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      void notifyParent({
        userId: user.id,
        title: "FlashNote deck created",
        body: `Deck “${title}” is ready.`,
        type: "flashnote",
      });

      await pushDashboard(user.id, "deck.created", String(deck?.id ?? ""));

      return { deck };
    },
  }),

  updateDeck: defineAction({
    accept: "json",
    input: z.object({
      deckId: z.union([z.number(), z.string()]),
      data: deckPayloadSchema,
    }),
    handler: async ({ deckId, data }, context: ActionAPIContext) => {
      const user = requireUser(context);
      const id = parseNumberId(deckId, "Deck");
      await requireDeck(user.id, id);

      const title = normalizeText(data.title);
      if (!title) {
        throw new ActionError({ code: "BAD_REQUEST", message: "Title is required." });
      }

      const description = normalizeText(data.description ?? "") || null;
      const [deck] = await db
        .update(FlashcardDecks)
        .set({ title, description, updatedAt: new Date() })
        .where(and(eq(FlashcardDecks.id, id), eq(FlashcardDecks.ownerId, user.id)))
        .returning();

      return { deck };
    },
  }),

  deleteDeck: defineAction({
    accept: "json",
    input: z.object({ deckId: z.union([z.number(), z.string()]) }),
    handler: async ({ deckId }, context: ActionAPIContext) => {
      const user = requireUser(context);
      const id = parseNumberId(deckId, "Deck");
      await requireDeck(user.id, id);

      const cardRows = await db
        .select({ id: Flashcards.id })
        .from(Flashcards)
        .where(and(eq(Flashcards.deckId, id), eq(Flashcards.userId, user.id)));

      const cardIds = cardRows.map((row) => Number(row.id)).filter(Boolean);

      if (cardIds.length > 0) {
        await db
          .delete(FlashcardReviews)
          .where(and(eq(FlashcardReviews.userId, user.id), inArray(FlashcardReviews.cardId, cardIds)));
      }

      await db
        .delete(StudySessions)
        .where(and(eq(StudySessions.deckId, id), eq(StudySessions.userId, user.id)));

      await db
        .delete(Flashcards)
        .where(and(eq(Flashcards.deckId, id), eq(Flashcards.userId, user.id)));

      await db
        .delete(FlashcardDecks)
        .where(and(eq(FlashcardDecks.id, id), eq(FlashcardDecks.ownerId, user.id)));

      return { success: true };
    },
  }),

  listCardsByDeck: defineAction({
    accept: "json",
    input: z.object({ deckId: z.union([z.number(), z.string()]) }),
    handler: async ({ deckId }, context: ActionAPIContext) => {
      const user = requireUser(context);
      const id = parseNumberId(deckId, "Deck");
      const deck = await requireDeck(user.id, id);

      const cards = await db
        .select()
        .from(Flashcards)
        .where(and(eq(Flashcards.deckId, id), eq(Flashcards.userId, user.id)))
        .orderBy(desc(Flashcards.updatedAt), desc(Flashcards.createdAt));

      return { deck, items: cards };
    },
  }),

  createCard: defineAction({
    accept: "json",
    input: cardPayloadSchema,
    handler: async ({ deckId, front, back }, context: ActionAPIContext) => {
      const user = requireUser(context);
      const id = parseNumberId(deckId, "Deck");
      await requireDeck(user.id, id);

      const frontText = normalizeText(front);
      const backText = normalizeText(back);
      if (!frontText || !backText) {
        throw new ActionError({ code: "BAD_REQUEST", message: "Both front and back text are required." });
      }

      const now = new Date();
      const [card] = await db
        .insert(Flashcards)
        .values({
          deckId: id,
          userId: user.id,
          front: frontText,
          back: backText,
          sourceType: "manual",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await db
        .update(FlashcardDecks)
        .set({ updatedAt: now })
        .where(and(eq(FlashcardDecks.id, id), eq(FlashcardDecks.ownerId, user.id)));

      return { card };
    },
  }),

  updateCard: defineAction({
    accept: "json",
    input: z.object({
      cardId: z.union([z.number(), z.string()]),
      data: z.object({
        front: z.string().min(1, "Front text is required."),
        back: z.string().min(1, "Back text is required."),
      }),
    }),
    handler: async ({ cardId, data }, context: ActionAPIContext) => {
      const user = requireUser(context);
      const id = parseNumberId(cardId, "Card");
      const card = await requireCard(user.id, id);

      const frontText = normalizeText(data.front);
      const backText = normalizeText(data.back);
      if (!frontText || !backText) {
        throw new ActionError({ code: "BAD_REQUEST", message: "Both front and back text are required." });
      }

      const [updated] = await db
        .update(Flashcards)
        .set({ front: frontText, back: backText, updatedAt: new Date() })
        .where(and(eq(Flashcards.id, id), eq(Flashcards.userId, user.id)))
        .returning();

      if (card?.deckId) {
        await db
          .update(FlashcardDecks)
          .set({ updatedAt: new Date() })
          .where(and(eq(FlashcardDecks.id, Number(card.deckId)), eq(FlashcardDecks.ownerId, user.id)));
      }

      return { card: updated };
    },
  }),

  deleteCard: defineAction({
    accept: "json",
    input: z.object({ cardId: z.union([z.number(), z.string()]) }),
    handler: async ({ cardId }, context: ActionAPIContext) => {
      const user = requireUser(context);
      const id = parseNumberId(cardId, "Card");
      const card = await requireCard(user.id, id);

      await db
        .delete(FlashcardReviews)
        .where(and(eq(FlashcardReviews.userId, user.id), eq(FlashcardReviews.cardId, id)));

      await db.delete(Flashcards).where(and(eq(Flashcards.id, id), eq(Flashcards.userId, user.id)));

      if (card?.deckId) {
        await db
          .update(FlashcardDecks)
          .set({ updatedAt: new Date() })
          .where(and(eq(FlashcardDecks.id, Number(card.deckId)), eq(FlashcardDecks.ownerId, user.id)));
      }

      return { success: true };
    },
  }),

  importFromQuizQuestions: defineAction({
    accept: "json",
    input: importSchema,
    handler: async ({ deckId, quizId, topicId, limit }, context: ActionAPIContext) => {
      const user = requireUser(context);
      const id = parseNumberId(deckId, "Deck");
      const deck = await requireDeck(user.id, id);

      const locals = context.locals as App.Locals | undefined;
      const token = locals?.sessionToken ?? null;
      if (!token) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Quiz import requires a session token." });
      }

      const quizQuestions = await fetchQuizQuestions({
        token,
        quizId: quizId ? String(quizId) : undefined,
        topicId: topicId ? String(topicId) : undefined,
        limit,
      });

      if (!quizQuestions.items || quizQuestions.items.length === 0) {
        return { imported: 0, skipped: 0 };
      }

      const questionIds = quizQuestions.items.map((item) => item.questionId);
      const existingRows = await db
        .select({ sourceRefId: Flashcards.sourceRefId })
        .from(Flashcards)
        .where(
          and(
            eq(Flashcards.deckId, id),
            eq(Flashcards.userId, user.id),
            inArray(Flashcards.sourceRefId, questionIds),
          ),
        );

      const existing = new Set(existingRows.map((row) => row.sourceRefId).filter(Boolean));

      const now = new Date();
      const toInsert = quizQuestions.items
        .filter((item) => !existing.has(item.questionId))
        .map((item) => {
          const answer = normalizeText(item.answerText);
          const explanation = normalizeText(item.explanation ?? "");
          const back = explanation ? `${answer}\n\n${explanation}` : answer;

          return {
            deckId: id,
            userId: user.id,
            front: normalizeText(item.questionText),
            back,
            sourceType: "quiz" as const,
            sourceRefId: item.questionId,
            createdAt: now,
            updatedAt: now,
          };
        })
        .filter((item) => item.front && item.back);

      if (toInsert.length > 0) {
        await db.insert(Flashcards).values(toInsert);
        await db
          .update(FlashcardDecks)
          .set({ updatedAt: now })
          .where(and(eq(FlashcardDecks.id, id), eq(FlashcardDecks.ownerId, user.id)));
      }

      const imported = toInsert.length;
      const skipped = quizQuestions.items.length - imported;

      void notifyParent({
        userId: user.id,
        title: "FlashNote quiz import completed",
        body: `Imported ${imported} cards into “${deck.title}”.`,
        type: "flashnote",
      });

      await pushDashboard(user.id, "quiz.imported", String(deck.id ?? ""));

      return { imported, skipped };
    },
  }),

  startStudySession: defineAction({
    accept: "json",
    input: sessionSchema,
    handler: async ({ deckId }, context: ActionAPIContext) => {
      const user = requireUser(context);
      const id = parseNumberId(deckId, "Deck");
      await requireDeck(user.id, id);

      const now = new Date();
      const [session] = await db
        .insert(StudySessions)
        .values({
          userId: user.id,
          deckId: id,
          startedAt: now,
          completedAt: null,
          totalCardsSeen: 0,
          correctCount: 0,
          wrongCount: 0,
          summary: null,
        })
        .returning();

      return { session };
    },
  }),

  reviewCard: defineAction({
    accept: "json",
    input: reviewSchema,
    handler: async ({ cardId, rating, sessionId }, context: ActionAPIContext) => {
      const user = requireUser(context);
      const id = parseNumberId(cardId, "Card");
      const card = await requireCard(user.id, id);

      const lastReview = await db
        .select({
          intervalDays: FlashcardReviews.intervalDays,
          easeFactor: FlashcardReviews.easeFactor,
        })
        .from(FlashcardReviews)
        .where(and(eq(FlashcardReviews.userId, user.id), eq(FlashcardReviews.cardId, id)))
        .orderBy(desc(FlashcardReviews.reviewedAt), desc(FlashcardReviews.id))
        .limit(1);

      const schedule = buildReviewSchedule(rating, lastReview?.[0]);
      const now = new Date();
      const sessionIdValue = sessionId ? parseNumberId(sessionId, "Session") : undefined;

      const [review] = await db
        .insert(FlashcardReviews)
        .values({
          userId: user.id,
          deckId: Number(card.deckId),
          cardId: id,
          sessionId: sessionIdValue,
          rating: String(rating),
          dueAt: schedule.nextReviewAt,
          reviewedAt: now,
          easeFactor: schedule.easeFactor,
          intervalDays: schedule.intervalDays,
        })
        .returning();

      return { review };
    },
  }),

  completeStudySession: defineAction({
    accept: "json",
    input: completeSessionSchema,
    handler: async ({ sessionId }, context: ActionAPIContext) => {
      const user = requireUser(context);
      const id = parseNumberId(sessionId, "Session");

      const session = await db
        .select({
          id: StudySessions.id,
          deckId: StudySessions.deckId,
        })
        .from(StudySessions)
        .where(and(eq(StudySessions.id, id), eq(StudySessions.userId, user.id)))
        .get();

      if (!session) {
        throw new ActionError({ code: "NOT_FOUND", message: "Study session not found." });
      }

      const now = new Date();
      await db
        .update(StudySessions)
        .set({ completedAt: now })
        .where(and(eq(StudySessions.id, id), eq(StudySessions.userId, user.id)));

      const [{ total: reviewedRaw } = { total: 0 }] = await db
        .select({ total: count() })
        .from(FlashcardReviews)
        .where(and(eq(FlashcardReviews.userId, user.id), eq(FlashcardReviews.sessionId, id)));

      const reviewed = Number(reviewedRaw ?? 0);
      const deck = await requireDeck(user.id, Number(session.deckId));

      void notifyParent({
        userId: user.id,
        title: "FlashNote study session completed",
        body: `Reviewed ${reviewed} cards in “${deck.title}”.`,
        type: "flashnote",
      });

      await pushDashboard(user.id, "study.completed", String(deck.id ?? ""));

      return { success: true, reviewed };
    },
  }),
};
