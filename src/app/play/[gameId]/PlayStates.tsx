"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { BandStatus } from "@/components/band/BandStatus";
import { Card } from "@/components/Card";
import { useConfirmedAction } from "@/components/feedback/useConfirmedAction";
import { Podium } from "@/components/Podium";
import { ShareResult } from "@/components/ShareResult";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import { formatList } from "@/i18n/format";
import { api, type Game, type Round } from "@/lib/client/api";
import { winnerSummary, withPlaces } from "@/lib/game/standings";
import styles from "./play.module.css";

type Players = Game["players"];

/** Ya no estás en la partida (terminó o el anfitrión te sacó): volver a entrar con el código. */
export function OutOfGame() {
  const { m } = useI18n();
  const t = m.play;
  return (
    <>
      <BandStatus text={t.outBand} />
      <main className={styles.main}>
        <Card className={styles.card}>
          <div className={styles.body}>
            <h1 className={styles.headline}>{t.outTitle}</h1>
            <p className={styles.lede}>{t.outLede}</p>
            <Link href="/join" className={`${ui.btn} ${ui.primary} ${ui.big}`}>
              {t.joinWithCode}
            </Link>
          </div>
        </Card>
      </main>
    </>
  );
}

/** Antes de la primera pista: esperar o salirse (después ya no se puede, solo antes de empezar). */
export function PlayWaiting({ gameId }: { gameId: string }) {
  const { m } = useI18n();
  const t = m.play;
  const router = useRouter();
  const act = useConfirmedAction();
  const leave = async () => {
    const left = await act({
      question: { title: t.leaveTitle, body: t.leaveBody, confirmLabel: t.leaveConfirm },
      run: () => api(`/api/games/${gameId}/leave`, { method: "POST" }),
    });
    if (left) router.push("/");
  };
  return (
    <>
      <h1 className={styles.headline}>{t.waitingTitle}</h1>
      <p className={styles.lede}>{t.waitingLede}</p>
      <button type="button" className={`${ui.btn} ${ui.onCard} ${styles.leave}`} onClick={leave}>
        <LogOut size={20} aria-hidden />
        {t.leave}
      </button>
    </>
  );
}

/** Pista cerrada: quién la acertó (dicho para ti), la portada y la canción. */
export function PlayReveal({ round, players, myPlayerId, teams }: { round: Round; players: Players; myPlayerId: string; teams: boolean }) {
  const { m } = useI18n();
  const t = m.play;
  const winner = round.winnerPlayerId ? (players.find((p) => p.id === round.winnerPlayerId) ?? null) : null;
  const mineWon = winner?.id === myPlayerId;
  return (
    <>
      <h1 className={styles.headline}>
        {!winner ? t.nobodyGotIt : mineWon ? (teams ? t.yourTeamGotIt : t.youGotIt) : t.trackGuessed}
      </h1>
      {round.answer && (
        <div className={styles.answer}>
          {round.answer.albumImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.cover} src={round.answer.albumImage} alt="" />
          )}
          <p className={styles.song}>{round.answer.name}</p>
          <p className={styles.artist}>{round.answer.artists.join(", ")}</p>
        </div>
      )}
      <p className={styles.lede}>
        {winner && !mineWon ? t.guessedBy(winner.name) : ""}
        {t.waitingNext}
      </p>
    </>
  );
}

/** Fin de la partida: cómo acabó para ti y el podio. */
export function PlayFinale({
  gameId,
  players,
  myPlayerId,
  teams,
  next,
}: {
  gameId: string;
  players: Players;
  myPlayerId: string;
  teams: boolean;
  /** El anfitrión grabó «Otra igual»: el móvil se pasa solo; si no pudo, `error` dice por qué y `onFollow` reintenta. */
  next: { error: string | null; onFollow: () => void } | null;
}) {
  const { m, locale } = useI18n();
  const t = m.play;
  const result = winnerSummary(players);
  const line =
    result.kind === "none"
      ? t.nobodyScored
      : result.kind === "tie"
        ? t.tie(formatList(locale, result.names))
        : result.id === myPlayerId
          ? teams
            ? t.yourTeamWon
            : t.youWon
          : t.winnerWas(result.name);
  return (
    <>
      <h1 className={styles.headline}>{t.endOfTape}</h1>
      <p className={styles.lede}>{line}</p>
      <Podium entries={withPlaces(players)} size="grand" tone="card" />
      <ShareResult gameId={gameId} who="player" />
      {next && (
        <div role="status">
          <p className={styles.lede}>
            <strong>{t.nextGameTitle}.</strong> {next.error ?? t.followingNext}
          </p>
          {next.error && (
            <button type="button" className={`${ui.btn} ${ui.primary} ${ui.big}`} onClick={next.onFollow}>
              {t.joinNext}
            </button>
          )}
        </div>
      )}
      <Link href="/" className={`${ui.btn} ${ui.onCard}`}>
        {t.backHome}
      </Link>
    </>
  );
}
