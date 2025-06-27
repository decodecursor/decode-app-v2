import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DECODE - Beauty Payment Platform",
  description: "Streamlined payment solutions for beauty professionals",
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
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
