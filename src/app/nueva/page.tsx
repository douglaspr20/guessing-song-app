"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Heart, Minus, Plus, Shuffle } from "lucide-react";
import { Stepper } from "@/components/Stepper";
import { BandStatus } from "@/components/band/BandStatus";
import ui from "@/components/ui.module.css";
import { api, type AccessStatus, type Catalog, type Game, type Playlist } from "@/lib/client/api";
import { DEFAULT_ANSWER_SECONDS, MAX_ANSWER_SECONDS, MIN_ANSWER_SECONDS, type GameMode } from "@/lib/game/filters";
import {
  DEFAULT_TEAM_SIZE,
  DEFAULT_TEAMS,
  emptyTeams,
  everyone,
  TEAM_COLORS,
  teamsProblem,
  type GameFormat,
  type TeamDraft,
} from "@/lib/game/teams";
import { formatList, plural } from "@/i18n/format";
import { useI18n } from "@/i18n/client";
import { TeamsEditor } from "./_components/TeamsEditor";
import styles from "./setup.module.css";

const MAX_PLAYERS = 20;
const LIKED_ID = "liked";

type Source = "search" | "playlists";

// useSearchParams (?editar=) necesita un límite de Suspense.
export default function NewGamePage() {
  return (
    <Suspense>
      <NewGame />
    </Suspense>
  );
}

