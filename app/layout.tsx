import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import SettingsProvider from "@/components/SettingsProvider";
import NavBar from "@/components/NavBar";
import BottomNav from "@/components/BottomNav";
import ToastProvider from "@/components/ToastProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Opt out of static generation for all routes — this app requires auth/dynamic data
export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: {
    template: "%s | Cricket Team Balancer",
    default: "Cricket Team Balancer",
  },
  description: "Fairly balance indoor cricket teams — fair teams, every session.",
  icons: {
    // Emoji favicon — works in all modern browsers
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏏</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 min-h-screen`}>
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              <NavBar />
              {/* pb-20 reserves space for the mobile bottom nav */}
              <main className="pb-20 sm:pb-0">{children}</main>
              <BottomNav />
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
