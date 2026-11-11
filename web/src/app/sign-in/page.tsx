import type { Metadata } from "next";
import SignInView from "@/components/views/SignInView";

export const metadata: Metadata = { title: "Sign in · AI Playbook for Schools" };

export default function Page() {
  return <SignInView />;
}
