import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { UserProvider } from "@/providers/UserContext";
import SessionMonitor from "@/components/SessionMonitor";

export const metadata: Metadata = {
  title: "WeLoveDecode",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="format-detection" content="telephone=no" />
        {/* Preconnect to Stripe for faster SDK loading */}
        <link rel="preconnect" href="https://js.stripe.com" />
        <link rel="dns-prefetch" href="https://js.stripe.com" />
        {/* Inter font (legacy auctions/payment surfaces). Moved here
            from globals.css @import (Slice 7C 750ms render-blocking
            fix) so the font CSS request fires in parallel with the
            main CSS bundle, not serially after it parses. The
            preconnect pair primes the TCP+TLS handshake so the
            stylesheet fetch is one round-trip instead of three. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap"
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <UserProvider>
            <SessionMonitor />
            {children}
          </UserProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
