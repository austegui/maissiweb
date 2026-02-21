import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maissi Beauty Shop AI",
  description: "WhatsApp inbox for Maissi Beauty Shop",
  icons: {
    icon: "/favicon.png",
  },
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
      </body>
    </html>
  );
}
