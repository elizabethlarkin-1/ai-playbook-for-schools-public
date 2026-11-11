import type { Metadata } from "next";
import SystemPromptsView from "@/components/views/SystemPromptsView";

export const metadata: Metadata = { title: "System Prompts · AI Playbook for Schools" };

export default function Page() {
  return <SystemPromptsView />;
}
