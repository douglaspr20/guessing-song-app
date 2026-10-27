import type { Locale } from "../locales";
import * as en from "./en";
import * as es from "./es";

/**
 * Textos de la interfaz, por zonas (`m.home`, `m.game`…). El español es la fuente: cada zona en inglés
 * se declara con `satisfies typeof es…`, así TypeScript no compila si falta una clave o si una función
 * recibe otros datos. Los textos con datos son funciones (`m.common.place(2)`); los plurales son
 * `{ one, other }` y se resuelven con `plural()` de `../format`.
 */
export type Messages = typeof es;

const en_: Messages = en;

export const MESSAGES: Record<Locale, Messages> = { es, en: en_ };
