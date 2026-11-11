import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Big_Shoulders } from "next/font/google";
import { preconnect } from "react-dom";
import AccountProvider from "@/components/AccountProvider";
import CommunityProvider from "@/components/CommunityProvider";
import PlaybookProvider from "@/components/PlaybookProvider";
import { getContent } from "@/lib/content";
import "./globals.css";

// Headings: Big Shoulders (Google's current name for Big Shoulders Display). Body: Atkinson Hyperlegible.
const display = Big_Shoulders({ weight: ["700", "800", "900"], subsets: ["latin"], variable: "--font-bsd" });
const body = Atkinson_Hyperlegible({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-ahl" });

export const metadata: Metadata = {
  title: "AI Playbook for Schools",
  description: "AI game plans for teachers, counselors, admin and the whole school staff: tools, plays, system prompts and plain-English lingo.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const content = await getContent();
  // The browser talks to Supabase for sign-in, ratings and feedback; open that connection early.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) preconnect(process.env.NEXT_PUBLIC_SUPABASE_URL, { crossOrigin: "anonymous" });
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <AccountProvider>
          <CommunityProvider>
            <PlaybookProvider content={content}>{children}</PlaybookProvider>
          </CommunityProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
