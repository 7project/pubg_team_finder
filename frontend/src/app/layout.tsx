import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppLayout } from "@/components/app-layout";
import ClientProviders from "@/components/providers/client-providers";

export const metadata: Metadata = {
  title: "PUBG Team Finder",
  description: "Найди тиммейтов для PUBG по рангу",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body className="antialiased">
        <ClientProviders>
          <AppLayout>{children}</AppLayout>
        </ClientProviders>
      </body>
    </html>
  );
}