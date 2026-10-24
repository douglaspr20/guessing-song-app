import styles from "../game.module.css";

export type RemoteColor = "red" | "green" | "yellow" | "blue";

const COLOR_NAME: Record<RemoteColor, string> = { red: "rojo", green: "verde", yellow: "amarillo", blue: "azul" };

/** Marca del atajo dentro de un botón: la tecla y, si lo tiene, el botón de color del mando de la tele. */
export function Hint({ k, color }: { k: string; color?: RemoteColor }) {
  return (
    <span className={styles.hint}>
      {color && <span className={styles.remoteDot} data-color={color} title={`Botón ${COLOR_NAME[color]} del mando`} />}
      <kbd className={styles.key}>{k}</kbd>
    </span>
  );
}
