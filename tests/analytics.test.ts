import { describe, expect, it } from "vitest";
import { anonymizeUrl, beforeSend } from "@/lib/client/analytics";

const site = "https://guessing-song-app.vercel.app";

describe("URLs que llegan a la analítica", () => {
  it("cambia ids y códigos por la ruta genérica", () => {
    expect(anonymizeUrl(`${site}/game/cmvpsnwia000044rzsx8az7yv`)).toBe(`${site}/game/[id]`);
    expect(anonymizeUrl(`${site}/play/abc123`)).toBe(`${site}/play/[gameId]`);
    expect(anonymizeUrl(`${site}/join/BA4WCG`)).toBe(`${site}/join/[code]`);
  });

  it("deja igual las rutas sin datos y quita los parámetros", () => {
    expect(anonymizeUrl(`${site}/`)).toBe(`${site}/`);
    expect(anonymizeUrl(`${site}/join`)).toBe(`${site}/join`);
    expect(anonymizeUrl(`${site}/new?edit=cmvpsnwia000044rzsx8az7yv`)).toBe(`${site}/new`);
    expect(anonymizeUrl(`${site}/?error=denied`)).toBe(`${site}/`);
  });

  it("no mide el panel del anfitrión ni URLs rotas", () => {
    expect(anonymizeUrl(`${site}/host`)).toBeNull();
    expect(anonymizeUrl("no es una url")).toBeNull();
    expect(beforeSend({ type: "pageview", url: `${site}/host` })).toBeNull();
    expect(beforeSend({ type: "vital", url: `${site}/play/x?y=1`, route: "/play/[gameId]" })).toEqual({
      type: "vital",
      url: `${site}/play/[gameId]`,
      route: "/play/[gameId]",
    });
  });
});
