"use client";

import Link from "next/link";
import { BandStatus } from "@/components/band/BandStatus";
import { MadeBy } from "@/components/MadeBy";
import { Podium } from "@/components/Podium";
import { TeamDot } from "@/components/TeamDot";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import type { CardModel } from "@/lib/game/share-card";
import styles from "../result.module.css";

/** El resultado de una partida compartida: la carátula del final (sin controles) y la invitación a jugar. */
export function ResultView({ card }: { card: CardModel }) {
  const { m } = useI18n();
  const t = m.share;
  return (
    <>
      <BandStatus text={`${card.cat} · ${card.kicker}`} />
      <main className={styles.main}>
        <div className={styles.wrap}>
          <section className={ui.card} aria-labelledby="result-title">
            <div className={styles.band}>
              <span className={styles.tag}>{card.cat}</span>
              <span className={styles.tag}>
                {card.tracks} · {card.date}
              </span>
            </div>
            <div className={styles.body}>
              <h1 className={styles.title} id="result-title">
                {card.headlinePrefix && <>{card.headlinePrefix} </>}
                <span className={styles.name}>{card.headlineText}</span>
              </h1>
              {card.scored && (
                <div className={styles.grid}>
                  <Podium
                    entries={card.podium.map((e, i) => ({
                      id: String(i),
                      name: e.name,
                      score: e.score,
                      place: e.place,
                      color: e.color,
                      members: e.members,
                    }))}
                    size="grand"
                    tone="card"
                  />
                  {(card.rest.length > 0 || card.more) && (
                    <ol className={styles.rest} start={4} aria-label={m.game.restOfScoreboard}>
                      {card.rest.map((e) => (
                        <li key={`${e.place}-${e.name}`}>
                          <span className={styles.pos}>{e.place}</span>
                          <span className={styles.who}>
                            <TeamDot color={e.color} size={16} /> {e.name}
                          </span>
                          <span className={styles.pts}>{e.score}</span>
                        </li>
                      ))}
                      {card.more && <li className={styles.more}>{card.more}</li>}
                    </ol>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className={styles.cta}>
            <h2 className={styles.ctaTitle}>{t.ctaTitle}</h2>
            <p className={styles.ctaLede}>{t.ctaLede}</p>
            <div className={styles.actions}>
              <Link href="/" className={`${ui.btn} ${ui.primary} ${ui.big}`}>
                {t.ctaPlay}
              </Link>
              <Link href="/join" className={`${ui.btn} ${ui.onShell} ${ui.big}`}>
                {t.ctaJoin}
              </Link>
            </div>
            <MadeBy />
          </section>
        </div>
      </main>
    </>
  );
}
