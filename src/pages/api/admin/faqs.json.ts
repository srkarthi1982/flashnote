import type { APIRoute } from "astro";
import { Faq, asc, db, desc, eq, sql } from "astro:db";
import { json, requireAdminApiAccess } from "../../../lib/apiAuth";

type FaqAudience = "user" | "admin";

const normalizeAudience = (value: unknown): FaqAudience => (value === "admin" ? "admin" : "user");

const parseBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return null;
};

const parseSortOrder = (value: unknown) => {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
};

const parseCreatePayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return { error: "Invalid payload." };
  }

  const source = payload as Record<string, unknown>;
  const question = typeof source.question === "string" ? source.question.trim() : "";
  const answer_md = typeof source.answer_md === "string" ? source.answer_md.trim() : "";
  const audience = normalizeAudience(source.audience);
  const categoryRaw = typeof source.category === "string" ? source.category.trim() : "";
  const sort_order = parseSortOrder(source.sort_order);
  const is_published = parseBoolean(source.is_published);

  if (!question) return { error: "Question is required." };
  if (!answer_md) return { error: "Answer is required." };
  if (sort_order === null) return { error: "sort_order must be an integer." };
  if (is_published === null) return { error: "is_published must be a boolean." };

  return {
    data: {
      audience,
      category: categoryRaw || null,
      question,
      answer_md,
      sort_order,
      is_published,
    },
  };
};

const toIsoString = (value: unknown) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const GET: APIRoute = async ({ request, cookies }) => {
  const authError = requireAdminApiAccess(cookies, request);
  if (authError) return authError;

  const url = new URL(request.url);
  const audience = normalizeAudience(url.searchParams.get("audience"));
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const queryLike = `%${q}%`;
  const whereClause = q
    ? sql`${Faq.audience} = ${audience}
      AND (
        lower(${Faq.question}) LIKE ${queryLike}
        OR lower(coalesce(${Faq.category}, '')) LIKE ${queryLike}
        OR lower(${Faq.audience}) LIKE ${queryLike}
      )`
    : eq(Faq.audience, audience);

  const items = await db
    .select({
      id: Faq.id,
      audience: Faq.audience,
      category: Faq.category,
      question: Faq.question,
      answer_md: Faq.answer_md,
      sort_order: Faq.sort_order,
      is_published: Faq.is_published,
      updated_at: Faq.updated_at,
    })
    .from(Faq)
    .where(whereClause)
    .orderBy(asc(Faq.sort_order), desc(Faq.updated_at));

  return json(200, {
    items: items.map((item) => ({
      id: item.id,
      audience: normalizeAudience(item.audience),
      category: item.category ?? "",
      question: item.question,
      answer_md: item.answer_md,
      sort_order: item.sort_order ?? 0,
      is_published: item.is_published === true,
      updated_at: toIsoString(item.updated_at),
    })),
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const authError = requireAdminApiAccess(cookies, request);
  if (authError) return authError;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const parsed = parseCreatePayload(payload);
  if ("error" in parsed) {
    return json(400, { error: parsed.error });
  }

  const now = new Date();

  const [inserted] = await db
    .insert(Faq)
    .values({
      ...parsed.data,
      created_at: now,
      updated_at: now,
    })
    .returning();

  return json(201, {
    item: {
      id: inserted.id,
      audience: inserted.audience,
      category: inserted.category ?? "",
      question: inserted.question,
      answer_md: inserted.answer_md,
      sort_order: inserted.sort_order ?? 0,
      is_published: inserted.is_published === true,
      updated_at: toIsoString(inserted.updated_at),
    },
  });
};

export const PATCH: APIRoute = async () => json(405, { error: "Method Not Allowed" });
export const DELETE: APIRoute = async () => json(405, { error: "Method Not Allowed" });
