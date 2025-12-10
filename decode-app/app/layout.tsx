import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { UserProvider } from "@/providers/UserContext";
import SessionMonitor from "@/components/SessionMonitor";
import GlobalLoadingWrapper from "@/components/GlobalLoadingWrapper";

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
      </head>
      <body className="antialiased">
        <AuthProvider>
          <UserProvider>
            <GlobalLoadingWrapper>
              <SessionMonitor />
              {children}
            </GlobalLoadingWrapper>
          </UserProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
