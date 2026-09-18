import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/app/components/toast-context";
import { BusinessProvider } from "@/app/components/business-context";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#00875a",
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
      data-scroll-behavior="smooth"
      className={`h-full antialiased ${plusJakartaSans.variable}`}
    >
      <body className={`min-h-full flex flex-col ${plusJakartaSans.className}`}>
        <AuthProvider>
          <ToastProvider>
            <BusinessProvider>{children}</BusinessProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
