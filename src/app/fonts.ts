import { Barlow, Barlow_Condensed, Kalam } from "next/font/google";

// Texto corrido.
export const body = Barlow({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
// Contadores, etiquetas y botones: la tipografía de las rayas de la cinta.
export const cond = Barlow_Condensed({ variable: "--font-cond", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
// Lo "escrito a mano" en la carátula: nombres y títulos.
export const hand = Kalam({ variable: "--font-hand", subsets: ["latin"], weight: ["400", "700"] });

/** Clases para <html>: el layout raíz y la página de error global las comparten. */
export const fontClasses = `${body.variable} ${cond.variable} ${hand.variable}`;
