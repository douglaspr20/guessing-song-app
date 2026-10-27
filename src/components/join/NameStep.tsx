"use client";

import type { FormEvent } from "react";
import { LogIn } from "lucide-react";
import { Chip, chipsClass } from "@/components/Chip";
import { Field } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { TeamDot } from "@/components/TeamDot";
import form from "@/components/styles/form.module.css";
import access from "@/components/access.module.css";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import { plural } from "@/i18n/format";
import { memberLine } from "@/lib/game/teams";
import styles from "./JoinFlow.module.css";

/** Lo que devuelve /api/join/lookup: la partida, si admite gente y, por equipos, cómo van. */
export interface Lookup {
  code: string;
  format: "solo" | "teams";
  joinOpen: boolean;
  full: boolean;
  maxTeamSize: number | null;
  teams: { id: string; name: string; color: string | null; members: string[]; free: number }[];
  /** Nombres que el anfitrión ya apuntó y nadie ha reclamado. */
  pending: string[];
}

/** Segundo paso: el nombre (o la cuenta), si eres uno de los apuntados y, por equipos, el equipo. */
export function NameStep({
  titleId,
  found,
  user,
  name,
  onName,
  teamId,
  onTeam,
  claims,
  ready,
  busy,
  error,
  onChangeCode,
  onSubmit,
}: {
  titleId: string;
  found: Lookup;
  user: { displayName: string } | null;
  name: string;
  onName: (value: string) => void;
  teamId: string;
  onTeam: (id: string) => void;
  /** El nombre ya estaba apuntado por el anfitrión: entra directo en su equipo. */
  claims: boolean;
  ready: boolean;
  busy: boolean;
  error: string | null;
  onChangeCode: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const { m } = useI18n();
  const j = m.join;
  const teams = found.format === "teams";
  return (
    <form className={access.body} onSubmit={onSubmit}>
      <div>
        <h1 className={access.title} id={titleId}>
          {teams ? j.whichTeam : j.whatsYourName}
        </h1>
        <p className={access.lede}>
          {j.game} <strong className={styles.codeTag}>{found.code}</strong>
          {" · "}
          <button type="button" className={styles.again} onClick={onChangeCode}>
            {j.changeCode}
          </button>
        </p>
      </div>

      {!found.joinOpen && <Notice>{j.closed}</Notice>}
      {found.joinOpen && found.full && <Notice>{j.full}</Notice>}

      {user ? (
        <p className={styles.asUser}>
          {j.asUserBefore} <strong>{user.displayName}</strong>
          {j.asUserAfter}
        </p>
      ) : (
        <Field label={j.yourName}>
          <input
            className={form.input}
            value={name}
            onChange={(e) => onName(e.target.value)}
            maxLength={30}
            autoComplete="nickname"
            autoFocus
            placeholder={j.namePlaceholder}
          />
        </Field>
      )}

      {!user && found.pending.length > 0 && (
        <div className={styles.pending}>
          <span className={form.label}>{j.areYouOne}</span>
          <div className={chipsClass}>
            {found.pending.map((p) => (
              <Chip key={p} hand pressed={name.trim().toLowerCase() === p.toLowerCase()} onClick={() => onName(p)}>
                {p}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {teams && !claims && <TeamPicker teams={found.teams} teamId={teamId} onTeam={onTeam} />}
      {teams && claims && <p className={styles.asUser}>{j.alreadyListed}</p>}

      {error && <Notice>{error}</Notice>}
      <div className={`${form.actions} ${styles.stickyActions}`}>
        <button
          type="submit"
          className={`${ui.btn} ${ui.primary} ${ui.big}`}
          disabled={busy || !ready || !found.joinOpen || found.full}
        >
          <LogIn size={24} aria-hidden />
          {busy ? j.entering : j.enter}
        </button>
      </div>
    </form>
  );
}

/** Los equipos con hueco, como opciones grandes con su color, quién está y cuántos caben. */
function TeamPicker({ teams, teamId, onTeam }: { teams: Lookup["teams"]; teamId: string; onTeam: (id: string) => void }) {
  const { m, locale } = useI18n();
  const j = m.join;
  return (
    <fieldset className={styles.teams}>
      <legend className={form.label}>{j.yourTeam}</legend>
      {teams.map((t) => (
        <label key={t.id} className={styles.team} data-full={t.free === 0}>
          <input
            type="radio"
            name="team"
            value={t.id}
            checked={teamId === t.id}
            disabled={t.free === 0}
            onChange={() => onTeam(t.id)}
          />
          <span className={styles.teamBody}>
            <span className={styles.teamName}>
              <TeamDot color={t.color} size={16} />
              {t.name}
            </span>
            <span className={styles.teamMembers}>
              {t.members.length ? memberLine(t.members, 4) : j.nobodyYet}
              {" · "}
              {t.free === 0 ? j.teamFull : plural(locale, t.free, j.spotsLeft)}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
