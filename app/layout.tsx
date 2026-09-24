import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AguiVision",
  description: "Video, highlights y transmisiones en vivo para Nido Águila",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="font-body">{children}</body>
    </html>
  );
}
