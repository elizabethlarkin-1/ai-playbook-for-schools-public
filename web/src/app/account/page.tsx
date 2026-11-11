import type { Metadata } from "next";
import AccountSettingsView from "@/components/views/AccountSettingsView";

export const metadata: Metadata = { title: "Account Settings · AI Playbook for Schools" };

export default function Page() {
  return <AccountSettingsView />;
}
