import type { Metadata } from "next";
import WhatWeCheckView from "@/components/views/WhatWeCheckView";

export const metadata: Metadata = { title: "How We Check the Tools · AI Playbook for Schools" };

export default function Page() {
  return <WhatWeCheckView />;
}
