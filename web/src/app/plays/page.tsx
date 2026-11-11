import type { Metadata } from "next";
import PlaysView from "@/components/views/PlaysView";

export const metadata: Metadata = { title: "The Plays · AI Playbook for Schools" };

export default function Page() {
  return <PlaysView />;
}
