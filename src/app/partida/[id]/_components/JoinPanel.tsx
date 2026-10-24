"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, DoorClosed, DoorOpen, UserMinus } from "lucide-react";
import QRCode from "qrcode";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import { TeamDot } from "@/components/TeamDot";
import ui from "@/components/ui.module.css";
import { api, type Game } from "@/lib/client/api";
import { useLiveGame } from "@/lib/client/live";
import styles from "../game.module.css";

interface Joined {
  id: string;
  name: string;
  hasAccount: boolean;
  team: { name: string; color: string } | null;
}

/**
 * El código, el enlace y el QR para que la gente se una desde su móvil, y quién ya está dentro.
 * Antes de la primera pista va desplegado; durante la partida se pliega para dejar sitio al marcador.
 */
export function JoinPanel({ game, onChanged }: { game: Game; onChanged: () => Promise<unknown> | void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [people, setPeople] = useState<Joined[]>([]);
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const link = `${window.location.origin}/unirse/${game.code}`;
    // El enlace depende del origen del navegador: se calcula tras montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(link);
    QRCode.toString(link, { type: "svg", margin: 1, color: { dark: "#1d2747", light: "#0000" } }).then(setQr, () => setQr(""));
  }, [game.code]);

  const load = useCallback(
    () =>
      api<{ participants: Joined[] }>(`/api/games/${game.id}/participants`).then(
        (r) => setPeople(r.participants),
        () => {},
      ),
    [game.id],
  );

  useEffect(() => {
    // Carga inicial de quién está dentro.
    void load();
  }, [load]);

  // Alguien entra o se va: se vuelve a leer la lista.
  useLiveGame(game.id, (e) => {
    if (e.type === "participant_joined" || e.type === "participant_left" || e.type === "poll" || e.type === "reconnected") {
      void load();
    }
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ tone: "ok", text: "Enlace copiado: pégalo en el chat." });
    } catch {
      toast({ tone: "error", text: "No se pudo copiar. Selecciona el enlace y cópialo a mano." });
    }
  };

  const toggleOpen = async () => {
    setBusy(true);
    try {
      await api(`/api/games/${game.id}`, { method: "PATCH", json: { joinOpen: !game.joinOpen } });
      await onChanged();
    } catch (e) {
      toast({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const kick = async (p: Joined) => {
    const ok = await confirm({
      title: `¿Sacar a ${p.name}?`,
      body: "Deja de ver la partida y no puede volver a entrar con su cuenta. Sus puntos se quedan.",
      confirmLabel: "Sacar",
    });
    if (!ok) return;
    try {
      await api(`/api/games/${game.id}/participants/${p.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      toast({ tone: "error", text: (e as Error).message });
    }
  };

  const started = !!game.round;
  const finished = game.status === "FINISHED";
  if (finished) return null;

  return (
    <details className={`${ui.card} ${styles.join}`} open={!started}>
      <summary className={styles.joinSummary}>
        <span className={ui.cardTitle}>Únete con tu móvil</span>
        <span className={styles.joinCodeSmall}>{game.code}</span>
      </summary>
      <div className={styles.joinBody}>
        <div className={styles.joinTop}>
          <div>
            <p className={styles.joinHint}>Entra en <strong>{url ? new URL(url).host : "…"}/unirse</strong> y escribe</p>
            <p className={styles.joinCode} aria-label={`Código ${game.code.split("").join(" ")}`}>
              {game.code}
            </p>
          </div>
          {qr && (
            <div className={styles.joinQr} role="img" aria-label="Código QR para unirse" dangerouslySetInnerHTML={{ __html: qr }} />
          )}
        </div>

        <div className={styles.joinActions}>
          <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={copy} disabled={!url}>
            <Copy size={20} aria-hidden />
            Copiar enlace
          </button>
          <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={toggleOpen} disabled={busy} aria-pressed={!game.joinOpen}>
            {game.joinOpen ? <DoorClosed size={20} aria-hidden /> : <DoorOpen size={20} aria-hidden />}
            {game.joinOpen ? "Cerrar entrada" : "Abrir entrada"}
          </button>
        </div>
        {!game.joinOpen && <p className={styles.joinHint}>La entrada está cerrada: nadie nuevo puede unirse.</p>}

        <div>
          <p className={styles.joinListTitle}>
            {people.length === 0 ? "Aún no se ha unido nadie" : `${people.length} ${people.length === 1 ? "persona dentro" : "personas dentro"}`}
          </p>
          {people.length > 0 && (
            <ul className={styles.joinList}>
              {people.map((p) => (
                <li key={p.id} className={styles.joinPerson}>
                  <span className={styles.joinName}>
                    <TeamDot color={p.team?.color} size={12} />
                    {p.name}
                  </span>
                  {p.team && <span className={styles.joinTeam}>{p.team.name}</span>}
                  <button
                    type="button"
                    className={styles.joinKick}
                    onClick={() => kick(p)}
                    aria-label={`Sacar a ${p.name}`}
                  >
                    <UserMinus size={20} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}
