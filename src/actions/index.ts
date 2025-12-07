import type { ActionAPIContext } from "astro:actions";
import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import {
  db,
  eq,
  and,
  FlashcardDecks,
  Flashcards,
  StudySessions,
  FlashcardReviews,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

export const server = {
  createDeck: defineAction({
    input: z.object({
      title: z.string().min(1, "Title is required"),
      description: z.string().optional(),
      sourceType: z
        .enum(["manual", "note", "pdf", "web", "other"])
        .optional(),
      sourceMeta: z.any().optional(),
      tags: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [deck] = await db
        .insert(FlashcardDecks)
        .values({
          ownerId: user.id,
          title: input.title,
          description: input.description,
          sourceType: input.sourceType ?? "manual",
          sourceMeta: input.sourceMeta,
          tags: input.tags,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return { deck };
    },
  }),

  updateDeck: defineAction({
    input: z.object({
      id: z.number().int(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      sourceType: z
        .enum(["manual", "note", "pdf", "web", "other"])
        .optional(),
      sourceMeta: z.any().optional(),
      tags: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const { id, ...rest } = input;

      const [existing] = await db
        .select()
        .from(FlashcardDecks)
        .where(and(eq(FlashcardDecks.id, id), eq(FlashcardDecks.ownerId, user.id)))
        .limit(1);

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Deck not found.",
        });
      }

      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (typeof value !== "undefined") {
          updateData[key] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return { deck: existing };
      }

      const [deck] = await db
        .update(FlashcardDecks)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(eq(FlashcardDecks.id, id), eq(FlashcardDecks.ownerId, user.id)))
        .returning();

      return { deck };
    },
  }),

  archiveDeck: defineAction({
    input: z.object({
      id: z.number().int(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [deck] = await db
        .update(FlashcardDecks)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(FlashcardDecks.id, input.id), eq(FlashcardDecks.ownerId, user.id)))
        .returning();

      if (!deck) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Deck not found.",
        });
      }

      return { deck };
    },
  }),

  listDecks: defineAction({
    input: z
      .object({
        includeInactive: z.boolean().optional(),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);
      const includeInactive = input?.includeInactive ?? false;

      const decks = await db
        .select()
        .from(FlashcardDecks)
        .where(eq(FlashcardDecks.ownerId, user.id));

      const filtered = includeInactive
        ? decks
        : decks.filter((deck) => deck.isActive);

      return { decks: filtered };
    },
  }),

  getDeckWithCards: defineAction({
    input: z.object({
      id: z.number().int(),
      includeInactiveCards: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [deck] = await db
        .select()
        .from(FlashcardDecks)
        .where(and(eq(FlashcardDecks.id, input.id), eq(FlashcardDecks.ownerId, user.id)))
        .limit(1);

      if (!deck || !deck.isActive) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Deck not found.",
        });
      }

      const cards = await db
        .select()
        .from(Flashcards)
        .where(eq(Flashcards.deckId, input.id));

      const filteredCards = input.includeInactiveCards
        ? cards
        : cards.filter((card) => card.isActive);

      return { deck, cards: filteredCards };
    },
  }),

  saveFlashcard: defineAction({
    input: z.object({
      id: z.number().int().optional(),
      deckId: z.number().int(),
      displayOrder: z.number().int().nonnegative().optional(),
      front: z.string().min(1, "Front text is required"),
      back: z.string().min(1, "Back text is required"),
      hint: z.string().optional(),
      extra: z.any().optional(),
      isActive: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [deck] = await db
        .select()
        .from(FlashcardDecks)
        .where(and(eq(FlashcardDecks.id, input.deckId), eq(FlashcardDecks.ownerId, user.id)))
        .limit(1);

      if (!deck) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Deck not found.",
        });
      }

      const baseValues = {
        deckId: input.deckId,
        displayOrder: input.displayOrder ?? 0,
        front: input.front,
        back: input.back,
        hint: input.hint,
        extra: input.extra,
        isActive: input.isActive ?? true,
      };

      if (input.id) {
        const [existing] = await db
          .select()
          .from(Flashcards)
          .where(eq(Flashcards.id, input.id))
          .limit(1);

        if (!existing || existing.deckId !== input.deckId) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Flashcard not found.",
          });
        }

        const [card] = await db
          .update(Flashcards)
          .set(baseValues)
          .where(eq(Flashcards.id, input.id))
          .returning();

        return { card };
      }

      const [card] = await db.insert(Flashcards).values(baseValues).returning();
      return { card };
    },
  }),

  archiveFlashcard: defineAction({
    input: z.object({
      id: z.number().int(),
      deckId: z.number().int(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [deck] = await db
        .select()
        .from(FlashcardDecks)
        .where(and(eq(FlashcardDecks.id, input.deckId), eq(FlashcardDecks.ownerId, user.id)))
        .limit(1);

      if (!deck) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Deck not found.",
        });
      }

      const [card] = await db
        .update(Flashcards)
        .set({ isActive: false })
        .where(and(eq(Flashcards.id, input.id), eq(Flashcards.deckId, input.deckId)))
        .returning();

      if (!card) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Flashcard not found.",
        });
      }

      return { card };
    },
  }),

  startStudySession: defineAction({
    input: z.object({
      deckId: z.number().int(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [deck] = await db
        .select()
        .from(FlashcardDecks)
        .where(and(eq(FlashcardDecks.id, input.deckId), eq(FlashcardDecks.ownerId, user.id)))
        .limit(1);

      if (!deck || !deck.isActive) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Deck not available.",
        });
      }

      const [session] = await db
        .insert(StudySessions)
        .values({
          deckId: input.deckId,
          userId: user.id,
          startedAt: new Date(),
        })
        .returning();

      return { session };
    },
  }),

  completeStudySession: defineAction({
    input: z.object({
      id: z.number().int(),
      totalCardsSeen: z.number().int().nonnegative().optional(),
      correctCount: z.number().int().nonnegative().optional(),
      wrongCount: z.number().int().nonnegative().optional(),
      summary: z.any().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [session] = await db
        .select()
        .from(StudySessions)
        .where(and(eq(StudySessions.id, input.id), eq(StudySessions.userId, user.id)))
        .limit(1);

      if (!session) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Study session not found.",
        });
      }

      const [updated] = await db
        .update(StudySessions)
        .set({
          completedAt: new Date(),
          totalCardsSeen: input.totalCardsSeen ?? session.totalCardsSeen,
          correctCount: input.correctCount ?? session.correctCount,
          wrongCount: input.wrongCount ?? session.wrongCount,
          summary: input.summary ?? session.summary,
        })
        .where(eq(StudySessions.id, input.id))
        .returning();

      return { session: updated };
    },
  }),

  recordReview: defineAction({
    input: z.object({
      deckId: z.number().int(),
      cardId: z.number().int(),
      sessionId: z.number().int().optional(),
      rating: z.enum(["again", "hard", "good", "easy"]),
      reviewedAt: z.coerce.date().optional(),
      dueAt: z.coerce.date().optional(),
      intervalDays: z.number().int().nonnegative().optional(),
      easeFactor: z.number().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [deck] = await db
        .select()
        .from(FlashcardDecks)
        .where(and(eq(FlashcardDecks.id, input.deckId), eq(FlashcardDecks.ownerId, user.id)))
        .limit(1);

      if (!deck) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Deck not found.",
        });
      }

      const [card] = await db
        .select()
        .from(Flashcards)
        .where(and(eq(Flashcards.id, input.cardId), eq(Flashcards.deckId, input.deckId)))
        .limit(1);

      if (!card) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Flashcard not found.",
        });
      }

      if (input.sessionId) {
        const [session] = await db
          .select()
          .from(StudySessions)
          .where(
            and(
              eq(StudySessions.id, input.sessionId),
              eq(StudySessions.deckId, input.deckId),
              eq(StudySessions.userId, user.id)
            )
          )
          .limit(1);

        if (!session) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Study session not found.",
          });
        }
      }

      const [review] = await db
        .insert(FlashcardReviews)
        .values({
          deckId: input.deckId,
          cardId: input.cardId,
          sessionId: input.sessionId,
          userId: user.id,
          rating: input.rating,
          reviewedAt: input.reviewedAt ?? new Date(),
          dueAt: input.dueAt,
          intervalDays: input.intervalDays ?? 0,
          easeFactor: input.easeFactor,
        })
        .returning();

      return { review };
    },
  }),

  listReviews: defineAction({
    input: z
      .object({
        deckId: z.number().int().optional(),
        cardId: z.number().int().optional(),
        sessionId: z.number().int().optional(),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);

      const deckFilterId = input?.deckId;
      const cardFilterId = input?.cardId;
      const sessionFilterId = input?.sessionId;

      const deckIds = deckFilterId
        ? [deckFilterId]
        : (
            await db
              .select()
              .from(FlashcardDecks)
              .where(eq(FlashcardDecks.ownerId, user.id))
          ).map((d) => d.id);

      if (deckIds.length === 0) {
        return { reviews: [] };
      }

      const reviews = await db
        .select()
        .from(FlashcardReviews)
        .where(eq(FlashcardReviews.userId, user.id));

      const filtered = reviews.filter((review) => {
        const matchesDeck = deckIds.includes(review.deckId);
        const matchesCard = cardFilterId ? review.cardId === cardFilterId : true;
        const matchesSession = sessionFilterId ? review.sessionId === sessionFilterId : true;
        return matchesDeck && matchesCard && matchesSession;
      });

      return { reviews: filtered };
    },
  }),
};
