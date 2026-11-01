"use client";

import { useConfirmedAction } from "@/components/feedback/useConfirmedAction";
import { useI18n } from "@/i18n/client";
import { plural } from "@/i18n/format";
import { api, catalogLabel, type GameList, type GameSummary } from "@/lib/client/api";

export const SHELF_TITLE_ID = "estanteria";

/** El botón que abrió la confirmación desaparece al borrar: el foco vuelve al título de la estantería. */
const focusShelf = () => document.getElementById(SHELF_TITLE_ID)?.focus();

/**
 * El borrado de uno o de todos los casetes. Los casetes (`list`) los lee el servidor al pintar la portada; tras borrar,
 * `refresh` le pide que los vuelva a leer.
 */
export function useShelf(list: GameList | null, refresh: () => Promise<void>) {
  const { m, locale } = useI18n();
  const t = m.home;
  const act = useConfirmedAction();

  const afterDelete = async () => {
    await refresh();
    focusShelf();
  };

  /** Borra un casete de la estantería, con confirmación. */
  const deleteGame = async (game: GameSummary) => {
    const label = catalogLabel(game.catalogNumber);
    await act({
      question: {
        title: t.deleteTitle(label),
        body: game.status === "FINISHED" ? t.deleteFinished : t.deleteUnfinished,
        confirmLabel: t.deleteConfirm,
        tone: "danger",
      },
      run: () => api(`/api/games/${game.id}`, { method: "DELETE" }),
      done: t.deleted(label),
      after: afterDelete,
    });
  };

  /** Vacía toda la estantería del usuario o invitado (pide escribir la palabra de confirmación). */
  const deleteHistory = async () => {
    const total = list?.total ?? 0;
    await act({
      question: {
        title: t.deleteAllTitle,
        body: (
          <>
            {t.deleteAllBefore} <strong>{plural(locale, total, t.deleteAllCount)}</strong> {t.deleteAllAfter}
          </>
        ),
        confirmLabel: t.deleteAllConfirm,
        tone: "danger",
        typeToConfirm: t.deleteAllWord,
      },
      // La API pide la palabra en español como constante, sea cual sea el idioma de la pantalla.
      run: () => api<{ deleted: number }>("/api/games", { method: "DELETE", json: { confirm: "BORRAR" } }),
      done: ({ deleted }) => plural(locale, deleted, t.deletedAll),
      after: afterDelete,
    });
  };

  return { deleteGame, deleteHistory };
}
