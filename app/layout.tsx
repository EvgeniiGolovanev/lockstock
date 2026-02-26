import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LockStock",
  description: "Inventory operations system for materials, locations, vendors, and purchase orders."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
