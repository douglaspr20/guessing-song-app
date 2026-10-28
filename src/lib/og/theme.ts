import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Los colores de `globals.css`: `ImageResponse` no lee variables CSS. */
export const OG_COLORS = {
  ink: "#1D2747",
  shell: "#26335C",
  shellHi: "#314172",
  window: "#0F1630",
  card: "#F4EEDF",
  cardRule: "#C9C0AA",
  cardInkSoft: "#4A5170",
  saffron: "#F2B632",
  tomato: "#E5482E",
  tomatoDeep: "#C23A22",
  sky: "#6FB7E0",
  onShellSoft: "#B9C3E3",
  tapeBrown: "#5B3A1E",
};

const font = (file: string) => readFile(join(process.cwd(), "src/app/og/_fonts", file));

/** Las dos tipografías de la app (condensada para títulos y marcadores, Kalam para lo escrito a mano). */
export async function loadOgFonts() {
  const [cond, hand] = await Promise.all([font("BarlowCondensed-ExtraBold.ttf"), font("Kalam-Bold.ttf")]);
  return [
    { name: "Barlow Condensed", data: cond, weight: 800 as const, style: "normal" as const },
    { name: "Kalam", data: hand, weight: 700 as const, style: "normal" as const },
  ];
}
