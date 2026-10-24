"use client";

import { useState } from "react";
import { AlertTriangle, Minus, Plus, Shuffle } from "lucide-react";
import { Stepper } from "@/components/Stepper";
import ui from "@/components/ui.module.css";
import {
  distribute,
  emptiestTeam,
  everyone,
  fillIn,
  fits,
  MAX_TEAM_SIZE,
  MAX_TEAMS,
  MIN_TEAM_SIZE,
  MIN_TEAMS,
  moveMember,
  overfull,
  repeated,
  resizeTeams,
  teamColor,
  type TeamDraft,
} from "@/lib/game/teams";
import setup from "../setup.module.css";
import styles from "./teams.module.css";

interface Props {
  teams: TeamDraft[];
  maxSize: number;
  onTeams: (teams: TeamDraft[]) => void;
  onMaxSize: (n: number) => void;
}

/** Quién juega en una partida por equipos: cuántos equipos, cuántas personas caben y a quién le toca cuál. */
export function TeamsEditor({ teams, maxSize, onTeams, onMaxSize }: Props) {
  const [name, setName] = useState("");
  const [full, setFull] = useState(false);

  const people = everyone(teams);
  const tooMany = overfull(teams, maxSize);
  const dups = repeated(people);
  const capacity = teams.length * maxSize;

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const next = fillIn(teams, n, maxSize);
    setFull(!next);
    if (!next) return;
    onTeams(next);
    setName("");
  };

  const rename = (i: number, value: string) => onTeams(teams.map((t, j) => (j === i ? { ...t, name: value } : t)));
  const remove = (i: number, member: string) =>
    onTeams(teams.map((t, j) => (j === i ? { ...t, members: t.members.filter((m) => m !== member) } : t)));
  const move = (from: number, member: string, to: number) => {
    const next = moveMember(teams, from, member, to, maxSize);
    if (next) onTeams(next);
  };

  const canShuffle = people.length > 1 && fits(people.length, teams.length, maxSize);

  return (
    <div className={styles.editor}>
      <div className={setup.settingsRow}>
        <div className={setup.field}>
          <span className={setup.fieldLabel}>Equipos</span>
          <Stepper
            label="Equipos"
            value={teams.length}
            min={MIN_TEAMS}
            max={MAX_TEAMS}
            onChange={(n) => onTeams(resizeTeams(teams, n, maxSize))}
          />
        </div>
        <div className={setup.field}>
          <span className={setup.fieldLabel}>Máximo por equipo</span>
          <Stepper label="Máximo por equipo" value={maxSize} min={MIN_TEAM_SIZE} max={MAX_TEAM_SIZE} onChange={onMaxSize} />
        </div>
      </div>
      <p className={setup.hint}>
        Caben {capacity} personas. Un equipo puede quedarse con menos gente que otro.
      </p>

      <div className={styles.addRow}>
        <input
          className={setup.handInput}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setFull(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Nombre de una persona"
          maxLength={30}
          aria-label="Nombre de una persona"
        />
        <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={add} disabled={!name.trim()}>
          <Plus size={24} strokeWidth={3} aria-hidden />
          Añadir persona
        </button>
        <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={() => onTeams(distribute(people, teams, maxSize))} disabled={!canShuffle}>
          <Shuffle size={22} aria-hidden />
          Repartir al azar
        </button>
      </div>
      <p className={styles.addHint}>Entra en el equipo con menos gente. Después puedes cambiarla de equipo.</p>

      {full && emptiestTeam(teams, maxSize) === -1 && (
        <Notice>Todos los equipos están llenos: sube el máximo o añade otro equipo.</Notice>
      )}
      {tooMany.map((t) => (
        <Notice key={t.color}>
          {t.name} tiene {t.members.length} y el máximo es {maxSize}. Pasa a alguien a otro equipo.
        </Notice>
      ))}
      {people.length > capacity && <Notice>Hay {people.length} personas y solo caben {capacity}.</Notice>}
      {dups.length > 0 && <Notice>Repetido: {dups.join(", ")}. Cada persona necesita un nombre distinto.</Notice>}

      <ul className={styles.teams}>
        {teams.map((t, i) => (
          <li key={t.color} className={styles.team} style={{ ["--team" as string]: teamColor(t.color)?.hex }}>
            <div className={styles.teamHead}>
              <span className={styles.swatch} aria-hidden />
              <input
                className={`${setup.handInput} ${styles.teamName}`}
                value={t.name}
                onChange={(e) => rename(i, e.target.value)}
                maxLength={30}
                aria-label={`Nombre del equipo ${i + 1} (${teamColor(t.color)?.label})`}
              />
              <span className={styles.count} aria-label={`${t.members.length} de ${maxSize}`}>
                {t.members.length}/{maxSize}
              </span>
            </div>
            {t.members.length === 0 ? (
              <p className={styles.nobody}>Aún sin nadie</p>
            ) : (
              <ul className={styles.members}>
                {t.members.map((m, k) => (
                  <li key={`${m}-${k}`} className={styles.member}>
                    <span className={styles.memberName}>{m}</span>
                    <select
                      className={styles.move}
                      value={i}
                      onChange={(e) => move(i, m, Number(e.target.value))}
                      aria-label={`Equipo de ${m}`}
                    >
                      {teams.map((other, j) => (
                        <option key={other.color} value={j} disabled={j !== i && other.members.length >= maxSize}>
                          {other.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => remove(i, m)}
                      aria-label={`Quitar a ${m}`}
                    >
                      <Minus size={22} strokeWidth={3} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className={`${ui.notice} ${ui.noticeErrorOnCard} ${styles.notice}`} role="alert">
      <AlertTriangle size={20} aria-hidden />
      {children}
    </p>
  );
}
