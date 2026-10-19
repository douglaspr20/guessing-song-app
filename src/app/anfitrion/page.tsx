import type { Metadata } from "next";
import { HostClient } from "./HostClient";

// Entrada del anfitrión: no está enlazada desde ninguna parte y no debe aparecer en buscadores.
export const metadata: Metadata = {
  title: "Anfitrión · Adivina la canción",
  robots: { index: false, follow: false, nocache: true },
};

export default function HostPage() {
  return <HostClient />;
}
