// Loads src/data/content.json into Supabase (run after the migration in supabase/migrations).
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local. Safe to re-run: it upserts.
// Usage: node --env-file=.env.local scripts/seed-supabase.mjs
import { createClient } from "@supabase/supabase-js";
import { content, contentRows } from "./content-rows.mjs";

// Accepts either secret key name (service_role or secret).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env.local");
const db = createClient(url, key, { auth: { persistSession: false } });
const tables = contentRows(content());
for (const [table, rows] of tables) {
  const { error } = await db.from(table).upsert(rows);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: ${rows.length} rows`);
}
