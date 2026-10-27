import { describe, expect, it } from "vitest";
import { anonymizeUrl, beforeSend } from "@/lib/client/analytics";

const site = "https://guessing-song-app.vercel.app";

describe("URLs que llegan a la analítica", () => {
  it("cambia ids y códigos por la ruta genérica", () => {
    expect(anonymizeUrl(`${site}/partida/cmvpsnwia000044rzsx8az7yv`)).toBe(`${site}/partida/[id]`);
    expect(anonymizeUrl(`${site}/jugar/abc123`)).toBe(`${site}/jugar/[gameId]`);
    expect(anonymizeUrl(`${site}/unirse/BA4WCG`)).toBe(`${site}/unirse/[code]`);
  });

  it("deja igual las rutas sin datos y quita los parámetros", () => {
    expect(anonymizeUrl(`${site}/`)).toBe(`${site}/`);
    expect(anonymizeUrl(`${site}/unirse`)).toBe(`${site}/unirse`);
    expect(anonymizeUrl(`${site}/nueva?editar=cmvpsnwia000044rzsx8az7yv`)).toBe(`${site}/nueva`);
    expect(anonymizeUrl(`${site}/?error=denied`)).toBe(`${site}/`);
  });

  it("no mide el panel del anfitrión ni URLs rotas", () => {
    expect(anonymizeUrl(`${site}/anfitrion`)).toBeNull();
    expect(anonymizeUrl("no es una url")).toBeNull();
    expect(beforeSend({ type: "pageview", url: `${site}/anfitrion` })).toBeNull();
    expect(beforeSend({ type: "vital", url: `${site}/jugar/x?y=1`, route: "/jugar/[gameId]" })).toEqual({
      type: "vital",
      url: `${site}/jugar/[gameId]`,
      route: "/jugar/[gameId]",
    });
  });
});
