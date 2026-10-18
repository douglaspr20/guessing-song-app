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

/** Envuelve un handler para que los errores se traduzcan automáticamente a JSON. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      // Deja pasar los errores internos de Next (prerender, redirect, notFound...).
      unstable_rethrow(err);
      return toErrorResponse(err);
    }
  };
}
