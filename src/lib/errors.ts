import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";

/** Error esperado de la aplicación, con el código HTTP que debe devolver la API. */
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "BAD_REQUEST",
  ) {
    super(message);
  }
}

/** Convierte cualquier error en una respuesta JSON coherente para los route handlers. */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return Response.json(
      { error: "VALIDATION_ERROR", message: "Datos inválidos", issues: err.issues },
      { status: 422 },
    );
  }
  console.error(err);
  return Response.json({ error: "INTERNAL_ERROR", message: "Error interno" }, { status: 500 });
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
  if (!host || originHost !== host) throw new AppError("Origen no permitido", 403, "BAD_ORIGIN");
}

/** Envuelve un handler: comprueba el origen y traduce los errores a JSON. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      if (args[0] instanceof Request) assertSameOrigin(args[0]);
      return await fn(...args);
    } catch (err) {
      // Deja pasar los errores internos de Next (prerender, redirect, notFound...).
      unstable_rethrow(err);
      return toErrorResponse(err);
    }
  };
}
