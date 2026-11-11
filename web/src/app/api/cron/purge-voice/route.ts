import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "@/lib/supabase/env";

// Daily job (vercel.json): deletes voice recordings older than 30 days, keeping the written text,
// and recordings that no feedback points to anymore (for example, from deleted accounts).
// Vercel calls it with "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
const KEEP_DAYS = 30;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = supabaseUrl(), key = supabaseSecretKey();
  if (!url || !key) return Response.json({ deleted: 0, note: "Supabase isn't configured" });

  const db = createClient(url, key, { auth: { persistSession: false } });
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
  const { data: old, error } = await db.from("feedback").select("id, audio_path").not("audio_path", "is", null).lt("created_at", cutoff).limit(500);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (old.length) {
    const { error: removeError } = await db.storage.from("voice-feedback").remove(old.map((f) => f.audio_path as string));
    if (removeError) return Response.json({ error: removeError.message }, { status: 500 });
    const { error: clearError } = await db.from("feedback").update({ audio_path: null }).in("id", old.map((f) => f.id));
    if (clearError) return Response.json({ error: clearError.message }, { status: 500 });
  }
  const orphans = await removeOrphans(db);
  if ("error" in orphans) return Response.json({ error: orphans.error }, { status: 500 });
  return Response.json({ deleted: old.length, orphans: orphans.removed });
}

// Recordings no feedback points to (e.g. the account was deleted, or an upload whose feedback never
// saved). Files under a day old are skipped, so an upload that's about to be saved isn't removed.
async function removeOrphans(db: SupabaseClient): Promise<{ removed: number } | { error: string }> {
  const bucket = db.storage.from("voice-feedback");
  const dayAgo = Date.now() - 86_400_000;
  const { data: folders, error } = await bucket.list("", { limit: 1000 });
  if (error) return { error: error.message };
  const candidates: string[] = [];
  for (const folder of folders ?? []) {
    const { data: files } = await bucket.list(folder.name, { limit: 1000 });
    for (const f of files ?? []) {
      if (f.id && f.created_at && new Date(f.created_at).getTime() < dayAgo) candidates.push(`${folder.name}/${f.name}`);
    }
  }
  if (!candidates.length) return { removed: 0 };
  const { data: used, error: usedError } = await db.from("feedback").select("audio_path").in("audio_path", candidates);
  if (usedError) return { error: usedError.message };
  const keep = new Set((used ?? []).map((u: { audio_path: string | null }) => u.audio_path));
  const orphans = candidates.filter((c) => !keep.has(c));
  if (orphans.length) {
    const { error: removeError } = await bucket.remove(orphans);
    if (removeError) return { error: removeError.message };
  }
  return { removed: orphans.length };
}
