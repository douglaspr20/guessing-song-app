"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { beforeSend } from "@/lib/client/analytics";

/**
 * Visitas (Vercel Analytics, sin cookies) y velocidad real (Speed Insights), con las URL limpias de ids y
 * códigos. El layout solo lo monta en Vercel: en local, en CI y en las pruebas e2e no se carga nada.
 */
export function SiteAnalytics() {
  return (
    <>
      <Analytics beforeSend={beforeSend} />
      <SpeedInsights beforeSend={beforeSend} />
    </>
  );
}
