import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

// Same typeface as the plan PDF.
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "¿Qué negocio hace falta aquí? — Chihuahua",
  description: "Motor de oportunidades comerciales con datos del INEGI para emprendedores de Chihuahua.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${interTight.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
