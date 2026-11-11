import type { Metadata } from "next";
import MyActivityView from "@/components/views/MyActivityView";

export const metadata: Metadata = { title: "My ratings & feedback · AI Playbook for Schools" };

export default function Page() {
  return <MyActivityView />;
}
