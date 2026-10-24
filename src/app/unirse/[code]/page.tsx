import { Suspense } from "react";
import { JoinFlow } from "@/components/JoinFlow";

/** El enlace (o el QR) que comparte el anfitrión: lleva el código y se comprueba solo. */
export default function JoinWithCodePage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense>
      <WithCode params={params} />
    </Suspense>
  );
}

// El código llega en la URL: se lee dentro de Suspense para que la ruta se pueda preparar sin él.
async function WithCode({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinFlow initialCode={code} />;
}
