"use client";

import { useCallback, useEffect, useState } from "react";
import { RetryNotice } from "@/components/RetryNotice";
import { BandStatus } from "@/components/band/BandStatus";
import { api, type AccessStatus } from "@/lib/client/api";
import { HostLogin } from "./_components/HostLogin";
import { Panel } from "./_components/Panel";
import { errorMessage } from "./_lib/useHostData";
import { useI18n } from "@/i18n/client";
import styles from "./host.module.css";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; status: AccessStatus };

/** Entrada del anfitrión o, con sesión, su panel. Si no se puede saber quién es, lo dice. */
export function HostClient() {
  const { m } = useI18n();
  const [load, setLoad] = useState<Load>({ state: "loading" });

  const refresh = useCallback(async () => {
    try {
      setLoad({ state: "ready", status: await api<AccessStatus>("/api/access/status") });
    } catch (err) {
      setLoad({ state: "error", message: errorMessage(err) });
    }
  }, []);
  useEffect(() => {
    // Lee la sesión una vez al montar (viene del servidor).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const isHost = load.state === "ready" && load.status.user?.role === "host";
  return (
    <div className={styles.page}>
      <BandStatus text={isHost ? m.host.band : undefined} />
      <main className={styles.main}>
        {load.state === "error" && (
          <div className={styles.loginWrap}>
            <RetryNotice message={m.host.cantOpen(load.message)} onRetry={refresh} />
          </div>
        )}
        {load.state === "ready" &&
          (isHost ? <Panel status={load.status} onSignedOut={refresh} /> : <HostLogin onDone={refresh} />)}
      </main>
    </div>
  );
}
