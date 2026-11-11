import type { Metadata } from "next";
import TopFiveView from "@/components/views/TopFiveView";

export const metadata: Metadata = { title: "Top 5 by Role · AI Playbook for Schools" };

export default function Page() {
  return <TopFiveView />;
}
