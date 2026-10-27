"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirmedAction } from "@/components/feedback/useConfirmedAction";
import { useI18n } from "@/i18n/client";
import { plural } from "@/i18n/format";
import { api, catalogLabel, errorText, type GameList, type GameSummary } from "@/lib/client/api";

export const SHELF_TITLE_ID = "estanteria";

/** El botón que abrió la confirmación desaparece al borrar: el foco vuelve al título de la estantería. */
const focusShelf = () => document.getElementById(SHELF_TITLE_ID)?.focus();

/** Los casetes de la estantería (se piden solo cuando se ve) y el borrado de uno o de todos. */
export function useShelf(visible: boolean, reloadKey: unknown) {
  const { m, locale } = useI18n();
  const t = m.home;
  const act = useConfirmedAction();
  const [list, setList] = useState<GameList | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      setList(await api<GameList>("/api/games?limit=12"));
      setListError(null);
    } catch (err) {
      setListError(errorText(err));
    }
  }, []);

  useEffect(() => {
    // La estantería se pide al saber quién es (viene del servidor); vacía mientras tanto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setList(null);
    if (visible) loadList();
  }, [visible, reloadKey, loadList]);

  const afterDelete = async () => {
    await loadList();
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

  return { list, listError, loadList, deleteGame, deleteHistory };
}
