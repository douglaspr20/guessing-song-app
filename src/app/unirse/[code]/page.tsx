import { Suspense } from "react";
import { JoinFlow } from "@/components/JoinFlow";

/** El enlace (o el QR) que comparte el anfitrión: lleva el código y se comprueba solo. */
export default function JoinWithCodePage() {
  // El código se lee en el navegador (`useParams`): así la página no espera al servidor para mostrarse.
  return (
    <Suspense>
      <JoinFlow />
    </Suspense>
  );
}
