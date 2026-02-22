import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("Missing TURSO_DATABASE_URL.");
  process.exit(1);
}

const client = createClient(authToken ? { url, authToken } : { url });

const statements = [
  `CREATE TRIGGER IF NOT EXISTS bookmark_cleanup_flashcard_deck_delete
   AFTER DELETE ON "FlashcardDecks"
   BEGIN
     DELETE FROM "Bookmark"
     WHERE entityType = 'deck'
       AND entityId = CAST(OLD.id AS TEXT);
   END;`,
];

try {
  for (const statement of statements) {
    await client.execute(statement);
  }
  console.log("Applied bookmark cleanup triggers for flashnote.");
} finally {
  client.close();
}
