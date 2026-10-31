import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { pickAvoidingHeard } from "@/lib/game/fresh";
import { speechLang } from "@/lib/client/speech";

describe("no repetir canciones de otras partidas", () => {
  it("con canciones nuevas, evita lo de esta partida y lo ya oído", async () => {
    const pick = vi.fn(async (exclude: Set<string>) => [...exclude].sort());

    expect(await pickAvoidingHeard(new Set(["a"]), new Set(["b", "a"]), pick)).toEqual(["a", "b"]);
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it("si no queda nada nuevo, repite una ya oída (pero nunca una de esta partida)", async () => {
    const pick = vi.fn(async (exclude: Set<string>) => {
      if (exclude.has("b")) throw new AppError("NO_TRACKS_FOUND", 404);
      return [...exclude];
    });

    expect(await pickAvoidingHeard(new Set(["a"]), new Set(["b"]), pick)).toEqual(["a"]);
    expect(pick).toHaveBeenCalledTimes(2);
  });

  it("otros errores (iTunes limitando, playlists bloqueadas) no se tapan con el segundo intento", async () => {
    const pick = vi.fn(async () => {
      throw new AppError("ITUNES_RATE_LIMITED", 429);
    });

    await expect(pickAvoidingHeard(new Set(), new Set(["b"]), pick)).rejects.toMatchObject({ code: "ITUNES_RATE_LIMITED" });
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it("sin nada oído, una sola búsqueda", async () => {
    const pick = vi.fn(async (exclude: Set<string>) => exclude.size);
    expect(await pickAvoidingHeard(new Set(["a"]), new Set(), pick)).toBe(1);
    expect(pick).toHaveBeenCalledTimes(1);
  });
});

describe("idioma del dictado", () => {
  it("usa el idioma de la música de la partida y, si no hay, el de la pantalla", () => {
    expect(speechLang("es-latam", "en")).toBe("es-MX");
    expect(speechLang("pt", "es")).toBe("pt-BR");
    expect(speechLang("en", "es")).toBe("en-US");
    expect(speechLang(null, "es")).toBe("es-ES");
    expect(speechLang("", "en")).toBe("en-US");
    expect(speechLang("klingon", "es")).toBe("es-ES");
  });
});
