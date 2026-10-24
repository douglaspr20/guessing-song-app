"use client";

import { useEffect, useRef } from "react";
import { shortcutFor, type ShortcutAction } from "./shortcuts";
import type { GameController } from "./useGameController";

/**
 * Conecta los atajos de teclado y del mando de la tele con las acciones de la partida. Cada acción
 * solo se ejecuta si su botón estaría habilitado (`ctl.can`). Al ocultarse la pantalla (<Activity>)
 * los efectos se limpian y los atajos dejan de escucharse.
 */
export function useGameShortcuts(ctl: GameController, { enabled, onHelp }: { enabled: boolean; onHelp: () => void }) {
  const latest = useRef({ ctl, onHelp });
  useEffect(() => {
    latest.current = { ctl, onHelp };
  });

  useEffect(() => {
    if (!enabled) return;

    const perform = (action: ShortcutAction): boolean => {
      const { ctl, onHelp } = latest.current;
      const { can, actions, clock } = ctl;
      if (typeof action === "object") {
        const p = ctl.seats[action.player];
        if (!p) return false;
        ctl.selectPlayer(p.id);
        return true;
      }
      switch (action) {
        case "help":
          onHelp();
          return true;
        case "leaveField":
          leaveField();
          return true;
        case "pause":
          // Antes de que suene, el mismo botón la reproduce.
          if (!clock.started) return run(can.play, actions.replay);
          return run(can.pause, actions.togglePause);
        case "play":
          return run(can.play, actions.replay);
        case "reveal":
          return run(can.reveal, actions.reveal);
        case "awardTitle":
          return run(can.awardTitle, actions.awardTitle);
        case "awardArtist":
          return run(can.awardArtist, actions.awardArtist);
        case "next":
          return run(can.next, actions.primary);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.querySelector("dialog[open]")) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      const action = shortcutFor(e, { typing: isTextField(el), onControl: isControl(el) });
      if (action && perform(action)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);

    // Con audio sonando, Chrome entrega las teclas multimedia (y las del mando por HDMI-CEC) a la
    // Media Session en lugar de como `keydown`.
    const session = "mediaSession" in navigator ? navigator.mediaSession : null;
    const handlers: [MediaSessionAction, ShortcutAction][] = [
      ["play", "pause"],
      ["pause", "pause"],
      ["nexttrack", "next"],
      ["previoustrack", "play"],
    ];
    for (const [name, action] of handlers) {
      try {
        session?.setActionHandler(name, () => perform(action));
      } catch {
        // Acción no soportada por este navegador.
      }
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      for (const [name] of handlers) {
        try {
          session?.setActionHandler(name, null);
        } catch {}
      }
    };
  }, [enabled]);
}

function run(allowed: boolean, fn: () => unknown): boolean {
  if (!allowed) return false;
  void fn();
  return true;
}

function isTextField(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA") return true;
  return el.tagName === "INPUT" && !["radio", "checkbox", "button", "submit"].includes((el as HTMLInputElement).type);
}

function isControl(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (el.tagName === "BUTTON" || el.tagName === "A" || el.tagName === "SUMMARY" || el.tagName === "SELECT") return true;
  // Las fichas de jugador (radio) no cuentan: allí Espacio no aporta nada y es donde deja el foco Esc.
  return el.tagName === "INPUT" && ["checkbox", "button", "submit"].includes((el as HTMLInputElement).type);
}

/** Esc o Atrás sueltan el campo de texto: el foco vuelve a las fichas de jugador y los atajos funcionan. */
function leaveField() {
  const active = document.activeElement as HTMLElement | null;
  active?.blur();
  document.querySelector<HTMLInputElement>('input[name="who"]:checked')?.focus();
}
