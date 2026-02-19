import type { APIRoute } from "astro";
import { Faq, and, asc, db, desc, eq } from "astro:db";
import { json } from "../../lib/apiAuth";

const APP_KEY = "flashnote";

const normalizeAudience = (value: string | null) => (value === "admin" ? "admin" : "user");

const toIsoString = (value: unknown) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const audience = normalizeAudience(url.searchParams.get("audience"));

  const rows = await db
    .select({
      id: Faq.id,
      category: Faq.category,
      question: Faq.question,
      answer_md: Faq.answer_md,
      sort_order: Faq.sort_order,
      updated_at: Faq.updated_at,
    })
    .from(Faq)
    .where(and(eq(Faq.audience, audience), eq(Faq.is_published, true)))
    .orderBy(asc(Faq.sort_order), desc(Faq.updated_at));

  const items = rows.map((row) => ({
    id: String(row.id),
    category: row.category ?? "",
    q: row.question,
    a_md: row.answer_md,
    sort_order: row.sort_order ?? 0,
  }));

  const latestUpdatedAt = rows
    .map((row) => toIsoString(row.updated_at))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return json(200, {
    appKey: APP_KEY,
    updatedAt: latestUpdatedAt ?? new Date().toISOString(),
    items,
  });
};

export const POST: APIRoute = async () => json(405, { error: "Method Not Allowed" });
