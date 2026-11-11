// Supabase settings, accepting both naming styles: the older "anon" / "service_role" names and
// the newer "publishable" / "secret" names (used by Supabase's dashboard and Vercel's integration).
// Each NEXT_PUBLIC_ name is written out in full so Next.js can include it in the browser build.

/** Project URL. Safe for the browser. */
export const supabaseUrl = (): string | undefined => process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;

/** Public key (anon / publishable). Safe for the browser; row-level security protects the data. */
export const supabasePublicKey = (): string | undefined =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;

/** Secret key (service_role / secret). Server only: it bypasses row-level security. */
export const supabaseSecretKey = (): string | undefined =>
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
