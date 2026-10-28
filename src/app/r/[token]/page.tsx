import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getLocale } from "@/i18n/server";
import { MESSAGES } from "@/i18n/messages";
import { getSharedResult } from "@/lib/game/share";
import { buildCardModel, headlineOf } from "@/lib/game/share-card";
import { ResultView } from "./_components/ResultView";
import { ResultLoading } from "./_components/ResultLoading";

type Props = PageProps<"/r/[token]">;

/**
 * La vista previa del enlace (WhatsApp, LinkedIn, X…) sale en el idioma de quien compartió y lleva la tarjeta
 * apaisada. Es una página para quien recibe el enlace, no para buscadores.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { token } = await params;
  const result = await getSharedResult(token);
  const robots = { index: false, follow: false };
  if (!result) return { robots };
  const m = MESSAGES[result.locale];
  const card = buildCardModel(result);
  const headline = headlineOf(card);
  const title = m.share.pageTitle(headline, card.cat);
  const description = m.share.pageDescription(card.cat, card.tracks);
  const image = { url: `/r/${token}/image?v=wide`, width: 1200, height: 630, alt: m.share.cardAlt(headline, card.cat) };
  return {
    title,
    description,
    robots,
    openGraph: {
      type: "website",
      siteName: m.common.brand,
      title,
      description,
      locale: result.locale === "es" ? "es_ES" : "en_US",
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function ResultPage({ params }: Props) {
  return (
    <Suspense fallback={<ResultLoading />}>
      <Result params={params} />
    </Suspense>
  );
}

/** El resultado en el idioma de quien lo mira (la tarjeta del enlace, en el de quien compartió). */
async function Result({ params }: Pick<Props, "params">) {
  await connection();
  const { token } = await params;
  const result = await getSharedResult(token);
  if (!result) notFound();
  return <ResultView card={buildCardModel(result, await getLocale())} />;
}
