import type { Metadata } from "next";
import { NotificationViewport } from "@/components/ui/notification-viewport";
import { NavigationFeedback } from "@/components/ui/navigation-feedback";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Mufumbu Secondary School (Mufumbu SS) | Results Management System",
    template: "%s | Mufumbu Secondary School",
  },
  description:
    "The official website of Mufumbu Secondary School (Mufumbu SS), also known as Mufumbu RMS. Manage school results, students, and academic information.",
  applicationName: "Mufumbu RMS",
  keywords: [
    "Mufumbu SS",
    "Mufumbu Secondary School",
    "Mufumbu RMS",
    "Mufumbu school results",
    "Mufumbu results",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_TZ",
    siteName: "Mufumbu Secondary School",
    title: "Mufumbu Secondary School (Mufumbu SS)",
    description:
      "The official website of Mufumbu Secondary School and its results management system (Mufumbu RMS).",
  },
  twitter: {
    card: "summary",
    title: "Mufumbu Secondary School (Mufumbu SS)",
    description:
      "The official website of Mufumbu Secondary School and its results management system.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <NavigationFeedback />
        <NotificationViewport />
      </body>
    </html>
  );
}
