"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Player } from "@/lib/client/api";
import { useI18n } from "@/i18n/client";
import { memberLine } from "@/lib/game/teams";
import { TeamDot } from "./TeamDot";
import ui from "./ui.module.css";
import styles from "./Scoreboard.module.css";

/**
 * Marcador escrito en la carátula, de más a menos puntos. Cuando cambia el orden,
 * las filas se deslizan a su nuevo puesto (FLIP) en vez de saltar.
 */
export function Scoreboard({
  players,
  title,
  gains = {},
  rankAmong,
}: {
  players: Player[];
  title: string;
  /** Lista completa para calcular puestos cuando solo se muestra una parte. */
  rankAmong?: Player[];
  /** Puntos recién ganados por jugador, para marcar la fila. */
  gains?: Record<string, number>;
}) {
  const { m } = useI18n();
  const listRef = useRef<HTMLOListElement>(null);
  /** Equipos con la lista de miembros desplegada. */
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const prevTops = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const rows = [...list.querySelectorAll<HTMLElement>("[data-id]")];
    for (const row of rows) {
      const id = row.dataset.id!;
      const top = row.offsetTop;
      const before = prevTops.current.get(id);
      if (before !== undefined && before !== top) {
        row.style.transition = "none";
        row.style.transform = `translateY(${before - top}px)`;
        requestAnimationFrame(() => {
          row.style.transition = "";
          row.style.transform = "";
        });
      }
      prevTops.current.set(id, top);
    }
  }, [players]);

  return (
    <section className={`${ui.card} ${styles.board}`} aria-label={m.common.scoreboard}>
      <div className={ui.cardStripes} />
      <div className={styles.head}>
        <h2 className={ui.cardTitle}>{title}</h2>
      </div>
      <ol className={styles.list} ref={listRef}>
        {players.map((p) => {
          const all = rankAmong ?? players;
          const place = all.findIndex((q) => q.score === p.score) + 1;
          const gain = gains[p.id];
          return (
            <li key={p.id} data-id={p.id} className={`${styles.row} ${gain ? styles.bump : ""}`}>
              <span className={styles.pos} aria-label={m.common.place(place)}>
                {place}
              </span>
              {p.members.length ? (
                <div className={styles.team}>
                  <button
                    type="button"
                    className={styles.teamToggle}
                    aria-expanded={open.has(p.id)}
                    aria-controls={`team-${p.id}`}
                    onClick={() => toggle(p.id)}
                  >
                    <TeamDot color={p.color} size={16} />
                    <span className={styles.name}>{p.name}</span>
                  </button>
                  {open.has(p.id) ? (
                    <ul className={styles.memberList} id={`team-${p.id}`}>
                      {p.members.map((m, i) => (
                        <li key={`${m}-${i}`}>{m}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className={styles.memberLine} id={`team-${p.id}`}>
                      {memberLine(p.members)}
                    </span>
                  )}
                </div>
              ) : (
                <span className={styles.name}>{p.name}</span>
              )}
              <span className={styles.pts}>
                {gain ? <span className={styles.gain}>+{gain}</span> : null}
                {p.score}
                <small>{m.common.pts}</small>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
