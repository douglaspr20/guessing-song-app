"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, LogIn } from "lucide-react";
import { BandStatus } from "@/components/band/BandStatus";
import { TeamDot } from "@/components/TeamDot";
import { RetryNotice } from "@/components/RetryNotice";
import ui from "@/components/ui.module.css";
import access from "@/components/access.module.css";
import { api, ApiError, type AccessStatus } from "@/lib/client/api";
import { memberLine } from "@/lib/game/teams";
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
export function JoinFlow({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
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
      setError(err instanceof ApiError ? err.message : "No se pudo conectar. Prueba otra vez.");
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
      <BandStatus text="Unirse a una partida" />
      <main className={styles.main}>
        <section className={`${ui.card} ${styles.card}`} aria-labelledby={`${ids}-title`}>
          <div className={ui.cardStripes} />
          {!found ? (
            <form className={access.body} onSubmit={submitCode}>
              <div>
                <h1 className={access.title} id={`${ids}-title`}>
                  Unirme a una partida
                </h1>
                <p className={access.lede}>Escribe el código de 6 letras o números que te pasó quien la grabó.</p>
              </div>
              <label className={access.field}>
                <span className={access.label}>Código de la partida</span>
                <input
                  className={`${access.input} ${styles.code}`}
                  value={code}
                  onChange={(e) => {
                    setCode(clean(e.target.value));
                    setError(null);
                  }}
                  placeholder="ABC123"
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
              {offline && <RetryNotice message="No pudimos comprobar el código." onRetry={() => lookup()} />}
              <div className={access.actions}>
                <button type="submit" className={`${ui.btn} ${ui.primary} ${ui.big}`} disabled={busy || code.length !== 6}>
                  <ArrowRight size={24} aria-hidden />
                  {busy ? "Buscando…" : "Continuar"}
                </button>
              </div>
            </form>
          ) : (
            <form className={access.body} onSubmit={submitJoin}>
              <div>
                <h1 className={access.title} id={`${ids}-title`}>
                  {found.format === "teams" ? "¿En qué equipo juegas?" : "¿Cómo te llamas?"}
                </h1>
                <p className={access.lede}>
                  Partida <strong className={styles.codeTag}>{found.code}</strong>
                  {" · "}
                  <button type="button" className={styles.again} onClick={reset}>
                    Cambiar código
                  </button>
                </p>
              </div>

              {!found.joinOpen && <Problem>El anfitrión cerró la entrada a esta partida.</Problem>}
              {found.joinOpen && found.full && <Problem>La partida está completa.</Problem>}

              {user ? (
                <p className={styles.asUser}>
                  Entras como <strong>{user.displayName}</strong>, con tu cuenta.
                </p>
              ) : (
                <label className={access.field}>
                  <span className={access.label}>Tu nombre</span>
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
                    placeholder="Cómo te ve la sala"
                  />
                </label>
              )}

              {!user && found.pending.length > 0 && (
                <div className={styles.pending}>
                  <span className={access.label}>¿Eres uno de estos?</span>
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
                  <legend className={access.label}>Tu equipo</legend>
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
                          {t.members.length ? memberLine(t.members, 4) : "Aún sin nadie"}
                          {" · "}
                          {t.free === 0 ? "lleno" : t.free === 1 ? "queda 1 hueco" : `quedan ${t.free} huecos`}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              {found.format === "teams" && claims && (
                <p className={styles.asUser}>El anfitrión ya te apuntó: entrarás directo en tu equipo.</p>
              )}

              {error && <Problem>{error}</Problem>}
              <div className={access.actions}>
                <button
                  type="submit"
                  className={`${ui.btn} ${ui.primary} ${ui.big}`}
                  disabled={busy || !ready || !found.joinOpen || found.full}
                >
                  <LogIn size={24} aria-hidden />
                  {busy ? "Entrando…" : "Entrar"}
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
