import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/app/_context/providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://threadforge.app"),
  title: {
    default: "ThreadForge | Build Your Community",
    template: "%s | ThreadForge",
  },
  description:
    "ThreadForge is a modern Reddit-inspired community platform to launch topic channels, grow engaged audiences, and manage conversations with smart moderation.",
  applicationName: "ThreadForge",
  keywords: [
    "ThreadForge",
    "community platform",
    "discussion forum",
    "online communities",
    "creator tools",
    "moderation tools",
    "reddit alternative",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "ThreadForge",
    title: "ThreadForge | Build Your Community",
    description:
      "Launch topic channels, reward contributors, and grow loyal communities with ThreadForge.",
  },
  twitter: {
    card: "summary",
    title: "ThreadForge | Build Your Community",
    description:
      "Launch topic channels and grow engaged communities with smart moderation.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
