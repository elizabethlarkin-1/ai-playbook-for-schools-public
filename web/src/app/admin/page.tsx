import type { Metadata } from "next";
import AdminView from "@/components/views/AdminView";

export const metadata: Metadata = { title: "Coach's office · AI Playbook for Schools", robots: { index: false } };

export default function Page() {
  return <AdminView />;
}
