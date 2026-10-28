"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { useConfirmedAction } from "@/components/feedback/useConfirmedAction";
import { Notice } from "@/components/Notice";
import ui from "@/components/ui.module.css";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/client/api";
import { ShareDialog, type Shared } from "./ShareDialog";
import styles from "./ShareResult.module.css";

/**
 * El botón «Compartir resultado» de la pantalla final: crea el enlace público del podio y abre el modal con la
 * vista previa, el enlace y las descargas (`ShareDialog`). Lo usan la tele (`host`, que además puede dejar de
 * compartir) y cada móvil unido (`player`).
 */
export function ShareResult({ gameId, who }: { gameId: string; who: "host" | "player" }) {
  const { m } = useI18n();
  const t = m.share;
  const act = useConfirmedAction();
  const { busy, error, run } = useAsyncAction();
  const [shared, setShared] = useState<Shared | null>(null);

  const endpoint = who === "host" ? `/api/games/${gameId}/share` : `/api/play/${gameId}/share`;

  const open = async () => {
    const info = await run(() => api<Shared>(endpoint, { method: "POST" }));
    if (info) setShared(info);
  };

  const stop = () =>
    act({
      question: { title: t.stopTitle, body: t.stopBody, confirmLabel: t.stopConfirm, tone: "danger" },
      run: async () => {
        await api(endpoint, { method: "DELETE" });
        setShared(null);
      },
      done: t.stopped,
    });

  return (
    <>
      {/* Sin `disabled`: un botón desactivado pierde el foco y el modal no podría devolvérselo al cerrar. */}
      <button
        type="button"
        className={`${ui.btn} ${ui.onCard}`}
        onClick={busy ? undefined : open}
        aria-disabled={busy}
        aria-haspopup="dialog"
      >
        <Share2 size={22} aria-hidden />
        {busy ? t.preparing : t.button}
      </button>

      {error && (
        <Notice on="card" className={styles.full}>
          {t.cantShare(error)}
        </Notice>
      )}

      {shared && <ShareDialog shared={shared} onClose={() => setShared(null)} onStop={who === "host" ? stop : undefined} />}
    </>
  );
}
