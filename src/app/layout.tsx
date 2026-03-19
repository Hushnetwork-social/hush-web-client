import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const metadataBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.trim() || "https://chat.hushnetwork.social";

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: "HushFeeds! - Decentralized Messaging",
  description: "Secure, decentralized messaging powered by HushNetwork blockchain",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HushFeeds!",
  },
  icons: {
    icon: [
      { url: "/icons/icon-72.png", sizes: "72x72", type: "image/png" },
      { url: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-128.png", sizes: "128x128", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // Allow content to extend behind notches/system UI
  interactiveWidget: "resizes-content", // Resize viewport when keyboard opens instead of auto-scrolling
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
