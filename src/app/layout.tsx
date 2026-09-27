import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";

// Using system font stack — avoids network dependency at build time.
// The design system already defines --font-inter in globals.css with a full
// system-ui fallback chain so the UI looks identical locally and in production.

export const metadata: Metadata = {
  title: "BobShip — AI Release Engineer",
  description:
    "The autonomous AI release engineer that takes your app from finished code to store-ready release.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
