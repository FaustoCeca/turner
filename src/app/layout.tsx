import type { Metadata, Viewport } from "next";
import { Ubuntu } from "next/font/google";
import "./globals.css";

const ubuntu = Ubuntu({
  variable: "--font-ubuntu",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Turner";

export const metadata: Metadata = {
  title: { default: `${appName} | Turnos online`, template: `%s | ${appName}` },
  description: "Agenda online para negocios: reservas 24/7, señas con Mercado Pago y recordatorios.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#312f32",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${ubuntu.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
