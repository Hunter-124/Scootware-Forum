import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { getCurrentUser } from "@/lib/session";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SCOOTWARE | Aggressive Performance Software",
  description: "Aggressive performance software and forum.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Navbar user={user} isAuthenticated={isAuthenticated} isAdmin={isAdmin} />
        <main className="flex-1 w-full relative">
          {children}
        </main>
        <footer className="border-t border-white/5 py-12 mt-auto glass-panel">
          <div className="container mx-auto px-4 text-center">
            <h4 className="font-display font-bold text-lg mb-4 tracking-wider">SCOOTWARE</h4>
            <p className="text-sm text-muted-foreground mb-4">© {new Date().getFullYear()} Scootware. Aggressive performance software.</p>
            <div className="flex justify-center gap-6 text-xs text-muted-foreground">
              <span className="hover:text-white cursor-pointer transition-colors">Terms of Service</span>
              <span className="hover:text-white cursor-pointer transition-colors">Privacy Policy</span>
              <span className="hover:text-white cursor-pointer transition-colors">Contact</span>
            </div>
          </div>
        </footer>
        <Toaster position="top-right" theme="dark" closeButton richColors />
      </body>
    </html>
  );
}
