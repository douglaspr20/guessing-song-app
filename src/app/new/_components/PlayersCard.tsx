"use client";

import { useId } from "react";
import { Minus, Plus } from "lucide-react";
import { Card } from "@/components/Card";
import { Chip, chipsClass } from "@/components/Chip";
import { Notice } from "@/components/Notice";
import { Segmented } from "@/components/Segmented";
import ui from "@/components/ui.module.css";
import { useI18n } from "@/i18n/client";
import { formatList, plural } from "@/i18n/format";
import { hostPlaysAs, peopleCount, playerNames, seatNames, type SetupForm } from "@/lib/game/setup";
import { repeated, type GameFormat } from "@/lib/game/teams";
import styles from "../setup.module.css";
import { TeamsEditor } from "./TeamsEditor";

const MAX_PLAYERS = 20;

/** «Quién juega»: todos contra todos (una lista de nombres) o por equipos (el editor de equipos). */
export function PlayersCard({ form, update }: { form: SetupForm; update: (patch: Partial<SetupForm>) => void }) {
  const { m, locale } = useI18n();
  const t = m.setup;
  const titleId = useId();
  const byTeams = form.format === "teams";
  return (
    <Card aria-labelledby={titleId}>
      <div className={styles.panel}>
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h} id={titleId}>
              {t.whoPlays}
            </h2>
            <span className={styles.hint}>
              {byTeams
                ? `${t.teamsCount(form.teams.length)} · ${plural(locale, peopleCount(form), t.people)}`
                : plural(locale, playerNames(form).length, t.players)}
            </span>
          </div>
          <Segmented<GameFormat>
            fill
            className={styles.formatSwitch}
            label={t.format}
            value={form.format}
            onChange={(format) => update({ format })}
            options={[
              { value: "solo", label: t.solo },
              { value: "teams", label: t.byTeams },
            ]}
          />
          {byTeams ? (
            <TeamsEditor
              teams={form.teams}
              maxSize={form.maxTeamSize}
              onTeams={(teams) => update({ teams })}
              onMaxSize={(maxTeamSize) => update({ maxTeamSize })}
            />
          ) : (
            <SoloPlayersList players={form.players} onPlayers={(players) => update({ players })} />
          )}
        </div>
        <HostPlays form={form} update={update} />
      </div>
    </Card>
  );
}

/** «Yo también juego»: el anfitrión elige con cuál de los nombres juega desde su propia pantalla. */
function HostPlays({ form, update }: { form: SetupForm; update: (patch: Partial<SetupForm>) => void }) {
  const { m } = useI18n();
  const t = m.setup;
  const names = seatNames(form);
  const chosen = hostPlaysAs(form);
  return (
    <div className={styles.section}>
      <label className={styles.toggle}>
        <input type="checkbox" checked={form.hostPlays} onChange={(e) => update({ hostPlays: e.target.checked })} />
        {t.hostPlays}
      </label>
      <p className={styles.toggleHelp}>{t.hostPlaysHelp}</p>
      {form.hostPlays && names.length > 0 && (
        <div className={`${chipsClass} ${styles.hostNames}`} role="group" aria-label={t.hostPlaysAs}>
          {names.map((name) => (
            <Chip key={name} hand pressed={name === chosen} onClick={() => update({ hostName: name })}>
              {name}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

/** Lista de nombres numerada: Enter en el último añade otro; el botón «−» lo quita. */
function SoloPlayersList({ players, onPlayers }: { players: string[]; onPlayers: (players: string[]) => void }) {
  const { m, locale } = useI18n();
  const t = m.setup;
  const duplicates = repeated(players.map((p) => p.trim()).filter(Boolean));
  const setPlayer = (i: number, v: string) => onPlayers(players.map((p, j) => (j === i ? v : p)));
  const addPlayer = () => onPlayers(players.length < MAX_PLAYERS ? [...players, ""] : players);
  const removePlayer = (i: number) => onPlayers(players.length > 1 ? players.filter((_, j) => j !== i) : [""]);

  return (
    <>
      <ol className={styles.players}>
        {players.map((p, i) => (
          <li key={i} className={styles.playerRow}>
            <span className={styles.playerNum}>{i + 1}</span>
            <input
              className={styles.handInput}
              value={p}
              onChange={(e) => setPlayer(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && i === players.length - 1 && p.trim()) addPlayer();
              }}
              placeholder={t.playerPlaceholder(i + 1)}
              maxLength={30}
              aria-label={t.player(i + 1)}
              autoFocus={i === players.length - 1 && i > 1}
            />
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => removePlayer(i)}
              aria-label={t.removePlayer(i + 1)}
              disabled={players.length === 1 && !p}
            >
              <Minus size={26} strokeWidth={3} aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className={`${ui.btn} ${ui.onCard} ${styles.addRow}`}
        onClick={addPlayer}
        disabled={players.length >= MAX_PLAYERS}
      >
        <Plus size={24} strokeWidth={3} aria-hidden />
        {t.addPlayer}
      </button>
      {duplicates.length > 0 && <Notice className={styles.dup}>{t.repeatedPlayers(formatList(locale, duplicates))}</Notice>}
    </>
  );
}
