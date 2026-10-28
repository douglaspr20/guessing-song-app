import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { isLocale, LOCALES } from "@/i18n/locales";
import { MESSAGES } from "@/i18n/messages";

/**
 * Imagen al compartir el enlace (Open Graph y X), una por idioma: la banda de rayas con la marca, el titular de la
 * portada y el casete con el reloj. Se genera en el build; el layout enlaza la del idioma de la página.
 */
const OG_SIZE = { width: 1200, height: 630 };

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

// Los colores de `globals.css`: ImageResponse no lee variables CSS.
const C = {
  ink: "#1D2747",
  shell: "#26335C",
  shellHi: "#314172",
  window: "#0F1630",
  card: "#F4EEDF",
  saffron: "#F2B632",
  tomato: "#E5482E",
  tomatoDeep: "#C23A22",
  sky: "#6FB7E0",
  onShellSoft: "#B9C3E3",
  tapeBrown: "#5B3A1E",
};

const font = (file: string) => readFile(join(process.cwd(), "src/app/og/_fonts", file));

export async function GET(_req: Request, ctx: RouteContext<"/og/[locale]">) {
  const { locale } = await ctx.params;
  if (!isLocale(locale)) return new Response(null, { status: 404 });
  const m = MESSAGES[locale];
  const [cond, hand] = await Promise.all([font("BarlowCondensed-ExtraBold.ttf"), font("Kalam-Bold.ttf")]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.ink, fontFamily: "Barlow Condensed" }}>
        {/* La banda de tres rayas con la etiqueta de la marca. */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", height: 108 }}>
          <div style={{ height: 36, background: C.saffron }} />
          <div style={{ height: 36, background: C.tomato }} />
          <div style={{ height: 36, background: C.sky }} />
          <div
            style={{
              position: "absolute",
              left: 64,
              top: 26,
              display: "flex",
              padding: "8px 22px",
              borderRadius: 6,
              background: C.card,
              color: C.ink,
              fontSize: 40,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            {m.common.brand}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 500 }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 92, lineHeight: 0.95, textTransform: "uppercase" }}>
              <span style={{ color: C.card }}>{m.home.headline}</span>
              <span style={{ color: C.saffron }}>{m.home.headlineEm}</span>
            </div>
            <div style={{ marginTop: 32, fontSize: 30, letterSpacing: 2, color: C.onShellSoft }}>
              guessing-song-app.vercel.app
            </div>
          </div>

          {/* El casete de la portada: etiqueta escrita a mano y la ventana con las bobinas y el reloj. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 540,
              padding: 26,
              borderRadius: 28,
              background: C.shell,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 22px",
                borderRadius: 12,
                background: C.card,
                color: C.ink,
              }}
            >
              <span style={{ fontFamily: "Kalam", fontSize: 34 }}>{m.home.demoTitle}</span>
              <span style={{ display: "flex", fontSize: 26, letterSpacing: 2, textTransform: "uppercase" }}>
                {m.home.demoWorth}&nbsp;<span style={{ color: C.tomatoDeep }}>{m.home.demoPoints}</span>
              </span>
            </div>
            <div
              style={{
                marginTop: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "22px 28px",
                borderRadius: 999,
                background: C.window,
              }}
            >
              <Reel />
              <span style={{ fontSize: 96, lineHeight: 1, color: C.saffron }}>00:30</span>
              <Reel />
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      // Solo cambia con un despliegue (que vacía la caché de Vercel): la CDN la guarda y no se dibuja en cada visita.
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=31536000" },
      fonts: [
        { name: "Barlow Condensed", data: cond, weight: 800, style: "normal" },
        { name: "Kalam", data: hand, weight: 700, style: "normal" },
      ],
    },
  );
}

/** Bobina: rollo de cinta marrón, cubo de cartulina y el eje. */
function Reel() {
  return (
    <div style={{ width: 92, height: 92, borderRadius: 46, background: C.tapeBrown, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: 20, background: C.card, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 12, height: 12, borderRadius: 6, background: C.window }} />
      </div>
    </div>
  );
}
