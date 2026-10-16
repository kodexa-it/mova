import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

// Instrument Sans, variable y servida desde el propio dominio (sin CDN externo,
// compatible con la CSP). Incluye cifras tabulares (tnum).
import "@fontsource-variable/instrument-sans/wght.css";
import "./globals.css";

import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "Mova", template: "%s · Mova" },
  description: "Planificá, producí, aprobá y medí la comunicación digital de tu empresa.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#fbfaf8", colorScheme: "light" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
