import type { Metadata } from "next";
import { PlatformCockpit } from "@/components/platform-cockpit";

export const metadata: Metadata = {
  title: "Platform Cockpit | LockStock",
  description: "Internal read-only operations cockpit for LockStock platform administrators."
};

export default function PlatformPage() {
  return <PlatformCockpit />;
}
