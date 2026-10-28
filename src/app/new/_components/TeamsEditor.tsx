"use client";

import { useState } from "react";
import { Plus, Shuffle } from "lucide-react";
import { Notice } from "@/components/Notice";
import { Stepper } from "@/components/Stepper";
import form from "@/components/styles/form.module.css";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import { formatList } from "@/i18n/format";
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
  type TeamDraft,
} from "@/lib/game/teams";
import setup from "../setup.module.css";
import { TeamCard } from "./TeamCard";
import styles from "./teams.module.css";

interface Props {
  teams: TeamDraft[];
  maxSize: number;
  onTeams: (teams: TeamDraft[]) => void;
  onMaxSize: (n: number) => void;
}

/** Quién juega en una partida por equipos: cuántos equipos, cuántas personas caben y a quién le toca cuál. */
export function TeamsEditor({ teams, maxSize, onTeams, onMaxSize }: Props) {
  const { m, locale } = useI18n();
  const s = m.setup;
  const people = everyone(teams);
  const tooMany = overfull(teams, maxSize);
  const dups = repeated(people);
  const capacity = teams.length * maxSize;
  /** Se intentó añadir a alguien y no cabía en ningún equipo. */
  const [full, setFull] = useState(false);

  const updateTeam = (i: number, change: (t: TeamDraft) => TeamDraft) => onTeams(teams.map((t, j) => (j === i ? change(t) : t)));
  const move = (from: number, member: string, to: number) => {
    const next = moveMember(teams, from, member, to, maxSize);
    if (next) onTeams(next);
  };
  const add = (name: string) => {
    const next = fillIn(teams, name, maxSize);
    setFull(!next);
    if (next) onTeams(next);
    return !!next;
  };

  return (
    <div className={styles.editor}>
      <div className={setup.settingsRow}>
        <div className={form.field}>
          <span className={form.label}>{s.teams}</span>
          <Stepper
            label={s.teams}
            value={teams.length}
            min={MIN_TEAMS}
            max={MAX_TEAMS}
            onChange={(n) => onTeams(resizeTeams(teams, n, maxSize, s))}
          />
        </div>
        <div className={form.field}>
          <span className={form.label}>{s.maxPerTeam}</span>
          <Stepper label={s.maxPerTeam} value={maxSize} min={MIN_TEAM_SIZE} max={MAX_TEAM_SIZE} onChange={onMaxSize} />
        </div>
      </div>
      <p className={setup.hint}>{s.capacity(capacity)}</p>

      <AddPersonRow
        onAdd={add}
        onTyping={() => setFull(false)}
        canShuffle={people.length > 1 && fits(people.length, teams.length, maxSize)}
        onShuffle={() => onTeams(distribute(people, teams, maxSize))}
      />

      {full && emptiestTeam(teams, maxSize) === -1 && <Notice className={styles.notice}>{s.allFull}</Notice>}
      {tooMany.map((t) => (
        <Notice key={t.color} className={styles.notice}>
          {s.overfull(t.name, t.members.length, maxSize)}
        </Notice>
      ))}
      {people.length > capacity && <Notice className={styles.notice}>{s.tooManyPeople(people.length, capacity)}</Notice>}
      {dups.length > 0 && <Notice className={styles.notice}>{s.repeatedPeople(formatList(locale, dups))}</Notice>}

      <ul className={styles.teams}>
        {teams.map((t, i) => (
          <TeamCard
            key={t.color}
            team={t}
            index={i}
            teams={teams}
            maxSize={maxSize}
            onRename={(name) => updateTeam(i, (team) => ({ ...team, name }))}
            onMove={(member, to) => move(i, member, to)}
            onRemove={(member) => updateTeam(i, (team) => ({ ...team, members: team.members.filter((x) => x !== member) }))}
          />
        ))}
      </ul>
    </div>
  );
}

/** Escribir un nombre y añadirlo al equipo con menos gente (Enter también), o repartir a todos al azar. */
function AddPersonRow({
  onAdd,
  onTyping,
  canShuffle,
  onShuffle,
}: {
  /** Devuelve false si no cabía en ningún equipo (el nombre se queda escrito). */
  onAdd: (name: string) => boolean;
  onTyping: () => void;
  canShuffle: boolean;
  onShuffle: () => void;
}) {
  const { m } = useI18n();
  const s = m.setup;
  const [name, setName] = useState("");
  const add = () => {
    const n = name.trim();
    if (n && onAdd(n)) setName("");
  };
  return (
    <>
      <div className={styles.addRow}>
        <input
          className={setup.handInput}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            onTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={s.personName}
          maxLength={30}
          aria-label={s.personName}
        />
        <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={add} disabled={!name.trim()}>
          <Plus size={24} strokeWidth={3} aria-hidden />
          {s.addPerson}
        </button>
        <button type="button" className={`${ui.btn} ${ui.onCard}`} onClick={onShuffle} disabled={!canShuffle}>
          <Shuffle size={22} aria-hidden />
          {s.shuffle}
        </button>
      </div>
      <p className={styles.addHint}>{s.addHint}</p>
    </>
  );
}
