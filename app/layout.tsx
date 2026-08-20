import type { Metadata } from "next";
import "./globals.css";
import MockDataBanner from "@/components/MockDataBanner";

export const metadata: Metadata = {
  title: "Gart Dash — Player Table (Prototype)",
  description:
    "Mock-data prototype of the Gart Dash player table: your KERFUFFLE value vs. the market, side by side.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {/* Always-on, per Issue #1: this prototype must never be mistaken for real league data. */}
        <MockDataBanner />
        {children}
      </body>
    </html>
  );
}
