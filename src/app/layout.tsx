import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { BandProvider } from "@/components/band/BandStatus";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { LocaleRoot } from "@/i18n/LocaleRoot";
import { getMessages } from "@/i18n/server";
import { fontClasses } from "./fonts";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.common.brand, description: m.common.metaDescription };
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
      </body>
    </html>
  );
}
