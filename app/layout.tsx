import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/app/components/toast-context";
import { BusinessProvider } from "@/app/components/business-context";
import { RealtimeProvider } from "@/app/components/realtime-provider";

import { LanguageProvider } from "@/app/components/language-context";
import { ThemeProvider, themeInitScript } from "@/app/components/theme-context";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#f5f4f0",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Almadel | Store Management Portal",
  description: "Apni Dukaan Ko Asaan Banayein - Complete store management, inventory tracking, sales overview, and staff workspace.",
  keywords: ["Almadel", "Store Management", "Inventory", "POS Billing", "Pakistan Retail"],
  authors: [{ name: "Almadel Team" }],
  openGraph: {
    title: "Almadel | Store Management Portal",
    description: "Apni Dukaan Ko Asaan Banayein - Complete store management and inventory workspace.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`h-full antialiased ${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <RealtimeProvider>
              <ToastProvider>
                <BusinessProvider>{children}</BusinessProvider>
              </ToastProvider>
            </RealtimeProvider>
          </AuthProvider>
        </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}





