import type { Alpine } from "alpinejs";
import { AvBaseStore } from "@ansiversa/components/alpine";
import { actions } from "astro:actions";
import type { Flashcard, FlashcardDeck } from "./types";

type AiSuggestionType = "roadmap" | "topic" | "subject" | "platform" | "query";
type AiSuggestion = {
  type: AiSuggestionType;
  id: string;
  label: string;
  contextLabel?: string | null;
  ts?: number;
};

type AiSuggestionGroups = {
  roadmaps: AiSuggestion[];
  topics: AiSuggestion[];
  subjects: AiSuggestion[];
  platforms: AiSuggestion[];
};

const emptySuggestions = (): AiSuggestionGroups => ({
  roadmaps: [],
  topics: [],
  subjects: [],
  platforms: [],
});

const AI_RECENT_KEY = "flashnote.aiRecent";

const defaultState = () => ({
  currentDeckId: null as number | null,
  currentDeck: null as FlashcardDeck | null,
  decks: [] as FlashcardDeck[],
  bookmarks: new Set<string>(),
  cards: [] as Flashcard[],
  loading: false,
  error: null as string | null,
  success: null as string | null,
  isPaid: false,
  aiError: null as string | null,
  aiSuccess: null as string | null,
  aiSearching: false,
  aiSelection: null as AiSuggestion | null,
  aiSuggestions: emptySuggestions(),
  aiRecent: [] as AiSuggestion[],
  newDeck: {
    title: "",
    description: "",
  },
  newCard: {
    front: "",
    back: "",
  },
  aiGenerate: {
    query: "",
    difficulty: "",
    limit: 50,
  },
  aiPaywallVisible: false,
  aiLastSeedByDeck: {} as Record<string, string>,
  aiSearchToken: 0,
  aiSearchTimer: null as number | null,
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
  bookmarks: Set<string> = new Set();
  cards: Flashcard[] = [];
  loading = false;
  error: string | null = null;
  success: string | null = null;
  isPaid = false;
  aiError: string | null = null;
  aiSuccess: string | null = null;
  aiSearching = false;
  aiSelection: AiSuggestion | null = null;
  aiSuggestions: AiSuggestionGroups = emptySuggestions();
  aiRecent: AiSuggestion[] = [];
  newDeck = { title: "", description: "" };
  newCard = { front: "", back: "" };
  aiGenerate = { query: "", difficulty: "", limit: 50 };
  aiPaywallVisible = false;
  aiLastSeedByDeck: Record<string, string> = {};
  aiSearchToken = 0;
  aiSearchTimer: number | null = null;
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
    this.bookmarks = initial.bookmarks instanceof Set
      ? new Set(Array.from(initial.bookmarks).map((id) => String(id)))
      : new Set();
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

  setBillingStatus(isPaid: boolean) {
    this.isPaid = Boolean(isPaid);
  }

  isBookmarked(deckId: string | number) {
    return this.bookmarks.has(String(deckId));
  }

  private setBookmarkState(deckId: string | number, saved: boolean) {
    const key = String(deckId);
    const next = new Set(this.bookmarks);
    if (saved) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.bookmarks = next;
  }

  async initBookmarks() {
    try {
      const res = await actions.flashnote.listDeckBookmarks({});
      const data = this.unwrap(res) as { items?: Array<{ deckId: string | number }> };
      this.bookmarks = new Set((data.items ?? []).map((item) => String(item.deckId)));
    } catch {
      this.bookmarks = new Set();
    }
  }

  async toggleBookmarkDeck(deck: { id: string | number; title?: string | null }) {
    const deckId = String(deck.id ?? "").trim();
    if (!deckId) return;
    const wasSaved = this.isBookmarked(deckId);
    this.setBookmarkState(deckId, !wasSaved);

    try {
      const res = await actions.flashnote.toggleBookmark({
        entityType: "deck",
        entityId: deckId,
        label: normalizeText(deck.title ?? "") || "Untitled deck",
      });
      const data = this.unwrap(res) as { saved?: boolean };
      this.setBookmarkState(deckId, Boolean(data?.saved));
    } catch (err: any) {
      this.setBookmarkState(deckId, wasSaved);
      this.error = err?.message || "Unable to update bookmark.";
    }
  }

  initAiSearch() {
    this.loadAiRecent();
    if (this.aiGenerate.query) {
      this.queueAiSearch(this.aiGenerate.query);
    }
  }

  private loadAiRecent() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(AI_RECENT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as AiSuggestion[];
      if (Array.isArray(parsed)) {
        this.aiRecent = parsed.filter((item) => item && item.label).slice(0, 10);
      }
    } catch {
      this.aiRecent = [];
    }
  }

  private saveAiRecent() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(AI_RECENT_KEY, JSON.stringify(this.aiRecent.slice(0, 10)));
    } catch {
      // ignore storage issues
    }
  }

  private addAiRecent(entry: AiSuggestion) {
    const existingIndex = this.aiRecent.findIndex(
      (item) => item.type === entry.type && item.id === entry.id && item.label === entry.label,
    );
    if (existingIndex >= 0) {
      this.aiRecent.splice(existingIndex, 1);
    }
    this.aiRecent = [entry, ...this.aiRecent].slice(0, 10);
    this.saveAiRecent();
  }

  setAiSelection(entry: AiSuggestion) {
    if (entry.type === "query") {
      this.aiSelection = null;
      this.aiGenerate.query = entry.label;
    } else {
      this.aiSelection = entry;
      this.aiGenerate.query = entry.label;
    }
  }

  clearAiSelection() {
    this.aiSelection = null;
  }

  queueAiSearch(value?: string) {
    if (typeof window === "undefined") return;
    const query = normalizeText(value ?? this.aiGenerate.query);
    if (this.aiSearchTimer) {
      window.clearTimeout(this.aiSearchTimer);
    }
    this.aiSearchTimer = window.setTimeout(() => {
      void this.runAiSearch(query);
    }, 250);
  }

  async runAiSearch(query: string) {
    const normalized = normalizeText(query);
    if (normalized.length < 2) {
      this.aiSuggestions = emptySuggestions();
      this.aiSearching = false;
      return;
    }

    const token = (this.aiSearchToken += 1);
    this.aiSearching = true;

    try {
      const res = await actions.flashnote.searchAiSources({ q: normalized });
      if (token !== this.aiSearchToken) return;
      const data = this.unwrap(res) as AiSuggestionGroups;
      this.aiSuggestions = {
        roadmaps: data.roadmaps ?? [],
        topics: data.topics ?? [],
        subjects: data.subjects ?? [],
        platforms: data.platforms ?? [],
      };
    } catch {
      if (token !== this.aiSearchToken) return;
      this.aiSuggestions = emptySuggestions();
    } finally {
      if (token === this.aiSearchToken) {
        this.aiSearching = false;
      }
    }
  }

  get aiSelectionLabel() {
    if (!this.aiSelection) return "";
    const label =
      this.aiSelection.type.charAt(0).toUpperCase() + this.aiSelection.type.slice(1);
    return `${label}: ${this.aiSelection.label}`;
  }

  private getAiSeed() {
    const deckId = this.currentDeckId;
    const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    if (!deckId) return seed;
    const key = String(deckId);
    if (this.aiLastSeedByDeck[key] === seed) {
      return `${seed}-${Math.random().toString(36).slice(2, 6)}`;
    }
    return seed;
  }

  openAiModal() {
    const dialog = document.getElementById("flashnote-ai-modal") as HTMLDialogElement | null;
    if (dialog && typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
    }
  }

  closeAiModal() {
    const dialog = document.getElementById("flashnote-ai-modal") as HTMLDialogElement | null;
    if (dialog && dialog.open) {
      dialog.close();
    }
  }

  async attemptAiGenerate() {
    const query = normalizeText(this.aiGenerate.query);
    if (!query && !this.aiSelection) {
      this.openAiModal();
      return;
    }
    await this.generateAiCards({ query, selection: this.aiSelection ?? undefined });
  }

  async generateAiFromModal() {
    await this.generateAiCards({
      query: normalizeText(this.aiGenerate.query) || undefined,
      difficulty: normalizeText(this.aiGenerate.difficulty) || undefined,
      limit: this.aiGenerate.limit,
      selection: this.aiSelection ?? undefined,
    });
  }

  async generateAiCards(options?: {
    query?: string;
    difficulty?: string;
    limit?: number;
    selection?: AiSuggestion;
  }) {
    if (!this.currentDeckId || !this.currentDeck) {
      this.error = "Deck not found. Create a new deck first.";
      this.aiError = "Deck not found. Create a new deck first.";
      return;
    }

    if (!this.isPaid) {
      this.aiPaywallVisible = true;
      this.closeAiModal();
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;
    this.aiPaywallVisible = false;
    this.aiError = null;
    this.aiSuccess = null;

    try {
      const seed = this.getAiSeed();
      const limitValue = Number(options?.limit ?? this.aiGenerate.limit);
      const limit = Number.isFinite(limitValue) ? limitValue : 50;

      const res = await actions.flashnote.generateCardsWithAI({
        deckId: this.currentDeckId,
        query: options?.query || undefined,
        selection:
          options?.selection && options.selection.type !== "query"
            ? {
                type: options.selection.type as "platform" | "subject" | "topic" | "roadmap",
                id: options.selection.id,
                label: options.selection.label,
                contextLabel: options.selection.contextLabel ?? undefined,
              }
            : undefined,
        difficulty: options?.difficulty || undefined,
        limit,
        seed,
      });

      if ((res as any)?.error?.code === "PAYMENT_REQUIRED") {
        this.aiPaywallVisible = true;
        this.closeAiModal();
        return;
      }

      const data = this.unwrap(res) as { created: number };
      await this.openDeck(this.currentDeckId);
      await this.loadDecks();
      if (this.currentDeckId) {
        this.aiLastSeedByDeck[String(this.currentDeckId)] = seed;
      }
      this.aiSuccess = data.created > 0 ? `AI generated ${data.created} cards.` : "No cards generated.";
      if (options?.selection) {
        this.addAiRecent({
          ...options.selection,
          ts: Date.now(),
        });
      } else if (options?.query) {
        this.addAiRecent({
          type: "query",
          id: "",
          label: options.query,
          ts: Date.now(),
        });
      }
      this.closeAiModal();
    } catch (err: any) {
      const message = err?.message || "AI generation failed.";
      this.aiError =
        message === "Deck not found." ? "Deck not found. Create a new deck first." : message;
    } finally {
      this.loading = false;
    }
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
