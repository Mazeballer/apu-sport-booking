import type React from 'react';
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from 'sonner'; // ✅ use Sonner instead of Shadcn toaster
import { ThemeProvider } from '@/components/theme-provider';
import RegisterSW from '@/components/register-sw';

export const metadata: Metadata = {
  title: 'APU Sports Facility Booking',
  description: 'Book sports facilities at APU',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'APU Sports',
  },
};

export const viewport: Viewport = { themeColor: '#0A66C2' };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <RegisterSW />
        </ThemeProvider>
      </body>
    </html>
  );
}
