import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/components/language-provider";

export const metadata: Metadata = {
  title: "LockStock",
  description: "Inventory operations system for materials, locations, vendors, and purchase orders.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" }
    ],
    shortcut: "/favicon.ico"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: "try { var locale = localStorage.getItem('lockstock.locale'); if (locale) { locale = locale.toLowerCase().startsWith('fr') ? 'fr' : 'en'; document.documentElement.lang = locale; document.documentElement.dataset.locale = locale; } } catch (_) {}"
          }}
        />
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
