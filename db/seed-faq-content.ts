import { Faq, db, eq } from "astro:db";

type FaqItem = { category: string; question: string; answer: string };

const FAQS: FaqItem[] = [
  {
    category: "Getting Started",
    question: "What is FlashNote?",
    answer:
      "FlashNote is a focused flashcard learning app for quick review and retention. It helps you create cards, practice regularly, and track your study rhythm.",
  },
  {
    category: "Cards",
    question: "How do I create a flashcard?",
    answer:
      "Create or open a deck, then add a card with front and back content. You can keep cards concise for faster recall during review sessions.",
  },
  {
    category: "Learning",
    question: "How does spaced repetition work?",
    answer:
      "FlashNote schedules card reviews over time so important items reappear when you need reinforcement. This reduces cramming and supports long-term memory.",
  },
  {
    category: "Saving",
    question: "Are my notes saved automatically?",
    answer:
      "Your changes are persisted through the app workflows, so created decks and cards remain available in your account data.",
  },
  {
    category: "Organization",
    question: "Can I organize notes into topics?",
    answer:
      "Yes. You can organize study material by creating separate decks and structuring cards by topic or subject focus.",
  },
];

export default async function seedFaqContent() {
  await db.delete(Faq).where(eq(Faq.audience, "user"));

  await db.insert(Faq).values(
    FAQS.map((item, index) => ({
      audience: "user",
      category: item.category,
      question: item.question,
      answer_md: item.answer,
      sort_order: index + 1,
      is_published: true,
      created_at: new Date(),
      updated_at: new Date(),
    }))
  );

  console.log(`Seeded ${FAQS.length} production FAQs for flashnote user audience.`);
}
