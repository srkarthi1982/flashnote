import type { Alpine } from "alpinejs";
import { AvBaseStore } from "@ansiversa/components/alpine";
import { actions } from "astro:actions";
import type { Flashcard, FlashcardDeck } from "./types";

const defaultState = () => ({
  currentDeckId: null as number | null,
  currentDeck: null as FlashcardDeck | null,
  decks: [] as FlashcardDeck[],
  cards: [] as Flashcard[],
  loading: false,
  error: null as string | null,
  success: null as string | null,
  newDeck: {
    title: "",
    description: "",
  },
  newCard: {
    front: "",
    back: "",
  },
  quizImport: {
    quizId: "",
    topicId: "",
    limit: 50,
  },
  study: {
    sessionId: null as number | null,
    index: 0,
    showBack: false,
    reviewed: 0,
    completed: false,
  },
});

const normalizeText = (value?: string | null) => (value ?? "").toString().trim();

export class FlashnoteStore extends AvBaseStore implements ReturnType<typeof defaultState> {
  currentDeckId: number | null = null;
  currentDeck: FlashcardDeck | null = null;
  decks: FlashcardDeck[] = [];
  cards: Flashcard[] = [];
  loading = false;
  error: string | null = null;
  success: string | null = null;
  newDeck = { title: "", description: "" };
  newCard = { front: "", back: "" };
  quizImport = { quizId: "", topicId: "", limit: 50 };
  study: {
    sessionId: number | null;
    index: number;
    showBack: boolean;
    reviewed: number;
    completed: boolean;
  } = { sessionId: null, index: 0, showBack: false, reviewed: 0, completed: false };

  init(initial?: Partial<ReturnType<typeof defaultState>>) {
    if (!initial) return;
    Object.assign(this, defaultState(), initial);
    this.decks = (initial.decks ?? []) as FlashcardDeck[];
    this.cards = (initial.cards ?? []) as Flashcard[];
    this.currentDeckId = initial.currentDeckId ?? this.currentDeckId;
    this.currentDeck = (initial.currentDeck ?? this.currentDeck) as FlashcardDeck | null;
  }

  private unwrap<T = any>(result: any): T {
    if (result?.error) {
      const message = result.error?.message || result.error;
      throw new Error(message || "Request failed.");
    }
    return (result?.data ?? result) as T;
  }

  get activeCard() {
    return this.cards[this.study.index] ?? null;
  }

  async loadDecks() {
    this.loading = true;
    this.error = null;

    try {
      const res = await actions.flashnote.listDecks({});
      const data = this.unwrap(res) as { items: FlashcardDeck[] };
      this.decks = data.items ?? [];
    } catch (err: any) {
      this.error = err?.message || "Unable to load decks.";
    } finally {
      this.loading = false;
    }
  }

  async openDeck(deckId: number | string) {
    const id = Number(deckId);
    if (!Number.isFinite(id)) return;
    this.currentDeckId = id;
    this.loading = true;
    this.error = null;

    try {
      const res = await actions.flashnote.listCardsByDeck({ deckId: id });
      const data = this.unwrap(res) as { deck: FlashcardDeck; items: Flashcard[] };
      this.currentDeck = data.deck ?? null;
      this.cards = data.items ?? [];
    } catch (err: any) {
      this.error = err?.message || "Unable to load deck.";
    } finally {
      this.loading = false;
    }
  }

  async createDeck() {
    const title = normalizeText(this.newDeck.title);
    const description = normalizeText(this.newDeck.description);
    if (!title) {
      this.error = "Deck title is required.";
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    try {
      const res = await actions.flashnote.createDeck({
        title,
        description: description || undefined,
      });
      const data = this.unwrap(res) as { deck: FlashcardDeck };
      if (data?.deck) {
        this.decks = [data.deck, ...this.decks];
        this.newDeck = { title: "", description: "" };
        this.currentDeck = data.deck;
        this.currentDeckId = data.deck.id;
      }
      this.success = "Deck created.";
    } catch (err: any) {
      this.error = err?.message || "Unable to create deck.";
    } finally {
      this.loading = false;
    }
  }

  async createCard() {
    if (!this.currentDeckId) {
      this.error = "Select a deck first.";
      return;
    }

    const front = normalizeText(this.newCard.front);
    const back = normalizeText(this.newCard.back);
    if (!front || !back) {
      this.error = "Both front and back text are required.";
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    try {
      const res = await actions.flashnote.createCard({
        deckId: this.currentDeckId,
        front,
        back,
      });
      const data = this.unwrap(res) as { card: Flashcard };
      if (data?.card) {
        this.cards = [data.card, ...this.cards];
        this.newCard = { front: "", back: "" };
      }
      await this.loadDecks();
      this.success = "Card added.";
    } catch (err: any) {
      this.error = err?.message || "Unable to add card.";
    } finally {
      this.loading = false;
    }
  }

  async importFromQuiz() {
    if (!this.currentDeckId) {
      this.error = "Select a deck first.";
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    try {
      const limitValue = Number(this.quizImport.limit);
      const limit = Number.isFinite(limitValue) ? limitValue : undefined;

      const res = await actions.flashnote.importFromQuizQuestions({
        deckId: this.currentDeckId,
        quizId: this.quizImport.quizId || undefined,
        topicId: this.quizImport.topicId || undefined,
        limit,
      });
      const data = this.unwrap(res) as { imported: number; skipped: number };
      await this.openDeck(this.currentDeckId);
      await this.loadDecks();
      this.success = `Imported ${data.imported} cards.`;
    } catch (err: any) {
      this.error = err?.message || "Quiz import failed.";
    } finally {
      this.loading = false;
    }
  }

  async startSession() {
    if (!this.currentDeckId) return;
    this.loading = true;
    this.error = null;

    try {
      const res = await actions.flashnote.startStudySession({ deckId: this.currentDeckId });
      const data = this.unwrap(res) as { session: { id: number } };
      this.study = {
        sessionId: data.session?.id ?? null,
        index: 0,
        showBack: false,
        reviewed: 0,
        completed: false,
      };
    } catch (err: any) {
      this.error = err?.message || "Unable to start study session.";
    } finally {
      this.loading = false;
    }
  }

  async prepareStudy(deckId: number | string) {
    await this.openDeck(deckId);
    await this.startSession();
  }

  revealBack() {
    this.study.showBack = true;
  }

  async reviewCard(rating: number) {
    const card = this.activeCard;
    if (!card) return;

    this.loading = true;
    this.error = null;

    try {
      await actions.flashnote.reviewCard({
        cardId: card.id,
        rating,
        sessionId: this.study.sessionId ?? undefined,
      });
      this.study.reviewed += 1;
      this.study.index += 1;
      this.study.showBack = false;
      if (this.study.index >= this.cards.length) {
        this.study.completed = true;
        if (this.study.sessionId) {
          await actions.flashnote.completeStudySession({ sessionId: this.study.sessionId });
          await this.loadDecks();
        }
      }
    } catch (err: any) {
      this.error = err?.message || "Unable to save review.";
    } finally {
      this.loading = false;
    }
  }
}

export const registerFlashnoteStore = (Alpine: Alpine) => {
  Alpine.store("flashnote", new FlashnoteStore());
};
