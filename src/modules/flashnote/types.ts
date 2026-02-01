export type FlashcardDeck = {
  id: number;
  ownerId: string;
  title: string;
  description?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  cardsCount?: number;
};

export type Flashcard = {
  id: number;
  deckId: number;
  userId: string;
  front: string;
  back: string;
  sourceType: "manual" | "quiz" | "ai";
  sourceRefId?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};
