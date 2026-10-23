import type { Metadata, Viewport } from "next";
import { BandProvider } from "@/components/band/BandStatus";
import { FeedbackProvider } from "@/components/feedback/FeedbackProvider";
import { fontClasses } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adivina la canción",
  description: "El juego familiar de adivinar canciones con tu Spotify.",
};

export const viewport: Viewport = {
  themeColor: "#1D2747",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
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
        <FeedbackProvider>
          {/* La banda de rayas de arriba: una para toda la app; cada pantalla pone su etiqueta con <BandStatus>. */}
          <BandProvider>{children}</BandProvider>
        </FeedbackProvider>
      </body>
    </html>
  );
}
