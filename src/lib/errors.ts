import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { errorMessage, isErrorKey, type ErrorKey, type ErrorParams } from "@/i18n/errors";
import { DEFAULT_LOCALE, localeFromRequest, type Locale } from "@/i18n/locales";

interface ErrorOptions {
  /** Datos que van dentro del mensaje (`{ name }`, `{ team }`). */
  params?: ErrorParams;
  /** Detalle técnico solo para los logs (estado HTTP de Spotify, etc.): nunca llega a la familia. */
  detail?: string;
}

/**
 * Error esperado de la aplicación, con el código HTTP que debe devolver la API.
 * El texto sale del diccionario de errores (`src/i18n/messages/*\/errors.ts`) en el idioma de quien pregunta:
 * por defecto con la clave igual al `code`; si un mismo `code` tiene varios textos, se indica `key`.
 */
export class AppError extends Error {
  readonly key: ErrorKey;
  readonly params?: ErrorParams;

  constructor(code: ErrorKey, status?: number, options?: ErrorOptions);
  constructor(code: string, status: number, options: ErrorOptions & { key: ErrorKey });
  constructor(
    public code: string,
    public status = 400,
    options: ErrorOptions & { key?: ErrorKey } = {},
  ) {
    const key = options.key ?? (code as ErrorKey);
    super(errorMessage(DEFAULT_LOCALE, key, options.params) + (options.detail ? ` (${options.detail})` : ""));
    this.key = key;
    this.params = options.params;
  }

  /** El mensaje para mostrar, en el idioma pedido. */
  messageIn(locale: Locale): string {
    return errorMessage(locale, this.key, this.params);
  }
}

/** Convierte cualquier error en una respuesta JSON coherente para los route handlers. */
export function toErrorResponse(err: unknown, locale: Locale = DEFAULT_LOCALE): Response {
  if (err instanceof AppError) {
    return Response.json({ error: err.code, message: err.messageIn(locale) }, { status: err.status });
  }
  if (err instanceof ZodError) {
    // Los esquemas que se muestran tal cual (usuario, contraseña) usan claves del diccionario como mensaje.
    const issue = err.issues[0]?.message;
    const message = errorMessage(locale, isErrorKey(issue) ? issue : "VALIDATION_ERROR");
    return Response.json({ error: "VALIDATION_ERROR", message, issues: err.issues }, { status: 422 });
  }
  console.error(err);
  return Response.json({ error: "INTERNAL_ERROR", message: errorMessage(locale, "INTERNAL_ERROR") }, { status: 500 });
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Protección CSRF: una petición que cambia datos solo se acepta si la manda la propia app.
 * Los navegadores siempre envían `Origin` en POST/PATCH/DELETE; si falta o es de otro sitio, se rechaza.
 */
export function assertSameOrigin(req: Request) {
  if (SAFE_METHODS.has(req.method)) return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    originHost = null;
  }
  if (!host || originHost !== host) throw new AppError("BAD_ORIGIN", 403);
}

/** Envuelve un handler: comprueba el origen y traduce los errores a JSON en el idioma de quien pregunta. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const req = args[0] instanceof Request ? args[0] : null;
    try {
      if (req) assertSameOrigin(req);
      return await fn(...args);
    } catch (err) {
      // Deja pasar los errores internos de Next (prerender, redirect, notFound...).
      unstable_rethrow(err);
      return toErrorResponse(err, req ? localeFromRequest(req) : DEFAULT_LOCALE);
    }
  };
}
