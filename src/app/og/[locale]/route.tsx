import type { CSSProperties } from "react";
import { ImageResponse } from "next/og";
import { isLocale, LOCALES } from "@/i18n/locales";
import { MESSAGES } from "@/i18n/messages";
import { loadOgFonts, OG_COLORS as C } from "@/lib/og/theme";
import { SITE_DOMAIN } from "@/lib/site";

/**
 * Imagen al compartir el enlace (Open Graph y X), una por idioma: la banda de rayas con la marca, el titular de la
 * portada y el casete con el reloj. Se genera en el build; el layout enlaza la del idioma de la página.
 */
const OG_SIZE = { width: 1200, height: 630 };

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

// ---------- Estilos ----------
// `ImageResponse` (Satori) no lee hojas de estilo ni variables CSS, solo `style` en línea: se juntan aquí, con
// nombre y agrupados por pieza, y el JSX de abajo solo dice qué va dónde.

const flex: CSSProperties = { display: "flex" };
const stack: CSSProperties = { ...flex, flexDirection: "column" };

const frame: CSSProperties = { ...stack, width: "100%", height: "100%", background: C.ink, fontFamily: "Barlow Condensed" };

/** La banda de tres rayas con la etiqueta de la marca. */
const band = {
  root: { position: "relative", display: "flex", flexDirection: "column", height: 108 } satisfies CSSProperties,
  stripe: (background: string): CSSProperties => ({ height: 36, background }),
  brand: {
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
  } satisfies CSSProperties,
};

const body: CSSProperties = { flex: 1, ...flex, alignItems: "center", justifyContent: "space-between", padding: "0 64px" };

/** A la izquierda: el titular de la portada y la dirección. */
const text = {
  root: { ...stack, width: 500 } satisfies CSSProperties,
  headline: { ...stack, fontSize: 92, lineHeight: 0.95, textTransform: "uppercase" } satisfies CSSProperties,
  line: { color: C.card } satisfies CSSProperties,
  emphasis: { color: C.saffron } satisfies CSSProperties,
  domain: { marginTop: 32, fontSize: 30, letterSpacing: 2, color: C.onShellSoft } satisfies CSSProperties,
};

/** A la derecha: el casete de la portada, con su etiqueta escrita a mano y la ventana con las bobinas y el reloj. */
const cassette = {
  shell: { ...stack, width: 540, padding: 26, borderRadius: 28, background: C.shell } satisfies CSSProperties,
  label: {
    ...flex,
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 22px",
    borderRadius: 12,
    background: C.card,
    color: C.ink,
  } satisfies CSSProperties,
  title: { fontFamily: "Kalam", fontSize: 34 } satisfies CSSProperties,
  worth: { ...flex, fontSize: 26, letterSpacing: 2, textTransform: "uppercase" } satisfies CSSProperties,
  points: { color: C.tomatoDeep } satisfies CSSProperties,
  window: {
    marginTop: 18,
    ...flex,
    alignItems: "center",
    justifyContent: "space-between",
    padding: "22px 28px",
    borderRadius: 999,
    background: C.window,
  } satisfies CSSProperties,
  clock: { fontSize: 96, lineHeight: 1, color: C.saffron } satisfies CSSProperties,
};

/** Bobina: rollo de cinta marrón, cubo de cartulina y el eje. */
const circle = (size: number, background: string): CSSProperties => ({
  width: size,
  height: size,
  borderRadius: size / 2,
  background,
  ...flex,
  alignItems: "center",
  justifyContent: "center",
});

// ---------- La imagen ----------

export async function GET(_req: Request, ctx: RouteContext<"/og/[locale]">) {
  const { locale } = await ctx.params;
  if (!isLocale(locale)) return new Response(null, { status: 404 });
  const m = MESSAGES[locale];
  const fonts = await loadOgFonts();

  return new ImageResponse(
    (
      <div style={frame}>
        <div style={band.root}>
          <div style={band.stripe(C.saffron)} />
          <div style={band.stripe(C.tomato)} />
          <div style={band.stripe(C.sky)} />
          <div style={band.brand}>{m.common.brand}</div>
        </div>

        <div style={body}>
          <div style={text.root}>
            <div style={text.headline}>
              <span style={text.line}>{m.home.headline}</span>
              <span style={text.emphasis}>{m.home.headlineEm}</span>
            </div>
            <div style={text.domain}>{SITE_DOMAIN}</div>
          </div>

          <div style={cassette.shell}>
            <div style={cassette.label}>
              <span style={cassette.title}>{m.home.demoTitle}</span>
              <span style={cassette.worth}>
                {m.home.demoWorth}&nbsp;<span style={cassette.points}>{m.home.demoPoints}</span>
              </span>
            </div>
            <div style={cassette.window}>
              <Reel />
              <span style={cassette.clock}>00:30</span>
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
      fonts,
    },
  );
}

function Reel() {
  return (
    <div style={circle(92, C.tapeBrown)}>
      <div style={circle(40, C.card)}>
        <div style={circle(12, C.window)} />
      </div>
    </div>
  );
}
