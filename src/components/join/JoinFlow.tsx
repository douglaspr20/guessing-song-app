"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { BandStatus } from "@/components/band/BandStatus";
import { Card } from "@/components/Card";
import { useI18n } from "@/i18n/client";
import { api, ApiError, errorText, type AccessStatus } from "@/lib/client/api";
import { ClaimWaiting } from "./ClaimWaiting";
import { CodeStep } from "./CodeStep";
import { NameStep, type Lookup } from "./NameStep";
import styles from "./JoinFlow.module.css";

const clean = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

/** El flujo de unirse, del código al nombre; el nombre va aparte (se conserva al volver). */
interface Flow {
  code: string;
  found: Lookup | null;
  teamId: string;
  busy: boolean;
  error: string | null;
  /** La API no respondió: se dice y se ofrece reintentar. */
  offline: boolean;
  /** Ese nombre ya está dentro desde otro navegador: se ofrece pedir el sitio al anfitrión. */
  taken: boolean;
  /** Esperando a que el anfitrión deje entrar: la partida a la que se pidió el sitio. */
  claiming: { gameId: string; name: string } | null;
}

/** Todo como al abrir la página, con ese código. */
const startFlow = (code: string): Flow => ({
  code: clean(code),
  found: null,
  teamId: "",
  busy: false,
  error: null,
  offline: false,
  taken: false,
  claiming: null,
});

/**
 * Unirse a una partida con su código de 6 caracteres: primero el código, después el nombre (o el de
 * la cuenta, si hay sesión) y, por equipos, el equipo. Se abre desde /join o con el enlace /join/CÓDIGO.
 */
export function JoinFlow() {
  const router = useRouter();
  const { m } = useI18n();
  // En /join/ABC123 el código viene en la dirección; en /join se escribe a mano.
  const initialCode = useParams<{ code?: string }>().code ?? "";
  const titleId = useId();
  const [flow, setFlow] = useState(() => startFlow(initialCode));
  const { code, found, teamId, busy, error, offline, taken, claiming } = flow;
  const [name, setName] = useState("");
  const [user, setUser] = useState<{ displayName: string } | null>(null);
  const autoLooked = useRef(false);
  /** Cambia solo esas partes del flujo. */
  const patch = (p: Partial<Flow>) => setFlow((f) => ({ ...f, ...p }));

  useEffect(() => {
    api<AccessStatus>("/api/access/status").then(
      (a) => setUser(a.user ? { displayName: a.user.displayName } : null),
      () => {},
    );
  }, []);

  const lookup = async (value = code) => {
    patch({ busy: true, error: null, offline: false });
    try {
      const r = await api<Lookup>("/api/join/lookup", { json: { code: value } });
      patch({ busy: false, found: r, code: r.code });
    } catch (err) {
      patch({ busy: false, ...(err instanceof ApiError ? { error: err.message } : { offline: true }) });
    }
  };

  // Next 16 conserva esta página montada (oculta, con `<Activity>`) al irse a la partida: al volver a «Unirme» aparecía
  // la partida anterior con «Entrando…» bloqueado. Al ocultarse, empieza de cero.
  useEffect(
    () => () => {
      setFlow(startFlow(initialCode));
      autoLooked.current = false;
    },
    [initialCode],
  );

  // Con el enlace /join/ABC123 se comprueba el código sin que haya que pulsar nada.
  useEffect(() => {
    if (autoLooked.current || clean(initialCode).length !== 6) return;
    autoLooked.current = true;
    void lookup(clean(initialCode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const finalName = user ? user.displayName : name.trim();
  // En equipos solo hace falta elegir si el nombre no estaba ya apuntado por el anfitrión.
  const claims = !!found?.pending.some((p) => p.toLowerCase() === finalName.toLowerCase());
  const needsTeam = found?.format === "teams" && !claims;
  const ready = !!finalName && (!needsTeam || !!teamId);

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    if (code.length === 6) void lookup();
  };

  const submitJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!found || !ready) return;
    patch({ busy: true, error: null });
    try {
      const r = await api<{ gameId: string }>("/api/join", {
        json: { code: found.code, name: user ? undefined : finalName, teamId: needsTeam ? teamId : undefined },
      });
      // El botón sigue en «Entrando…» hasta que cambia la página (y al ocultarse, todo vuelve a empezar).
      router.push(`/play/${r.gameId}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NAME_TAKEN" && !user) patch({ busy: false, taken: true });
      else patch({ busy: false, error: errorText(err) });
    }
  };

  /** «Soy yo»: pide al anfitrión quedarse con el sitio de ese nombre y espera su respuesta. */
  const askToEnter = async () => {
    if (!found) return;
    patch({ busy: true, error: null });
    try {
      const r = await api<{ gameId: string; already: boolean }>("/api/join/claim", { json: { code: found.code, name: finalName } });
      if (r.already) router.push(`/play/${r.gameId}`);
      else patch({ busy: false, claiming: { gameId: r.gameId, name: finalName } });
    } catch (err) {
      patch({ busy: false, error: errorText(err) });
    }
  };

  /** El anfitrión no lo dejó entrar (o caducó): vuelve al nombre, con el motivo. */
  const claimGone = useCallback(
    () => setFlow((f) => ({ ...f, claiming: null, taken: false, error: m.join.waitGone })),
    [m.join.waitGone],
  );

  /** «Cambiar código»: de vuelta al primer paso con el código que había. */
  const changeCode = () => setFlow((f) => startFlow(f.code));

  return (
    <>
      <BandStatus text={m.join.band} />
      <main className={styles.main}>
        <Card className={styles.card} aria-labelledby={titleId}>
          {claiming ? (
            <ClaimWaiting
              titleId={titleId}
              gameId={claiming.gameId}
              name={claiming.name}
              onGone={claimGone}
              onCancel={() => patch({ claiming: null })}
            />
          ) : !found ? (
            <CodeStep
              titleId={titleId}
              code={code}
              onCode={(value) => patch({ code: clean(value), error: null })}
              busy={busy}
              error={error}
              offline={offline}
              onRetry={() => lookup()}
              onSubmit={submitCode}
            />
          ) : (
            <NameStep
              titleId={titleId}
              found={found}
              user={user}
              name={name}
              onName={(value) => {
                setName(value);
                patch({ error: null, taken: false });
              }}
              teamId={teamId}
              onTeam={(id) => patch({ teamId: id })}
              claims={claims}
              ready={ready}
              busy={busy}
              error={error}
              taken={taken}
              onAskToEnter={askToEnter}
              onChangeCode={changeCode}
              onSubmit={submitJoin}
            />
          )}
        </Card>
      </main>
    </>
  );
}
