import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gart Dash — Player Table",
  description:
    "The Gart Dash player table: real KERFUFFLE league state — rosters, salaries, contracts — beside market consensus.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
