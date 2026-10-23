import type { ReactNode } from "react";
import { BandStatus } from "../band/BandStatus";
import { TopBar } from "../TopBar";
import styles from "./errors.module.css";

/**
 * Pantalla de error con el encuadre de la portada: titular a la izquierda,
 * el objeto (cartel o casete roto) a la derecha. En móvil, el objeto va arriba.
 */
export function ErrorScene({
  code,
  title,
  lede,
  actions,
  footnote,
  art,
  standalone = false,
}: {
  code: string;
  title: ReactNode;
  lede: ReactNode;
  actions: ReactNode;
  footnote?: ReactNode;
  art: ReactNode;
  /** Fuera del layout raíz (global-error): pinta su propia banda. */
  standalone?: boolean;
}) {
  return (
    <div className={styles.page}>
      {/* El código va en la etiqueta de estado de la banda, no como rótulo encima del titular. */}
      {standalone ? <TopBar status={code} /> : <BandStatus text={code} />}
      <main className={styles.main}>
        <section className={styles.scene}>
          <div>
            <h1 className={styles.headline}>{title}</h1>
            <p className={styles.lede}>{lede}</p>
            <div className={styles.actions}>{actions}</div>
            {footnote && <p className={styles.digest}>{footnote}</p>}
          </div>
          <div className={styles.art}>{art}</div>
        </section>
      </main>
    </div>
  );
}
