import { ActionError, defineAction, type ActionAPIContext } from "astro:actions";
import { Bookmark, FlashcardDecks, and, db, desc, eq, inArray } from "astro:db";
import { z } from "astro:schema";
import { requireUser } from "./_guards";

const bookmarkEntityTypeSchema = z.enum(["deck"]);

const normalizeEntityId = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ActionError({ code: "BAD_REQUEST", message: "Entity id is required." });
  }
  return trimmed;
};

const normalizeLabel = (value?: string) => {
  const trimmed = value?.trim() ?? "";
  return trimmed || "Untitled deck";
};

export const listDeckBookmarks = defineAction({
  input: z.object({}).optional(),
  async handler(_input, context: ActionAPIContext) {
    const user = requireUser(context);

    const bookmarks = await db
      .select({
        id: Bookmark.id,
        entityId: Bookmark.entityId,
        label: Bookmark.label,
        createdAt: Bookmark.createdAt,
      })
      .from(Bookmark)
      .where(and(eq(Bookmark.userId, user.id), eq(Bookmark.entityType, "deck")))
      .orderBy(desc(Bookmark.createdAt), desc(Bookmark.id));

    const deckIds = bookmarks
      .map((row) => Number.parseInt(String(row.entityId), 10))
      .filter((value) => Number.isFinite(value) && value > 0);

    const decks = deckIds.length
      ? await db
          .select({
            id: FlashcardDecks.id,
            title: FlashcardDecks.title,
          })
          .from(FlashcardDecks)
          .where(and(eq(FlashcardDecks.ownerId, user.id), inArray(FlashcardDecks.id, deckIds)))
      : [];

    const deckTitleMap = new Map<string, string>(
      decks.map((deck) => [String(deck.id), deck.title || "Untitled deck"]),
    );

    return {
      items: bookmarks.map((row) => ({
        deckId: String(row.entityId),
        title: deckTitleMap.get(String(row.entityId)) ?? row.label ?? "Untitled deck",
        bookmarkedAt: row.createdAt,
      })),
    };
  },
});

export const toggleBookmark = defineAction({
  input: z.object({
    entityType: bookmarkEntityTypeSchema,
    entityId: z.string().min(1, "Entity id is required"),
    label: z.string().optional(),
  }),
  async handler(input, context: ActionAPIContext) {
    const user = requireUser(context);
    const entityId = normalizeEntityId(input.entityId);
    const label = normalizeLabel(input.label);

    const existing = await db
      .select({ id: Bookmark.id })
      .from(Bookmark)
      .where(
        and(
          eq(Bookmark.userId, user.id),
          eq(Bookmark.entityType, input.entityType),
          eq(Bookmark.entityId, entityId),
        ),
      )
      .get();

    if (existing?.id) {
      await db.delete(Bookmark).where(eq(Bookmark.id, existing.id));
      return { saved: false };
    }

    try {
      await db.insert(Bookmark).values({
        userId: user.id,
        entityType: input.entityType,
        entityId,
        label,
      });
      return { saved: true };
    } catch {
      const stillExists = await db
        .select({ id: Bookmark.id })
        .from(Bookmark)
        .where(
          and(
            eq(Bookmark.userId, user.id),
            eq(Bookmark.entityType, input.entityType),
            eq(Bookmark.entityId, entityId),
          ),
        )
        .get();

      if (stillExists?.id) {
        return { saved: true };
      }

      throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to toggle bookmark." });
    }
  },
});
