import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Qui Veut Gagner Des Millions ?",
  description: "Quiz événementiel interactif",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
