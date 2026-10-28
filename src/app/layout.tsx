import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { BandProvider } from "@/components/band/BandStatus";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { SiteAnalytics } from "@/components/SiteAnalytics";
import { LocaleRoot } from "@/i18n/LocaleRoot";
import { getMessages } from "@/i18n/server";
import { fontClasses } from "./fonts";
import "./globals.css";

// En Vercel, el dominio de producción (también en las previews, para que las URL de las imágenes sean estables).
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://127.0.0.1:3000";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await getMessages();
  const title = m.common.brand;
  const description = m.common.metaDescription;
  // La imagen al compartir va en el idioma de la página (los rastreadores sin idioma reciben el español).
  const image = { url: `/og/${locale}`, width: 1200, height: 630, alt: m.common.ogAlt };
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: {
      type: "website",
      siteName: title,
      title,
      description,
      locale: locale === "es" ? "es_ES" : "en_US",
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export const viewport: Viewport = {
  themeColor: "#1D2747",
  // Con el teclado del móvil abierto la página se encoge en vez de quedar tapada (Chrome en Android).
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `lang` se corrige en el cliente con el idioma de la persona (ver I18nProvider).
    <html lang="es" className={fontClasses}>
      <body>
        {process.env.NODE_ENV !== "production" && (
          // En desarrollo Spotify solo vuelve a 127.0.0.1, y para el navegador "localhost" es otro sitio
          // con otras cookies (la sesión no pasaría de uno a otro): siempre usamos 127.0.0.1.
          <script
            dangerouslySetInnerHTML={{
              __html: `if(location.hostname==="localhost")location.replace(location.href.replace("//localhost","//127.0.0.1"))`,
            }}
          />
        )}
        {/* El idioma sale de la cookie o del navegador: se lee por petición, dentro de Suspense. */}
        <Suspense>
          <LocaleRoot>
            <FeedbackProvider>
              {/* La banda de rayas de arriba: una para toda la app; cada pantalla pone su etiqueta con <BandStatus>. */}
              <BandProvider>{children}</BandProvider>
            </FeedbackProvider>
          </LocaleRoot>
        </Suspense>
        {/* Analítica solo en Vercel (VERCEL=1): en local, CI y e2e no se carga nada. Lee la URL: va en Suspense. */}
        {process.env.VERCEL === "1" && (
          <Suspense>
            <SiteAnalytics />
          </Suspense>
        )}
      </body>
    </html>
  );
}
