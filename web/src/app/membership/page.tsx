import type { Metadata } from "next";
import MembershipView from "@/components/views/MembershipView";

export const metadata: Metadata = { title: "Membership · AI Playbook for Schools" };

export default function Page() {
  return <MembershipView />;
}
