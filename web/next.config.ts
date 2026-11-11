import type { NextConfig } from "next";

// Security headers for every response. The Content Security Policy only lets the page load
// scripts, styles and fonts from this site, talk to our Supabase project, and play audio from
// recordings. Pages are prerendered for speed, so scripts use 'unsafe-inline' rather than
// per-request nonces (see the Next.js CSP guide); React escapes all user text, and nothing
// renders user-supplied HTML.
const isDev = process.env.NODE_ENV === "development";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabase.replace(/^http/, "ws");

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${supabaseWs}`.trim(),
  `media-src 'self' blob: ${supabase}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${supabase}`.trim(),
  "frame-ancestors 'none'",
  // Force https everywhere, except for a local http Supabase used in testing.
  ...(isDev || supabase.startsWith("http:") ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microphone only for this site (voice feedback); camera, location and payment APIs off.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
