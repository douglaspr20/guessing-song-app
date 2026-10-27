"use client";

import type { CSSProperties } from "react";
import { Minus } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { teamColor, type TeamDraft } from "@/lib/game/teams";
import setup from "../setup.module.css";
import styles from "./teams.module.css";

/** Un equipo: su color, su nombre (editable), cuántos lleva y cada persona con «cambiar de equipo» y «quitar». */
export function TeamCard({
  team,
  index,
  teams,
  maxSize,
  onRename,
  onMove,
  onRemove,
}: {
  team: TeamDraft;
  index: number;
  /** Todos los equipos, para el desplegable de «cambiar de equipo». */
  teams: TeamDraft[];
  maxSize: number;
  onRename: (name: string) => void;
  onMove: (member: string, to: number) => void;
  onRemove: (member: string) => void;
}) {
  const { m } = useI18n();
  const s = m.setup;
  return (
    <li className={styles.team} style={{ "--team": teamColor(team.color)?.hex } as CSSProperties}>
      <div className={styles.teamHead}>
        <span className={styles.swatch} aria-hidden />
        <input
          className={`${setup.handInput} ${styles.teamName}`}
          value={team.name}
          onChange={(e) => onRename(e.target.value)}
          maxLength={30}
          aria-label={s.teamNameLabel(index + 1, s.teamColors[team.color])}
        />
        <span className={styles.count} aria-label={s.teamCount(team.members.length, maxSize)}>
          {team.members.length}/{maxSize}
        </span>
      </div>
      {team.members.length === 0 ? (
        <p className={styles.nobody}>{s.nobodyYet}</p>
      ) : (
        <ul className={styles.members}>
          {team.members.map((member, k) => (
            <li key={`${member}-${k}`} className={styles.member}>
              <span className={styles.memberName}>{member}</span>
              <select
                className={styles.move}
                value={index}
                onChange={(e) => onMove(member, Number(e.target.value))}
                aria-label={s.teamOf(member)}
              >
                {teams.map((other, j) => (
                  <option key={other.color} value={j} disabled={j !== index && other.members.length >= maxSize}>
                    {other.name}
                  </option>
                ))}
              </select>
              <button type="button" className={styles.removeBtn} onClick={() => onRemove(member)} aria-label={s.removePerson(member)}>
                <Minus size={22} strokeWidth={3} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
