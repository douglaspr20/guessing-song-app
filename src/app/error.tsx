"use client";

import { BrokenTapeScreen } from "@/components/errors/BrokenTapeScreen";

/** Error al pintar cualquier página: la cinta enredada con «Rebobinar» (vuelve a pedir la página). */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <BrokenTapeScreen error={error} retry={retry} />;
}
