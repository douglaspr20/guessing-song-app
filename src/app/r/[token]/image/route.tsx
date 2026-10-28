import { ImageResponse } from "next/og";
import { buildCardModel, plainCard, type CardModel } from "@/lib/game/share-card";
import { getSharedResult } from "@/lib/game/share";
import { loadOgFonts } from "@/lib/og/theme";
import { CARD_SIZES, TallCard, WideCard, type CardFormat } from "./_card";

/** Cuántos jugadores caben en la lista de debajo del podio: la tarjeta apaisada tiene menos sitio. */
const REST_MAX: Record<CardFormat, number> = { wide: 3, tall: 4 };

/** Cortita a propósito: «Dejar de compartir» tiene que surtir efecto en poco tiempo, también en la CDN. */
const CACHE = "public, max-age=300, s-maxage=3600";

/**
 * La tarjeta del resultado como PNG: `?v=wide` (1200×630, vista previa del enlace) o `?v=tall` (1080×1350, estados
 * e historias). Solo existe mientras la partida se comparte; si no, 404.
 */
export async function GET(req: Request, ctx: RouteContext<"/r/[token]/image">) {
  const { token } = await ctx.params;
  const result = await getSharedResult(token);
  if (!result) return new Response(null, { status: 404 });

  const format: CardFormat = new URL(req.url).searchParams.get("v") === "tall" ? "tall" : "wide";
  const fonts = await loadOgFonts();
  const render = async (card: CardModel) => {
    const element = format === "tall" ? <TallCard card={card} /> : <WideCard card={card} />;
    // Se lee el PNG entero aquí: un fallo al dibujar (p. ej. un emoji) llega mientras se genera, no con la respuesta ya enviada.
    return new ImageResponse(element, { ...CARD_SIZES[format], fonts }).arrayBuffer();
  };

  const card = buildCardModel(result, result.locale, REST_MAX[format]);
  let png: ArrayBuffer;
  try {
    png = await render(card);
  } catch (err) {
    console.warn("No se pudo dibujar la tarjeta con los nombres tal cual; se reintenta con letras latinas", err);
    png = await render(plainCard(card));
  }
  return new Response(png, {
    headers: {
      "content-type": "image/png",
      "cache-control": CACHE,
      "content-disposition": `inline; filename="adivina-la-cancion-${format}.png"`,
    },
  });
}
