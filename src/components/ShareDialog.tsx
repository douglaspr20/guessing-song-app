"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Copy, Download, Image as ImageIcon, Share2, X } from "lucide-react";
import { useToast } from "@/components/feedback/FeedbackProvider";
import controls from "@/components/styles/controls.module.css";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import styles from "./ShareDialog.module.css";

/** Lo que devuelve el servidor al compartir: el código del enlace y el titular para el texto de «Compartir…». */
export interface Shared {
  token: string;
  headline: string;
  cat: string;
}

const BUTTON = `${ui.btn} ${ui.onCard} ${controls.small}`;

/**
 * El modal de «Compartir resultado» (`<dialog>`): la vista previa de la tarjeta, el enlace, el menú de compartir del
 * móvil, la imagen como archivo y las dos descargas. El anfitrión además puede dejar de compartir (`onStop`).
 * Cabe en cualquier pantalla: el contenido se desplaza dentro del modal y la cabecera con la cruz no se mueve.
 */
export function ShareDialog({ shared, onClose, onStop }: { shared: Shared; onClose: () => void; onStop?: () => void }) {
  const { m } = useI18n();
  const t = m.share;
  const toast = useToast();
  const ids = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const link = useRef<HTMLInputElement>(null);
  /** La imagen vertical ya descargada: `share({ files })` tiene que llamarse dentro del clic, sin esperar nada. */
  const [file, setFile] = useState<File | null>(null);

  const url = `${window.location.origin}/r/${shared.token}`;
  const image = (v: "wide" | "tall") => `/r/${shared.token}/image?v=${v}`;

  // showModal: el navegador atrapa el foco, cierra con Esc y deja el resto de la página inerte.
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      opener?.focus?.();
    };
  }, []);

  // Si el navegador sabe compartir archivos, se deja lista la imagen vertical antes de que se pulse nada.
  useEffect(() => {
    if (typeof navigator.canShare !== "function") return;
    let live = true;
    fetch(image("tall"))
      .then((res) => res.blob())
      .then((blob) => {
        const png = new File([blob], `adivina-la-cancion-${shared.cat}.png`, { type: "image/png" });
        if (live && navigator.canShare({ files: [png] })) setFile(png);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // `image` solo depende del código.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared.token]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ text: t.linkCopied });
    } catch {
      // Sin permiso para el portapapeles: se deja el enlace seleccionado para copiarlo a mano.
      link.current?.select();
    }
  };

  /** Cerrar el menú del móvil sin elegir nada lanza `AbortError`: no es un fallo. */
  const share = async (data: ShareData) => {
    try {
      await navigator.share(data);
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast({ text: t.cantShare((err as Error).message), tone: "error" });
    }
  };

  const text = t.shareText(shared.headline, shared.cat);
  const canShareLink = typeof navigator.share === "function";

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={`${ids}-title`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Un clic en lo oscuro de alrededor (el propio `<dialog>`) cierra.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={ui.cardStripes} />
      <div className={styles.head}>
        <h2 className={styles.title} id={`${ids}-title`}>
          {t.panelTitle}
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
          <X size={24} aria-hidden />
        </button>
      </div>

      <div className={styles.scroll}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Es el PNG que genera el servidor, a su tamaño. */}
        <img className={styles.preview} src={image("wide")} alt={t.previewAlt} width={1200} height={630} />

        <div className={styles.linkRow}>
          <input
            ref={link}
            className={styles.link}
            value={url}
            readOnly
            aria-label={t.linkLabel}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button type="button" className={BUTTON} onClick={copy}>
            <Copy size={18} aria-hidden />
            {t.copyLink}
          </button>
        </div>

        {(canShareLink || file) && (
          <div className={styles.actions}>
            {canShareLink && (
              <button
                type="button"
                className={`${ui.btn} ${ui.primary} ${controls.small}`}
                onClick={() => share({ title: shared.headline, text, url })}
              >
                <Share2 size={18} aria-hidden />
                {t.nativeShare}
              </button>
            )}
            {file && (
              <button type="button" className={BUTTON} onClick={() => share({ files: [file], text })}>
                <ImageIcon size={18} aria-hidden />
                {t.shareImage}
              </button>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <a className={BUTTON} href={image("wide")} download={`adivina-la-cancion-${shared.cat}-apaisada.png`}>
            <Download size={18} aria-hidden />
            {t.downloadWide}
          </a>
          <a className={BUTTON} href={image("tall")} download={`adivina-la-cancion-${shared.cat}-vertical.png`}>
            <Download size={18} aria-hidden />
            {t.downloadTall}
          </a>
        </div>

        <p className={styles.privacy}>{t.privacy}</p>

        {onStop && (
          <button type="button" className={`${BUTTON} ${styles.stop}`} onClick={onStop}>
            {t.stop}
          </button>
        )}
      </div>
    </dialog>
  );
}
