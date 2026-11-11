import type { Metadata } from "next";
import WelcomeView from "@/components/views/WelcomeView";

export const metadata: Metadata = { title: "Set up your playbook · AI Playbook for Schools" };

export default function Page() {
  return <WelcomeView />;
}
