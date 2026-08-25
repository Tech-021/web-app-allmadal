import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/app/components/toast-context";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