function NewGame() {
  const router = useRouter();
  const { m, locale } = useI18n();
  const t = m.setup;
  /** Partida aún sin empezar que se está editando (desde «Editar ajustes» del juego). */
  const searchParams = useSearchParams();
  const editId = searchParams.get("editar");
  const ids = useId();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);

  const [players, setPlayers] = useState<string[]>(["", ""]);
  /** "solo": todos contra todos. "teams": cada equipo puntúa junto. */
  const [format, setFormat] = useState<GameFormat>("solo");
  const [teams, setTeams] = useState<TeamDraft[]>(() => emptyTeams(DEFAULT_TEAMS, t));
  const [maxTeamSize, setMaxTeamSize] = useState(DEFAULT_TEAM_SIZE);
  const [rounds, setRounds] = useState(10);
  /** Quien juega desde el móvil: segundos para responder tras pulsar y quién queda fuera al fallar. */
  const [answerSeconds, setAnswerSeconds] = useState(DEFAULT_ANSWER_SECONDS);
  const [lockout, setLockout] = useState<"person" | "team">("person");
  const [fragmentSeconds, setFragmentSeconds] = useState(60);
  /** "spotify": canción completa (necesita cuenta). "open": vistas previas de 30 s, sin cuenta. */
  const [mode, setMode] = useState<GameMode>(searchParams.get("modo") === "abierto" ? "open" : "spotify");
  const [connected, setConnected] = useState<boolean | null>(null);
  /** Con permiso de Spotify (invitación o anfitrión) se ofrece el modo; sin él, ni aparece. */
  const [canLink, setCanLink] = useState(false);
  const [source, setSource] = useState<Source>("search");
  const [genres, setGenres] = useState<string[]>([]);
  const [language, setLanguage] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [keywords, setKeywords] = useState("");
  const [playlistIds, setPlaylistIds] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState<string | null>(null);

  useEffect(() => {
    api<AccessStatus>("/api/access/status").then(
      (a) => {
        setConnected(!!a.spotify);
        setCanLink(!!a.user?.spotifyAllowed);
        // Sin Spotify solo se puede jugar en modo abierto.
        if (!a.spotify) return setMode("open");
        api<{ playlists: Playlist[] }>("/api/spotify/playlists").then(
          (d) => setPlaylists(d.playlists),
          () => setPlaylists([]),
        );
      },
      () => {
        setConnected(false);
        setMode("open");
      },
    );
    api<Catalog>("/api/spotify/genres").then(setCatalog);
  }, []);

  // Editar: rellena el formulario con los ajustes de la partida sin empezar.
  useEffect(() => {
    if (!editId) return;
    api<Game>(`/api/games/${editId}`).then(
      (g) => {
        if (g.currentRound > 0) return router.replace(`/partida/${g.id}`); // ya empezó: no se edita
        if (g.format === "teams") {
          // Equipos en el orden de la paleta (el de creación).
          const order = (c: string | null) => TEAM_COLORS.findIndex((t) => t.key === c);
          setFormat("teams");
          setMaxTeamSize(g.maxTeamSize ?? DEFAULT_TEAM_SIZE);
          setTeams(
            [...g.players]
              .sort((a, b) => order(a.color) - order(b.color))
              .map((p) => ({ name: p.name, color: p.color as TeamDraft["color"], members: p.members })),
          );
        } else {
          setPlayers(g.players.map((p) => p.name));
        }
        setRounds(g.totalRounds);
        setAnswerSeconds(g.answerSeconds);
        setLockout(g.lockout);
        setFragmentSeconds(g.fragmentSeconds);
        setMode(g.mode);
        setSource(g.filters.source);
        setGenres(g.filters.genres ?? []);
        setLanguage(g.filters.language ?? "");
        setYearFrom(g.filters.yearFrom ? String(g.filters.yearFrom) : "");
        setYearTo(g.filters.yearTo ? String(g.filters.yearTo) : "");
        setKeywords(g.filters.keywords ?? "");
        setPlaylistIds(g.filters.playlistIds ?? []);
      },
      () => router.replace("/nueva"),
    );
  }, [editId, router]);

  const names = players.map((p) => p.trim()).filter(Boolean);
  const duplicates = useMemo(() => {
    const seen = new Set<string>();
    const dups = new Set<string>();
    for (const n of names) {
      const k = n.toLowerCase();
      if (seen.has(k)) dups.add(n);
      seen.add(k);
    }
    return [...dups];
  }, [names]);

  const open = mode === "open";
  // El modo abierto solo tiene búsqueda (no hay playlists sin cuenta).
  const effectiveSource: Source = open ? "search" : source;

  // Solo cuentan las playlists que Spotify deja leer (una partida editada puede traer alguna ajena).
  const usableIds = playlistIds.filter((id) => !playlists || playlists.find((p) => p.id === id)?.readable);

  const filters = () => ({
    source: effectiveSource,
    genres: effectiveSource === "search" ? genres : [],
    language: effectiveSource === "search" && language ? language : undefined,
    yearFrom: effectiveSource === "search" && yearFrom ? Number(yearFrom) : undefined,
    yearTo: effectiveSource === "search" && yearTo ? Number(yearTo) : undefined,
    keywords: effectiveSource === "search" && keywords.trim() ? keywords.trim() : undefined,
    playlistIds: effectiveSource === "playlists" ? usableIds : [],
  });

  const yearsInvalid = !!yearFrom && !!yearTo && Number(yearFrom) > Number(yearTo);
  const byTeams = format === "teams";
  const people = byTeams ? everyone(teams).length : names.length;
  const whoProblem = byTeams
    ? teamsProblem(teams, maxTeamSize, t)
    : names.length === 0
      ? t.needOnePlayer
      : duplicates.length
        ? t.repeatedNames
        : null;
  const blocker =
    whoProblem ??
    (effectiveSource === "playlists" && usableIds.length === 0
      ? t.needPlaylist
      : yearsInvalid
        ? t.yearsInverted
        : null);

  const setPlayer = (i: number, v: string) => setPlayers((ps) => ps.map((p, j) => (j === i ? v : p)));
  const addPlayer = () => setPlayers((ps) => (ps.length < MAX_PLAYERS ? [...ps, ""] : ps));
  const removePlayer = (i: number) => setPlayers((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : [""]));
  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const start = async () => {
    if (blocker) return;
    setBusy(true);
    setError(null);
    try {
      const game = await api<Game>("/api/games", {
        json: {
          mode,
          format,
          ...(byTeams
            ? { teams: teams.map((t) => ({ ...t, name: t.name.trim() })), maxTeamSize }
            : { players: names }),
          rounds,
          fragmentSeconds,
          answerSeconds,
          lockout,
          filters: filters(),
        },
      });
      // Al editar se graba un casete nuevo y se tira el anterior (aún no tenía pistas).
      if (editId) await api(`/api/games/${editId}`, { method: "DELETE" }).catch(() => {});
      router.push(`/partida/${game.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      // Next conserva esta página al navegar: sin esto el botón se quedaría bloqueado al volver.
      setBusy(false);
      setSample(null);
    }
  };

  const tryFilters = async () => {
    setBusy(true);
    setError(null);
    setSample(null);
    try {
      const r = await api<{ track: { name: string; artists: string[] } }>("/api/spotify/sample", {
        json: { mode, filters: filters(), fragmentSeconds },
      });
      setSample(`${r.track.name} — ${r.track.artists.join(", ")}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const needsReconnect = playlists?.some((p) => p.needsReconnect);

  return (
    <>
      <BandStatus text={editId ? t.bandEditing : t.bandNew} />
      <main className={styles.main}>
        <Link href="/" className={styles.back}>
          <ArrowLeft size={22} aria-hidden />
          {m.common.backToShelf}
        </Link>
        <h1 className={styles.title}>{editId ? t.titleEditing : t.titleNew}</h1>

        <div className={styles.grid}>
          {/* ---------- Quién juega ---------- */}
          <section className={ui.card} aria-labelledby={`${ids}-players`}>
            <div className={ui.cardStripes} />
            <div className={styles.panel}>
              <div className={styles.section}>
                <div className={styles.sectionHead}>
                  <h2 className={styles.h} id={`${ids}-players`}>
                    {t.whoPlays}
                  </h2>
                  <span className={styles.hint}>
                    {byTeams
                      ? `${t.teamsCount(teams.length)} · ${plural(locale, people, t.people)}`
                      : plural(locale, names.length, t.players)}
                  </span>
                </div>
                <div className={`${styles.segment} ${styles.formatSwitch}`} role="group" aria-label={t.format}>
                  <button type="button" aria-pressed={!byTeams} onClick={() => setFormat("solo")}>
                    {t.solo}
                  </button>
                  <button type="button" aria-pressed={byTeams} onClick={() => setFormat("teams")}>
                    {t.byTeams}
                  </button>
                </div>
                {byTeams && <TeamsEditor teams={teams} maxSize={maxTeamSize} onTeams={setTeams} onMaxSize={setMaxTeamSize} />}
                {!byTeams && (
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
                {duplicates.length > 0 && (
                  <p className={`${ui.notice} ${ui.noticeErrorOnCard} ${styles.dup}`} role="alert">
                    <AlertTriangle size={20} aria-hidden />
                    {t.repeatedPlayers(formatList(locale, duplicates))}
                  </p>
                )}
                </>
                )}
              </div>
            </div>
          </section>

          {/* ---------- Cómo suena ---------- */}
          <section className={ui.card} aria-labelledby={`${ids}-sound`}>
            <div className={ui.cardStripes} />
            <div className={styles.panel}>
              <div className={styles.section}>
                <div className={styles.sectionHead}>
                  <h2 className={styles.h} id={`${ids}-sound`}>
                    {t.howToPlay}
                  </h2>
                </div>
                {/* Un invitado solo juega con vistas previas: ni siquiera ve la opción de Spotify. */}
                {canLink && (
                  <div className={styles.segment} role="group" aria-label={t.gameMode}>
                    <button type="button" aria-pressed={!open} onClick={() => setMode("spotify")} disabled={connected === false}>
                      {t.spotifyMode}
                    </button>
                    <button type="button" aria-pressed={open} onClick={() => setMode("open")}>
                      {t.openMode}
                    </button>
                  </div>
                )}
                <p className={styles.hint} style={{ margin: "10px 0 18px" }}>
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
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>{t.rounds}</span>
                    <Stepper label={t.rounds} value={rounds} min={1} max={50} onChange={setRounds} />
                  </div>
                  {!open && (
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>{t.fragment}</span>
                      <Stepper
                        label={t.fragmentSeconds}
                        value={fragmentSeconds}
                        min={60}
                        max={180}
                        step={10}
                        unit="s"
                        onChange={setFragmentSeconds}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionHead}>
                  <h2 className={styles.h}>{t.fromPhone}</h2>
                </div>
                <p className={styles.hint} style={{ marginBottom: 18 }}>
                  {t.fromPhoneHint}
                </p>
                <div className={styles.settingsRow}>
                  <div className={styles.field}>
                    <span className={styles.fieldLabel}>{t.answerTime}</span>
                    <Stepper
                      label={t.answerSeconds}
                      value={answerSeconds}
                      min={MIN_ANSWER_SECONDS}
                      max={MAX_ANSWER_SECONDS}
                      step={5}
                      unit="s"
                      onChange={setAnswerSeconds}
                    />
                  </div>
                  {byTeams && (
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>{t.lockout}</span>
                      <div className={`${styles.segment} ${styles.formatSwitch}`} role="group" aria-label={t.lockoutGroup}>
                        <button type="button" aria-pressed={lockout === "person"} onClick={() => setLockout("person")}>
                          {t.lockoutPerson}
                        </button>
                        <button type="button" aria-pressed={lockout === "team"} onClick={() => setLockout("team")}>
                          {t.lockoutTeam}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!open && (
                <div className={styles.section}>
                  <div className={styles.sectionHead}>
                    <h2 className={styles.h}>{t.songSource}</h2>
                  </div>
                  <div className={styles.segment} role="group" aria-label={t.songSourceGroup}>
                    <button type="button" aria-pressed={source === "search"} onClick={() => setSource("search")}>
                      {t.searchSource}
                    </button>
                    <button type="button" aria-pressed={source === "playlists"} onClick={() => setSource("playlists")}>
                      {t.playlistSource}
                    </button>
                  </div>
                </div>
              )}

              {effectiveSource === "search" ? (
                <>
                  <div className={styles.section}>
                    <div className={styles.sectionHead}>
                      <h3 className={styles.fieldLabel}>{t.genres}</h3>
                      <span className={styles.hint}>
                        {genres.length ? t.genresChosen(genres.length) : t.anyGenre}
                      </span>
                    </div>
                    <div className={styles.chips}>
                      {catalog?.genres.map((g) => (
                        <button
                          key={g}
                          type="button"
                          className={styles.chip}
                          aria-pressed={genres.includes(g)}
                          onClick={() => toggle(genres, setGenres, g)}
                          disabled={!genres.includes(g) && genres.length >= 10}
                        >
                          {genres.includes(g) && <Check size={16} strokeWidth={3} aria-hidden />}
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.section}>
                    <div className={styles.inline}>
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>{t.language}</span>
                        <select className={styles.select} value={language} onChange={(e) => setLanguage(e.target.value)}>
                          <option value="">{t.anyLanguage}</option>
                          {catalog?.languages.map((l) => (
                            <option key={l.id} value={l.id}>
                              {t.musicLanguages[l.id] ?? l.id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>{t.from}</span>
                        <input
                          className={`${styles.textInput} ${styles.year}`}
                          inputMode="numeric"
                          placeholder="1980"
                          value={yearFrom}
                          onChange={(e) => setYearFrom(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>{t.to}</span>
                        <input
                          className={`${styles.textInput} ${styles.year}`}
                          inputMode="numeric"
                          placeholder="1999"
                          value={yearTo}
                          onChange={(e) => setYearTo(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        />
                      </label>
                    </div>
                    <label className={styles.field} style={{ marginTop: 18 }}>
                      <span className={styles.fieldLabel}>{t.keyword}</span>
                      <input
                        className={styles.textInput}
                        placeholder={t.keywordPlaceholder}
                        value={keywords}
                        maxLength={100}
                        onChange={(e) => setKeywords(e.target.value)}
                      />
                    </label>
                    <p className={styles.hint} style={{ marginTop: 10 }}>
                      {t.languageHint}
                    </p>
                  </div>
                </>
              ) : (
                <div className={styles.section}>
                  <div className={styles.sectionHead}>
                    <h3 className={styles.fieldLabel}>{t.playlists}</h3>
                    <span className={styles.hint}>{t.playlistsChosen(usableIds.length)}</span>
                  </div>
                  {!playlists && <p className={styles.hint}>{t.loadingPlaylists}</p>}
                  <div className={styles.chips}>
                    {playlists?.filter((p) => p.readable).map((p) => (
                      <PlaylistChip key={p.id} p={p} on={playlistIds.includes(p.id)} onToggle={() => toggle(playlistIds, setPlaylistIds, p.id)} />
                    ))}
                  </div>
                  {!!playlists?.some((p) => !p.readable) && (
                    <>
                      <h3 className={styles.fieldLabel} style={{ marginTop: 20 }}>
                        {t.othersPlaylists}
                      </h3>
                      <p className={styles.hint} style={{ margin: "4px 0 10px" }}>
                        {t.othersPlaylistsHint}
                      </p>
                      <div className={styles.chips}>
                        {playlists
                          .filter((p) => !p.readable)
                          .map((p) => (
                            <PlaylistChip key={p.id} p={p} on={playlistIds.includes(p.id)} onToggle={() => toggle(playlistIds, setPlaylistIds, p.id)} />
                          ))}
                      </div>
                    </>
                  )}
                  {needsReconnect && (
                    <p className={`${styles.hint} ${styles.reconnect}`}>
                      {t.reconnectBefore} <a href="/api/auth/login">{t.reconnectLink}</a>.
                    </p>
                  )}
                </div>
              )}

              {sample && (
                <p className={styles.sample}>
                  {t.sampleBefore} <strong>{sample}</strong>
                </p>
              )}
            </div>
          </section>
        </div>
      </main>

      <div className={styles.dock}>
        <div className={styles.dockInner}>
          <div>
            <div className={styles.summary}>
              {byTeams
                ? `${t.teamsCount(teams.length)} · ${people ? plural(locale, people, t.people) : t.noPeople}`
                : names.length
                  ? plural(locale, names.length, t.players)
                  : t.noPlayers}{" "}
              · {plural(locale, rounds, t.roundsCount)} · {t.perSong(open ? 30 : fragmentSeconds)}
            </div>
            {(blocker || error) && (
              <div className={styles.why} role="status">
                {error ?? blocker}
              </div>
            )}
          </div>
          <div className={styles.dockActions}>
            <button type="button" className={`${ui.btn} ${ui.onShell}`} onClick={tryFilters} disabled={busy || (effectiveSource === "playlists" && !usableIds.length)}>
              <Shuffle size={22} aria-hidden />
              {t.tryFilters}
            </button>
            <button type="button" className={`${ui.btn} ${ui.primary}`} onClick={start} disabled={busy || !!blocker}>
              {editId ? t.saveAndBack : t.recordAndStart}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function PlaylistChip({ p, on, onToggle }: { p: Playlist; on: boolean; onToggle: () => void }) {
  const { m } = useI18n();
  const t = m.setup;
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={on}
      disabled={p.needsReconnect || !p.readable}
      title={!p.readable ? t.othersPlaylistTitle : undefined}
      onClick={onToggle}
    >
      {p.id === LIKED_ID && <Heart size={16} strokeWidth={3} aria-hidden />}
      {on && p.id !== LIKED_ID && <Check size={16} strokeWidth={3} aria-hidden />}
      {p.id === LIKED_ID ? t.likedSongs : p.name || t.untitled}
      {p.totalTracks !== null && <span aria-label={t.songs(p.totalTracks)}>· {p.totalTracks}</span>}
      {!p.readable && p.owner && <span className={styles.owner}>{t.byOwner(p.owner)}</span>}
    </button>
  );
}
