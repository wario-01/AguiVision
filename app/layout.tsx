import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AguiVision",
  description: "Video, highlights y transmisiones en vivo para Nido Águila",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AguiVision",
  },
};

export const viewport = {
  themeColor: "#0A1830",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-body">{children}</body>
    </html>
  );
}
