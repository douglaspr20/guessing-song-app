"use client";

import { Segmented } from "@/components/Segmented";
import { Stepper } from "@/components/Stepper";
import form from "@/components/styles/form.module.css";
import { useI18n } from "@/i18n/client";
import { MAX_ANSWER_SECONDS, MIN_ANSWER_SECONDS, type GameMode } from "@/lib/game/filters";
import type { SetupForm, SongSource } from "@/lib/game/setup";
import styles from "../setup.module.css";

type Props = { form: SetupForm; update: (patch: Partial<SetupForm>) => void };

/** «Cómo se juega»: modo (Spotify o 30 s), su explicación, rondas y largo del fragmento. */
export function PlaySettings({
  form: f,
  update,
  canLink,
  connected,
  titleId,
}: Props & {
  titleId: string;
  /** La cuenta puede usar Spotify (invitación o anfitrión): se ofrece elegir el modo. */
  canLink: boolean;
  connected: boolean | null;
}) {
  const { m } = useI18n();
  const t = m.setup;
  const open = f.mode === "open";
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.h} id={titleId}>
          {t.howToPlay}
        </h2>
      </div>
      {/* Un invitado solo juega con vistas previas: ni siquiera ve la opción de Spotify. */}
      {canLink && (
        <Segmented<GameMode>
          label={t.gameMode}
          value={f.mode}
          onChange={(mode) => update({ mode })}
          options={[
            { value: "spotify", label: t.spotifyMode, disabled: connected === false },
            { value: "open", label: t.openMode },
          ]}
        />
      )}
      <p className={`${styles.hint} ${styles.modeHint}`}>
        {open ? (
          <>
            {t.openHint}
            {connected === false && canLink && (
              <>
                {" "}
                {t.connectBefore} <a href="/api/auth/login">{t.connectLink}</a>.
              </>
            )}
          </>
        ) : (
          t.spotifyHint
        )}
      </p>
      <div className={styles.settingsRow}>
        <div className={form.field}>
          <span className={form.label}>{t.rounds}</span>
          <Stepper label={t.rounds} value={f.rounds} min={1} max={50} onChange={(rounds) => update({ rounds })} />
        </div>
        {!open && (
          <div className={form.field}>
            <span className={form.label}>{t.fragment}</span>
            <Stepper
              label={t.fragmentSeconds}
              value={f.fragmentSeconds}
              min={60}
              max={180}
              step={10}
              unit="s"
              onChange={(fragmentSeconds) => update({ fragmentSeconds })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** «Desde el móvil»: segundos para responder tras «¡Lo sé!» y, por equipos, quién queda fuera al fallar. */
export function PhoneSettings({ form: f, update }: Props) {
  const { m } = useI18n();
  const t = m.setup;
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.h}>{t.fromPhone}</h2>
      </div>
      <p className={`${styles.hint} ${styles.phoneHint}`}>{t.fromPhoneHint}</p>
      <div className={styles.settingsRow}>
        <div className={form.field}>
          <span className={form.label}>{t.answerTime}</span>
          <Stepper
            label={t.answerSeconds}
            value={f.answerSeconds}
            min={MIN_ANSWER_SECONDS}
            max={MAX_ANSWER_SECONDS}
            step={5}
            unit="s"
            onChange={(answerSeconds) => update({ answerSeconds })}
          />
        </div>
        {f.format === "teams" && (
          <div className={form.field}>
            <span className={form.label}>{t.lockout}</span>
            <Segmented<SetupForm["lockout"]>
              fill
              label={t.lockoutGroup}
              value={f.lockout}
              onChange={(lockout) => update({ lockout })}
              options={[
                { value: "person", label: t.lockoutPerson },
                { value: "team", label: t.lockoutTeam },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** «De dónde salen las canciones» (solo con Spotify): búsqueda general o mis playlists. */
export function SourceSettings({ form: f, update }: Props) {
  const { m } = useI18n();
  const t = m.setup;
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.h}>{t.songSource}</h2>
      </div>
      <Segmented<SongSource>
        label={t.songSourceGroup}
        value={f.source}
        onChange={(source) => update({ source })}
        options={[
          { value: "search", label: t.searchSource },
          { value: "playlists", label: t.playlistSource },
        ]}
      />
    </div>
  );
}
