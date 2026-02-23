import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LockStock Scaffold",
  description: "Material stock management scaffold with Next.js and Supabase."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
