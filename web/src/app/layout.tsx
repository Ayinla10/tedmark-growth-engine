import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tedmark AI | Control Center",
  description: "Tedmark AI Growth Engine — sales intelligence hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var stored = localStorage.getItem('tedmark-theme');
            var el = document.documentElement;
            el.classList.remove('light');
            el.classList.add('dark');
            if (stored !== 'light') localStorage.setItem('tedmark-theme', 'dark');
          })();
        `}} />
      </head>
      <body className="min-h-full font-sans antialiased" suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
