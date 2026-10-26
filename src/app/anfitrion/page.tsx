import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";
import { HostClient } from "./HostClient";

// Entrada del anfitrión: no está enlazada desde ninguna parte y no debe aparecer en buscadores.
export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getMessages();
  return { title: m.host.pageTitle, robots: { index: false, follow: false, nocache: true } };
}

export default function HostPage() {
  return <HostClient />;
}
