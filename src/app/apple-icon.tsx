import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Icono de la pantalla de inicio del iPhone: el mismo dibujo que `icon.svg`, sobre la carcasa y con margen para la máscara de iOS.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const svg = await readFile(join(process.cwd(), "src/app/icon.svg"));
  const src = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1D2747" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse solo entiende <img>. */}
        <img src={src} width={140} height={140} alt="" />
      </div>
    ),
    size,
  );
}
