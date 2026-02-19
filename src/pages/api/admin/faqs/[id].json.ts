import type { APIRoute } from "astro";
import { Faq, db, eq } from "astro:db";
import { json, requireAdminApiAccess } from "../../../../lib/apiAuth";

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

const toIsoString = (value: unknown) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const parseId = (idParam: string | undefined) => {
  const parsed = Number.parseInt(idParam ?? "", 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  const authError = requireAdminApiAccess(cookies, request);
  if (authError) return authError;

  const faqId = parseId(params.id);
  if (!faqId) return json(400, { error: "Invalid FAQ id." });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  if (!payload || typeof payload !== "object") {
    return json(400, { error: "Invalid payload." });
  }

  const source = payload as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if ("audience" in source) {
    updates.audience = normalizeAudience(source.audience);
  }

  if ("category" in source) {
    const category = typeof source.category === "string" ? source.category.trim() : "";
    updates.category = category || null;
  }

  if ("question" in source) {
    const question = typeof source.question === "string" ? source.question.trim() : "";
    if (!question) return json(400, { error: "Question is required." });
    updates.question = question;
  }

  if ("answer_md" in source) {
    const answer = typeof source.answer_md === "string" ? source.answer_md.trim() : "";
    if (!answer) return json(400, { error: "Answer is required." });
    updates.answer_md = answer;
  }

  if ("sort_order" in source) {
    const parsedSortOrder = parseSortOrder(source.sort_order);
    if (parsedSortOrder === null) return json(400, { error: "sort_order must be an integer." });
    updates.sort_order = parsedSortOrder;
  }

  if ("is_published" in source) {
    const parsedIsPublished = parseBoolean(source.is_published);
    if (parsedIsPublished === null) return json(400, { error: "is_published must be a boolean." });
    updates.is_published = parsedIsPublished;
  }

  if (Object.keys(updates).length === 0) {
    return json(400, { error: "No valid fields to update." });
  }

  updates.updated_at = new Date();

  const [updated] = await db
    .update(Faq)
    .set(updates)
    .where(eq(Faq.id, faqId))
    .returning();

  if (!updated) {
    return json(404, { error: "FAQ not found." });
  }

  return json(200, {
    item: {
      id: updated.id,
      audience: normalizeAudience(updated.audience),
      category: updated.category ?? "",
      question: updated.question,
      answer_md: updated.answer_md,
      sort_order: updated.sort_order ?? 0,
      is_published: updated.is_published === true,
      updated_at: toIsoString(updated.updated_at),
    },
  });
};

export const DELETE: APIRoute = async ({ request, cookies, params }) => {
  const authError = requireAdminApiAccess(cookies, request);
  if (authError) return authError;

  const faqId = parseId(params.id);
  if (!faqId) return json(400, { error: "Invalid FAQ id." });

  const [deleted] = await db.delete(Faq).where(eq(Faq.id, faqId)).returning();
  if (!deleted) {
    return json(404, { error: "FAQ not found." });
  }

  return json(200, { ok: true, id: deleted.id });
};

export const GET: APIRoute = async () => json(405, { error: "Method Not Allowed" });
export const POST: APIRoute = async () => json(405, { error: "Method Not Allowed" });
