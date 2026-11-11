import type { Metadata } from "next";
import LingoView from "@/components/views/LingoView";

export const metadata: Metadata = { title: "Lingo & Acronyms · AI Playbook for Schools" };

export default function Page() {
  return <LingoView />;
}
