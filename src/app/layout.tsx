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

/** The HTML shell shared by every page. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions such as Dark Reader add attributes to these tags before React loads,
    // which would otherwise raise a hydration warning in development.
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
