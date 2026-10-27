"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, LogIn } from "lucide-react";
import { BandStatus } from "@/components/band/BandStatus";
import { TeamDot } from "@/components/TeamDot";
import { RetryNotice } from "@/components/RetryNotice";
import ui from "@/components/ui.module.css";
import access from "@/components/access.module.css";
import { api, ApiError, type AccessStatus, errorText } from "@/lib/client/api";
import { memberLine } from "@/lib/game/teams";
import { plural } from "@/i18n/format";
import { useI18n } from "@/i18n/client";
import styles from "./JoinFlow.module.css";

interface Lookup {
  code: string;
  format: "solo" | "teams";
  joinOpen: boolean;
  full: boolean;
  maxTeamSize: number | null;
  teams: { id: string; name: string; color: string | null; members: string[]; free: number }[];
  pending: string[];
}

const clean = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

/**
 * Unirse a una partida con su código de 6 caracteres: primero el código, después el nombre (o el de
 * la cuenta, si hay sesión) y, por equipos, el equipo. Se abre desde /unirse o con el enlace /unirse/CÓDIGO.
 */
export function JoinFlow() {
  const router = useRouter();
  const { m, locale } = useI18n();
  const j = m.join;
  // En /unirse/ABC123 el código viene en la dirección; en /unirse se escribe a mano.
  const initialCode = useParams<{ code?: string }>().code ?? "";
  const ids = useId();
  const [code, setCode] = useState(clean(initialCode));
  const [found, setFound] = useState<Lookup | null>(null);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [user, setUser] = useState<{ displayName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** La API no respondió: se dice y se ofrece reintentar. */
  const [offline, setOffline] = useState(false);
  const autoLooked = useRef(false);

  useEffect(() => {
    api<AccessStatus>("/api/access/status").then(
      (a) => setUser(a.user ? { displayName: a.user.displayName } : null),
      () => {},
    );
  }, []);

  const lookup = async (value = code) => {
    setBusy(true);
    setError(null);
    setOffline(false);
    try {
      const r = await api<Lookup>("/api/join/lookup", { json: { code: value } });
      setFound(r);
      setCode(r.code);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setOffline(true);
    } finally {
      setBusy(false);
    }
  };

  // Con el enlace /unirse/ABC123 se comprueba el código sin que haya que pulsar nada.
  useEffect(() => {
    if (autoLooked.current || clean(initialCode).length !== 6) return;
    autoLooked.current = true;
    void lookup(clean(initialCode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    if (code.length === 6) void lookup();
  };

  const finalName = user ? user.displayName : name.trim();
  // En equipos solo hace falta elegir si el nombre no estaba ya apuntado por el anfitrión.
  const claims = !!found?.pending.some((p) => p.toLowerCase() === finalName.toLowerCase());
  const needsTeam = found?.format === "teams" && !claims;
  const ready = !!finalName && (!needsTeam || !!teamId);

  const submitJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!found || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ gameId: string }>("/api/join", {
        json: { code: found.code, name: user ? undefined : finalName, teamId: needsTeam ? teamId : undefined },
      });
      router.push(`/jugar/${r.gameId}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  const reset = () => {
    setFound(null);
    setTeamId("");
    setError(null);
  };

  return (
    <>
      <BandStatus text={j.band} />
      <main className={styles.main}>
        <section className={`${ui.card} ${styles.card}`} aria-labelledby={`${ids}-title`}>
          <div className={ui.cardStripes} />
          {!found ? (
            <form className={access.body} onSubmit={submitCode}>
              <div>
                <h1 className={access.title} id={`${ids}-title`}>
                  {j.title}
                </h1>
                <p className={access.lede}>{j.lede}</p>
              </div>
              <label className={access.field}>
                <span className={access.label}>{j.codeLabel}</span>
                <input
                  className={`${access.input} ${styles.code}`}
                  value={code}
                  onChange={(e) => {
                    setCode(clean(e.target.value));
                    setError(null);
                  }}
                  placeholder="· · · · · ·"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  aria-describedby={error ? `${ids}-err` : undefined}
                />
              </label>
              {error && <Problem id={`${ids}-err`}>{error}</Problem>}
              {offline && <RetryNotice message={j.cantCheck} onRetry={() => lookup()} />}
              <div className={access.actions}>
                <button type="submit" className={`${ui.btn} ${ui.primary} ${ui.big}`} disabled={busy || code.length !== 6}>
                  <ArrowRight size={24} aria-hidden />
                  {busy ? j.searching : j.continue}
                </button>
              </div>
            </form>
          ) : (
            <form className={access.body} onSubmit={submitJoin}>
              <div>
                <h1 className={access.title} id={`${ids}-title`}>
                  {found.format === "teams" ? j.whichTeam : j.whatsYourName}
                </h1>
                <p className={access.lede}>
                  {j.game} <strong className={styles.codeTag}>{found.code}</strong>
                  {" · "}
                  <button type="button" className={styles.again} onClick={reset}>
                    {j.changeCode}
                  </button>
                </p>
              </div>

              {!found.joinOpen && <Problem>{j.closed}</Problem>}
              {found.joinOpen && found.full && <Problem>{j.full}</Problem>}

              {user ? (
                <p className={styles.asUser}>
                  {j.asUserBefore} <strong>{user.displayName}</strong>
                  {j.asUserAfter}
                </p>
              ) : (
                <label className={access.field}>
                  <span className={access.label}>{j.yourName}</span>
                  <input
                    className={access.input}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError(null);
                    }}
                    maxLength={30}
                    autoComplete="nickname"
                    autoFocus
                    placeholder={j.namePlaceholder}
                  />
                </label>
              )}

              {!user && found.pending.length > 0 && (
                <div className={styles.pending}>
                  <span className={access.label}>{j.areYouOne}</span>
                  <div className={styles.chips}>
                    {found.pending.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={styles.chip}
                        aria-pressed={name.trim().toLowerCase() === p.toLowerCase()}
                        onClick={() => setName(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {found.format === "teams" && !claims && (
                <fieldset className={styles.teams}>
                  <legend className={access.label}>{j.yourTeam}</legend>
                  {found.teams.map((t) => (
                    <label key={t.id} className={styles.team} data-full={t.free === 0}>
                      <input
                        type="radio"
                        name="team"
                        value={t.id}
                        checked={teamId === t.id}
                        disabled={t.free === 0}
                        onChange={() => setTeamId(t.id)}
                      />
                      <span className={styles.teamBody}>
                        <span className={styles.teamName}>
                          <TeamDot color={t.color} size={16} />
                          {t.name}
                        </span>
                        <span className={styles.teamMembers}>
                          {t.members.length ? memberLine(t.members, 4) : m.join.nobodyYet}
                          {" · "}
                          {t.free === 0 ? m.join.teamFull : plural(locale, t.free, m.join.spotsLeft)}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              {found.format === "teams" && claims && (
                <p className={styles.asUser}>{j.alreadyListed}</p>
              )}

              {error && <Problem>{error}</Problem>}
              <div className={`${access.actions} ${styles.stickyActions}`}>
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
          )}
        </section>
      </main>
    </>
  );
}

function Problem({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className={`${ui.notice} ${ui.noticeErrorOnCard}`} role="alert">
      <AlertTriangle size={20} aria-hidden />
      {children}
    </p>
  );
}
