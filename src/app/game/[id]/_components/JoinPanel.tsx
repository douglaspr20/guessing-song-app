"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, DoorClosed, DoorOpen, UserMinus } from "lucide-react";
import QRCode from "qrcode";
import { useToast } from "@/components/feedback/FeedbackProvider";
import { useConfirmedAction } from "@/components/feedback/useConfirmedAction";
import controls from "@/components/styles/controls.module.css";
import { TeamDot } from "@/components/TeamDot";
import ui from "@/components/ui.module.css";
import { api, errorText, type Game } from "@/lib/client/api";
import type { LiveEvent } from "@/lib/client/live";
import { plural } from "@/i18n/format";
import { useI18n } from "@/i18n/client";
import styles from "../game.module.css";

interface Joined {
  id: string;
  name: string;
  hasAccount: boolean;
  team: { name: string; color: string } | null;
  /** Otro navegador pide quedarse con su sitio (perdió su sesión): el anfitrión decide. */
  claim: boolean;
  /** Es el propio anfitrión, que también juega: no se le saca desde aquí. */
  host: boolean;
}

/**
 * El código, el enlace y el QR para que la gente se una desde su móvil, y quién ya está dentro.
 * Antes de la primera pista va desplegado; durante la partida se pliega para dejar sitio al marcador.
 */
export function JoinPanel({
  game,
  onChanged,
  event,
}: {
  game: Game;
  onChanged: () => Promise<unknown> | void;
  /** Último aviso de la partida (la conexión en tiempo real la lleva la pantalla de la tele). */
  event: LiveEvent | null;
}) {
  const { m, locale } = useI18n();
  const g = m.game;
  const toast = useToast();
  const act = useConfirmedAction();
  const [people, setPeople] = useState<Joined[]>([]);
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  /** Quién tenía ya una petición al leer la lista: solo se avisa de las nuevas. */
  const asked = useRef(new Set<string>());

  useEffect(() => {
    const link = `${window.location.origin}/join/${game.code}`;
    // El enlace depende del origen del navegador: se calcula tras montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(link);
    QRCode.toString(link, { type: "svg", margin: 1, color: { dark: getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#1d2747", light: "#0000" } }).then(setQr, () => setQr(""));
  }, [game.code]);

  const load = useCallback(
    () =>
      api<{ participants: Joined[] }>(`/api/games/${game.id}/participants`).then(
        (r) => {
          setPeople(r.participants);
          // Avisa de cada petición nueva (con o sin tiempo real: sale de la propia lista, no del evento).
          const now = new Set(r.participants.filter((p) => p.claim).map((p) => p.id));
          for (const p of r.participants) if (p.claim && !asked.current.has(p.id)) toast({ tone: "ok", text: g.claimToast(p.name) });
          asked.current = now;
        },
        () => {},
      ),
    [game.id, toast, g],
  );

  useEffect(() => {
    // Carga inicial de quién está dentro.
    void load();
  }, [load]);

  // Alguien entra o se va: se vuelve a leer la lista.
  useEffect(() => {
    if (!event) return;
    if (["participant_joined", "participant_left", "claim_requested", "claim_resolved", "poll", "reconnected"].includes(event.type)) void load();
  }, [event, load]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ tone: "ok", text: g.linkCopied });
    } catch {
      toast({ tone: "error", text: g.cantCopy });
    }
  };

  const toggleOpen = async () => {
    setBusy(true);
    try {
      await api(`/api/games/${game.id}`, { method: "PATCH", json: { joinOpen: !game.joinOpen } });
      await onChanged();
    } catch (e) {
      toast({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const kick = (p: Joined) =>
    act({
      question: { title: g.kickTitle(p.name), body: g.kickBody, confirmLabel: g.kick },
      run: () => api(`/api/games/${game.id}/participants/${p.id}`, { method: "DELETE" }),
      after: load,
    });

  /** Deja entrar (el sitio pasa al navegador nuevo y el viejo sale) o rechaza la petición. */
  const resolve = async (p: Joined, accept: boolean) => {
    try {
      await api(`/api/games/${game.id}/participants/${p.id}/claim`, { method: "POST", json: { accept } });
    } catch (e) {
      toast({ tone: "error", text: errorText(e) });
    }
    await load();
  };

  const pending = people.filter((p) => p.claim).length;
  const started = !!game.round;
  const finished = game.status === "FINISHED";
  if (finished) return null;

  return (
    <details className={`${ui.card} ${styles.join}`} open={!started || pending > 0}>
      <summary className={styles.joinSummary}>
        <span className={ui.cardTitle}>{g.joinTitle}</span>
        {pending > 0 && <span className={styles.joinBadge}>{plural(locale, pending, g.claimBadge)}</span>}
        <span className={styles.joinCodeSmall}>{game.code}</span>
      </summary>
      <div className={styles.joinBody}>
        <div className={styles.joinTop}>
          <div>
            <p className={styles.joinHint}>
              {g.joinGoTo} <strong>{url ? new URL(url).host : "…"}/join</strong> {g.joinAndType}
            </p>
            <p className={styles.joinCode} aria-label={g.codeLabel(game.code.split("").join(" "))}>
              {game.code}
            </p>
          </div>
          {qr && (
            <div className={styles.joinQr} role="img" aria-label={g.qrLabel} dangerouslySetInnerHTML={{ __html: qr }} />
          )}
        </div>

        <div className={styles.joinActions}>
          <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={copy} disabled={!url}>
            <Copy size={20} aria-hidden />
            {g.copyLink}
          </button>
          <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={toggleOpen} disabled={busy} aria-pressed={!game.joinOpen}>
            {game.joinOpen ? <DoorClosed size={20} aria-hidden /> : <DoorOpen size={20} aria-hidden />}
            {game.joinOpen ? g.closeEntry : g.openEntry}
          </button>
        </div>
        {!game.joinOpen && <p className={styles.joinHint}>{g.entryClosed}</p>}

        <div>
          <p className={styles.joinListTitle}>
            {people.length === 0 ? g.nobodyJoined : plural(locale, people.length, g.peopleInside)}
          </p>
          {people.length > 0 && (
            <ul className={styles.joinList}>
              {people.map((p) => (
                <li key={p.id} className={`${styles.joinPerson} ${p.claim ? styles.joinClaim : ""}`}>
                  <span className={styles.joinName}>
                    <TeamDot color={p.team?.color} size={12} />
                    {p.name}
                  </span>
                  {p.team && <span className={styles.joinTeam}>{p.team.name}</span>}
                  {p.host ? (
                    <span className={styles.joinTeam}>{g.hostTag}</span>
                  ) : (
                    <button
                      type="button"
                      className={styles.joinKick}
                      onClick={() => kick(p)}
                      aria-label={g.kickLabel(p.name)}
                    >
                      <UserMinus size={20} aria-hidden />
                    </button>
                  )}
                  {p.claim && (
                    <div className={styles.joinAsk} role="group" aria-label={g.claimTitle(p.name)}>
                      <p className={styles.joinAskText}>
                        <strong>{g.claimTitle(p.name)}.</strong> {g.claimHelp}
                      </p>
                      <div className={styles.joinAskActions}>
                        <button type="button" className={`${ui.btn} ${ui.primary} ${controls.small}`} onClick={() => resolve(p, true)}>
                          {g.claimAllow}
                        </button>
                        <button type="button" className={`${ui.btn} ${ui.onCard} ${controls.small}`} onClick={() => resolve(p, false)}>
                          {g.claimDeny}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}
