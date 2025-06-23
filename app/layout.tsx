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
      <body className="antialiased">
        {children}
        <div className="shooting-star"></div>
        <div className="shooting-star"></div>
        <div className="shooting-star"></div>
        <div className="shooting-star"></div>
      </body>
    </html>
  );
}
