import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MathIA — Comprendre. Raisonner. Créer.",
  description: "MathIA accompagne les élèves dans leurs apprentissages de mathématiques.",
  applicationName: "MathIA",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1849c6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
