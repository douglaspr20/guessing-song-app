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
  /** Ese nombre ya está dentro desde otro navegador: se ofrece pedir el sitio al anfitrión. */
  const [taken, setTaken] = useState(false);
  /** Esperando a que el anfitrión deje entrar: la partida a la que se pidió el sitio. */
  const [claiming, setClaiming] = useState<{ gameId: string; name: string } | null>(null);

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
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ gameId: string }>("/api/join", {
        json: { code: found.code, name: user ? undefined : finalName, teamId: needsTeam ? teamId : undefined },
      });
      router.push(`/play/${r.gameId}`);
    } catch (err) {
      // Solo se libera el botón si falló: al entrar, la página cambia.
      if (err instanceof ApiError && err.code === "NAME_TAKEN" && !user) setTaken(true);
      else setError(errorText(err));
      setBusy(false);
    }
  };

  /** «Soy yo»: pide al anfitrión quedarse con el sitio de ese nombre y espera su respuesta. */
  const askToEnter = async () => {
    if (!found) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ gameId: string; already: boolean }>("/api/join/claim", { json: { code: found.code, name: finalName } });
      if (r.already) router.push(`/play/${r.gameId}`);
      else setClaiming({ gameId: r.gameId, name: finalName });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  /** El anfitrión no lo dejó entrar (o caducó): vuelve al nombre, con el motivo. */
  const claimGone = useCallback(() => {
    setClaiming(null);
    setTaken(false);
    setError(m.join.waitGone);
  }, [m.join.waitGone]);

  const reset = () => {
    setFound(null);
    setTeamId("");
    setError(null);
    setTaken(false);
  };

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
              onCancel={() => setClaiming(null)}
            />
          ) : !found ? (
            <CodeStep
              titleId={titleId}
              code={code}
              onCode={(value) => {
                setCode(clean(value));
                setError(null);
              }}
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
                setError(null);
                setTaken(false);
              }}
              teamId={teamId}
              onTeam={setTeamId}
              claims={claims}
              ready={ready}
              busy={busy}
              error={error}
              taken={taken}
              onAskToEnter={askToEnter}
              onChangeCode={reset}
              onSubmit={submitJoin}
            />
          )}
        </Card>
      </main>
    </>
  );
}
