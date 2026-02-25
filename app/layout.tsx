import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import NavBar from "@/components/nav-bar";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Aloxi - AI Call Management",
  description: "AI-powered outbound call management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased`}
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <AuthProvider>
          <NavBar />
          {/* Main content area offset by sidebar on desktop, by top bar on mobile */}
          <main
            className="min-h-screen lg:ml-[var(--sidebar-width)] pt-14 lg:pt-0"
            style={{ background: "var(--bg-primary)" }}
          >
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
