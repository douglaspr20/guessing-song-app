import type { ComponentPropsWithoutRef } from "react";
import controls from "./styles/controls.module.css";

/** Pastilla que se marca y desmarca (géneros, playlists, nombres apuntados). `hand` la escribe a mano. */
export function Chip({
  pressed,
  hand = false,
  className = "",
  ...rest
}: { pressed: boolean; hand?: boolean } & Omit<ComponentPropsWithoutRef<"button">, "type" | "aria-pressed">) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`${controls.chip} ${hand ? controls.chipHand : ""} ${className}`}
      {...rest}
    />
  );
}

/** Contenedor de chips. */
export const chipsClass = controls.chips;
