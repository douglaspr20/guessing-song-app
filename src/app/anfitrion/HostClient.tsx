"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, KeyRound, ShieldCheck } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import access from "@/components/access.module.css";
import ui from "@/components/ui.module.css";
import { api, ApiError, formatDate, type AccessStatus } from "@/lib/client/api";
// Solo tipos del servidor (se borran al compilar).
import type { guestOverview, listMembers } from "@/lib/access/admin";
import type { createInvite, listInvites } from "@/lib/access/invites";
import styles from "./host.module.css";

type Invite = Awaited<ReturnType<typeof listInvites>>[number];
type NewInvite = Awaited<ReturnType<typeof createInvite>>;
type Member = Awaited<ReturnType<typeof listMembers>>[number];
type GuestOverview = Awaited<ReturnType<typeof guestOverview>>;

const message = (err: unknown) => (err instanceof ApiError ? err.message : "Algo salió mal. Prueba otra vez.");

export function HostClient() {
  const [status, setStatus] = useState<AccessStatus | null>(null);
  const refresh = useCallback(async () => {
    setStatus(await api<AccessStatus>("/api/access/status").catch(() => null));
  }, []);
  useEffect(() => {
    // Lee la sesión una vez al montar (viene del servidor).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const isHost = status?.user?.role === "host";
  return (
    <div className={styles.page}>
      <TopBar status={isHost ? "Anfitrión" : undefined} />
      <main className={styles.main}>
        {!status ? null : isHost ? <Panel status={status} onSignedOut={refresh} /> : <HostLogin onDone={refresh} />}
      </main>
    </div>
  );
}

// ---------- Entrada ----------

function HostLogin({ onDone }: { onDone: () => void }) {
  const ids = useId();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/host/login", { json: { password, code } });
      onDone();
    } catch (err) {
      setError(message(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.loginWrap}>
      <section className={`${ui.card} ${access.card}`} aria-labelledby={`${ids}-title`}>
        <div className={ui.cardStripes} />
        <form className={access.body} onSubmit={submit}>
          <div>
            <h1 className={access.title} id={`${ids}-title`}>
              Anfitrión
            </h1>
            <p className={access.lede}>Contraseña y código de tu app de autenticación.</p>
          </div>
          <label className={access.field}>
            <span className={access.label}>Contraseña</span>
            <input
              className={access.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={200}
              required
            />
          </label>
          <label className={access.field}>
            <span className={access.label}>Código de 6 dígitos</span>
            <input
              className={`${access.input} ${access.code}`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              placeholder="000000"
              required
            />
          </label>
          {error && (
            <p className={`${ui.notice} ${ui.noticeErrorOnCard}`} role="alert">
              <AlertTriangle size={20} aria-hidden />
              {error}
            </p>
          )}
          <div className={access.actions}>
            <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={busy}>
              <ShieldCheck size={22} aria-hidden />
              {busy ? "Comprobando…" : "Entrar"}
            </button>
            <Link href="/" className={`${ui.btn} ${ui.onCard}`}>
              Volver
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}

// ---------- Panel ----------

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={ui.card} aria-labelledby={id}>
      <div className={ui.cardStripes} />
      <div className={styles.section}>
        <h2 className={styles.h} id={id}>
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className={`${ui.notice} ${ui.noticeErrorOnCard}`} role="alert">
      <AlertTriangle size={20} aria-hidden />
      {error}
    </p>
  );
}

function Panel({ status, onSignedOut }: { status: AccessStatus; onSignedOut: () => void }) {
  const signOutEverywhere = async () => {
    if (!window.confirm("¿Cerrar la sesión de anfitrión en todos tus dispositivos, también en este?")) return;
    await api("/api/host/sessions", { method: "DELETE" }).catch(() => undefined);
    onSignedOut();
  };
  const signOut = async () => {
    await api("/api/account/logout", { method: "POST" }).catch(() => undefined);
    onSignedOut();
  };

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Panel del anfitrión</h1>
          <p className={styles.sub}>Invitaciones, miembros y el modo sin cuenta.</p>
        </div>
        <Link href="/" className={`${ui.btn} ${ui.onShell}`}>
          Mi estantería
        </Link>
      </div>

      <div className={styles.grid}>
        <SpotifySection status={status} />
        <InvitesSection />
        <MembersSection />
        <GuestsSection />
      </div>

      <div className={styles.foot}>
        <button type="button" className={styles.linkBtn} onClick={signOutEverywhere}>
          Cerrar todas mis sesiones
        </button>
        <button type="button" className={styles.linkBtn} onClick={signOut}>
          Salir
        </button>
      </div>
    </>
  );
}

function SpotifySection({ status }: { status: AccessStatus }) {
  const [linked, setLinked] = useState(!!status.spotify);
  const unlink = async () => {
    if (!window.confirm("¿Desvincular tu Spotify de la app? Tendrás que volver a conectarlo para el modo Spotify.")) return;
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setLinked(false);
  };
  return (
    <Section title="Mi Spotify">
      <p className={styles.text}>
        {linked
          ? `Vinculado${status.spotify?.displayName ? ` como ${status.spotify.displayName}` : ""}. Solo tú lo usas: cada miembro conecta el suyo.`
          : "Sin vincular. Conéctalo para grabar partidas con la canción entera."}
      </p>
      <div className={styles.row}>
        {linked ? (
          <button type="button" className={`${ui.btn} ${ui.onCard} ${styles.small}`} onClick={unlink}>
            Desvincular
          </button>
        ) : (
          <a href="/api/auth/login" className={`${ui.btn} ${ui.primary} ${styles.small}`}>
            Conectar Spotify
          </a>
        )}
      </div>
    </Section>
  );
}

function InvitesSection() {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<NewInvite | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setInvites((await api<{ invites: Invite[] }>("/api/host/invites").catch(() => ({ invites: [] }))).invites);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setCreated(await api<NewInvite>("/api/host/invites", { json: { note } }));
      setNote("");
      await load();
    } catch (err) {
      setError(message(err));
    }
  };
  const revoke = async (id: string) => {
    await api(`/api/host/invites/${id}`, { method: "DELETE" }).catch((err) => setError(message(err)));
    await load();
  };

  return (
    <Section title="Invitaciones">
      <p className={styles.text}>
        Cada código sirve una sola vez y caduca en 7 días. Para el modo Spotify, añade además a esa persona en el panel
        de Spotify (caben 4 además de ti).
      </p>
      <form className={styles.row} onSubmit={create}>
        <input
          className={`${access.input} ${styles.grow}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Para quién es (opcional)"
          maxLength={60}
          aria-label="Para quién es la invitación"
        />
        <button type="submit" className={`${ui.btn} ${ui.primary}`}>
          <KeyRound size={22} aria-hidden />
          Crear invitación
        </button>
      </form>
      {created && (
        <div className={styles.newCode} role="status">
          <span className={styles.statLabel}>Cópialo ahora: no se volverá a mostrar</span>
          <span className={styles.codeValue}>{created.code}</span>
          {created.note && <span className={styles.itemMeta}>Para {created.note}</span>}
        </div>
      )}
      <ErrorLine error={error} />
      {invites && invites.length > 0 && (
        <ul className={styles.list}>
          {invites.map((i) => {
            const expired = !i.usedAt && new Date(i.expiresAt) < new Date();
            return (
              <li key={i.id} className={styles.item}>
                <span className={styles.itemMain}>
                  <span className={styles.itemTitle}>{i.note || "Sin nota"}</span>
                  <span className={styles.itemMeta}>
                    {i.usedAt
                      ? `Usada por ${i.usedBy ?? "un miembro borrado"} el ${formatDate(i.usedAt)}`
                      : expired
                        ? "Caducada"
                        : `Sin usar · caduca el ${formatDate(i.expiresAt)}`}
                  </span>
                </span>
                {!i.usedAt && (
                  <button type="button" className={`${ui.btn} ${ui.onCard} ${styles.small}`} onClick={() => revoke(i.id)}>
                    Anular
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function MembersSection() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMembers((await api<{ members: Member[] }>("/api/host/members").catch(() => ({ members: [] }))).members);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const act = async (m: Member, init: { method: string; json?: unknown }, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    await api(`/api/host/members/${m.id}`, init).catch((err) => setError(message(err)));
    await load();
  };

  return (
    <Section title="Miembros">
      {members?.length === 0 && <p className={styles.text}>Aún no hay miembros. Crea una invitación para el primero.</p>}
      <ErrorLine error={error} />
      {members && members.length > 0 && (
        <ul className={styles.list}>
          {members.map((m) => (
            <li key={m.id} className={styles.item}>
              <span className={styles.itemMain}>
                <span className={styles.itemTitle}>
                  {m.displayName} <span className={styles.itemMeta}>@{m.username}</span>
                </span>
                <span className={styles.itemMeta}>
                  {m.disabled ? "Desactivado · " : ""}
                  {m.spotify !== null ? `Spotify${m.spotify ? ` (${m.spotify})` : ""}` : "Sin Spotify"} · {m.games}{" "}
                  {m.games === 1 ? "partida" : "partidas"}
                  {m.lastSeenAt ? ` · visto el ${formatDate(m.lastSeenAt)}` : ""}
                </span>
              </span>
              <span className={styles.row}>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.onCard} ${styles.small}`}
                  onClick={() => act(m, { method: "PATCH", json: { disabled: !m.disabled } })}
                >
                  {m.disabled ? "Reactivar" : "Desactivar"}
                </button>
                {m.sessions > 0 && (
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.onCard} ${styles.small}`}
                    onClick={() => act(m, { method: "PATCH", json: { revokeSessions: true } })}
                  >
                    Cerrar sesiones
                  </button>
                )}
                <button
                  type="button"
                  className={`${ui.btn} ${ui.onCard} ${styles.small} ${styles.danger}`}
                  onClick={() =>
                    act(m, { method: "DELETE" }, `¿Borrar a @${m.username} con todas sus partidas? No se puede deshacer.`)
                  }
                >
                  Borrar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function GuestsSection() {
  const [data, setData] = useState<GuestOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setData(await api<GuestOverview>("/api/host/guests").catch(() => null));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const setFlag = async (flags: Partial<Pick<GuestOverview, "openModePaused" | "guestSignupsPaused">>) => {
    setError(null);
    try {
      setData(await api<GuestOverview>("/api/host/guests", { method: "PATCH", json: flags }));
    } catch (err) {
      setError(message(err));
    }
  };
  const action = async (body: Record<string, string>, confirmText: string, report: (n: number) => string) => {
    if (!window.confirm(confirmText)) return;
    setError(null);
    setDone(null);
    try {
      const res = await api<{ affected: number; overview: GuestOverview }>("/api/host/guests", { json: body });
      setData(res.overview);
      setDone(report(res.affected));
    } catch (err) {
      setError(message(err));
    }
  };

  if (!data) return <Section title="Modo sin cuenta">{null}</Section>;
  return (
    <Section title="Modo sin cuenta">
      <div className={styles.stats}>
        <Stat value={data.guests} label="Invitados" />
        <Stat value={data.newGuests} label="Nuevos en 24 h" />
        <Stat value={`${data.games}/${data.gameCapacity}`} label="Partidas" />
        <Stat value={data.blocked} label="Bloqueados" />
      </div>

      <label className={styles.toggle}>
        <input type="checkbox" checked={data.openModePaused} onChange={(e) => setFlag({ openModePaused: e.target.checked })} />
        Pausar el modo sin cuenta (los visitantes ven un aviso de mantenimiento)
      </label>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={data.guestSignupsPaused}
          onChange={(e) => setFlag({ guestSignupsPaused: e.target.checked })}
        />
        No admitir invitados nuevos (los que ya juegan siguen)
      </label>

      <div className={styles.row}>
        <button
          type="button"
          className={`${ui.btn} ${ui.onCard} ${styles.small}`}
          onClick={() =>
            action(
              { action: "delete-inactive" },
              `¿Borrar a los invitados sin actividad en ${data.inactiveDays} días, con sus partidas?`,
              (n) => `${n} invitados inactivos borrados.`,
            )
          }
        >
          Borrar inactivos
        </button>
        <button
          type="button"
          className={`${ui.btn} ${ui.onCard} ${styles.small} ${styles.danger}`}
          onClick={() =>
            action(
              { action: "delete-all", confirm: "BORRAR" },
              "¿Borrar a TODOS los invitados y sus partidas? No se puede deshacer.",
              (n) => `${n} invitados borrados.`,
            )
          }
        >
          Borrar todos
        </button>
      </div>

      {data.topIps.length > 0 && (
        <>
          <p className={styles.text}>Conexiones con más invitados nuevos en 24 h (la IP se guarda como hash):</p>
          <ul className={styles.list}>
            {data.topIps.map((ip) => {
              const isBlocked = data.blockedIps.some((b) => b.ipHash === ip.ipHash);
              return (
                <li key={ip.ipHash} className={styles.item}>
                  <span className={styles.itemMain}>
                    <span className={styles.itemTitle}>{ip.label}…</span>
                    <span className={styles.itemMeta}>
                      {ip.guests} {ip.guests === 1 ? "invitado" : "invitados"}
                      {isBlocked ? " · bloqueada" : ""}
                    </span>
                  </span>
                  {!isBlocked && (
                    <button
                      type="button"
                      className={`${ui.btn} ${ui.onCard} ${styles.small} ${styles.danger}`}
                      onClick={() =>
                        action(
                          { action: "block-ip", ipHash: ip.ipHash },
                          "¿Bloquear el modo sin cuenta para esta conexión? Sus invitados dejarán de poder jugar.",
                          (n) => `Conexión bloqueada (${n} invitados).`,
                        )
                      }
                    >
                      Bloquear
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {data.blockedIps.length > 0 && (
        <>
          <p className={styles.text}>Conexiones bloqueadas:</p>
          <ul className={styles.list}>
            {data.blockedIps.map((b) => (
              <li key={b.ipHash} className={styles.item}>
                <span className={styles.itemMain}>
                  <span className={styles.itemTitle}>{b.label}…</span>
                  <span className={styles.itemMeta}>Desde el {formatDate(b.createdAt)}</span>
                </span>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.onCard} ${styles.small}`}
                  onClick={() =>
                    action({ action: "unblock-ip", ipHash: b.ipHash }, "¿Desbloquear esta conexión?", () => "Conexión desbloqueada.")
                  }
                >
                  Desbloquear
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {done && (
        <p className={styles.text} role="status">
          {done}
        </p>
      )}
      <ErrorLine error={error} />
    </Section>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
