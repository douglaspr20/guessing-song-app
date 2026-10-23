import Link from "next/link";
import { Home } from "lucide-react";
import { ErrorScene } from "@/components/errors/ErrorScene";
import { LostTapeArt } from "@/components/errors/LostTapeArt";
import ui from "@/components/ui.module.css";

export default function NotFound() {
  return (
    <ErrorScene
      code="Error 404"
      title={
        <>
          Esta cinta
          <br />
          <em>se perdió</em>
        </>
      }
      lede="La buscamos por toda la estantería y no aparece. Puede que la hayan borrado o que el enlace esté mal."
      actions={
        <Link href="/" className={`${ui.btn} ${ui.primary} ${ui.big}`}>
          <Home size={26} aria-hidden />
          Volver a la estantería
        </Link>
      }
      art={<LostTapeArt />}
    />
  );
}
