import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuraGuide AI | Urban Air Quality & Smog Day Assistant",
  description:
    "Personalized hour-by-hour winter smog protection, deterministic exposure avoidance, and emissions savings for urban families.",
  authors: [{ name: "Animesh Banerjee" }],
  keywords: [
    "Air Quality",
    "AQI",
    "Smog",
    "Delhi Smog",
    "PM2.5",
    "Exposure Reduction",
    "Gemini AI",
    "AuraGuide",
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0369a1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
