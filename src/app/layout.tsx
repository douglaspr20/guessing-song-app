import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, Kalam } from "next/font/google";
import "./globals.css";

// Texto corrido.
const body = Barlow({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
// Contadores, etiquetas y botones: la tipografía de las rayas de la cinta.
const cond = Barlow_Condensed({ variable: "--font-cond", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
// Lo "escrito a mano" en la carátula: nombres y títulos.
const hand = Kalam({ variable: "--font-hand", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Adivina la canción",
  description: "El juego familiar de adivinar canciones con tu Spotify.",
};

export const viewport: Viewport = {
  themeColor: "#1D2747",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${body.variable} ${cond.variable} ${hand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
