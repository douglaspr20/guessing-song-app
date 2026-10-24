import { describe, expect, it } from "vitest";
import { shortcutFor, type KeyContext } from "@/app/partida/[id]/_lib/shortcuts";

const idle: KeyContext = { typing: false, onControl: false };
const typing: KeyContext = { typing: true, onControl: false };
const onButton: KeyContext = { typing: false, onControl: true };

describe("atajos de teclado", () => {
  it("cada tecla da su acción (mayúsculas también)", () => {
    expect(shortcutFor({ key: " " }, idle)).toBe("pause");
    expect(shortcutFor({ key: "p" }, idle)).toBe("pause");
    expect(shortcutFor({ key: "R" }, idle)).toBe("play");
    expect(shortcutFor({ key: "v" }, idle)).toBe("reveal");
    expect(shortcutFor({ key: "c" }, idle)).toBe("awardTitle");
    expect(shortcutFor({ key: "a" }, idle)).toBe("awardArtist");
    expect(shortcutFor({ key: "n" }, idle)).toBe("next");
    expect(shortcutFor({ key: "?" }, idle)).toBe("help");
    expect(shortcutFor({ key: "h" }, idle)).toBe("help");
    expect(shortcutFor({ key: "3" }, idle)).toEqual({ player: 2 });
    expect(shortcutFor({ key: "0" }, idle)).toBeNull();
    expect(shortcutFor({ key: "x" }, idle)).toBeNull();
    expect(shortcutFor({ key: "ArrowRight" }, idle)).toBeNull();
  });

  it("mientras se escribe solo pasan las multimedia y Esc", () => {
    expect(shortcutFor({ key: "p" }, typing)).toBeNull();
    expect(shortcutFor({ key: " " }, typing)).toBeNull();
    expect(shortcutFor({ key: "2" }, typing)).toBeNull();
    expect(shortcutFor({ key: "MediaPlayPause" }, typing)).toBe("pause");
    expect(shortcutFor({ key: "Escape" }, typing)).toBe("leaveField");
    expect(shortcutFor({ key: "Escape" }, idle)).toBeNull();
  });

  it("Espacio sobre un botón o enlace hace lo suyo", () => {
    expect(shortcutFor({ key: " " }, onButton)).toBeNull();
    expect(shortcutFor({ key: "p" }, onButton)).toBe("pause");
  });

  it("se ignoran los modificadores y la tecla mantenida", () => {
    expect(shortcutFor({ key: "r", ctrlKey: true }, idle)).toBeNull();
    expect(shortcutFor({ key: "n", metaKey: true }, idle)).toBeNull();
    expect(shortcutFor({ key: "v", altKey: true }, idle)).toBeNull();
    expect(shortcutFor({ key: "c", repeat: true }, idle)).toBeNull();
  });
});

describe("mando de la tele", () => {
  it("botones de color por nombre y por keyCode (webOS, Tizen)", () => {
    expect(shortcutFor({ key: "ColorF0Red" }, idle)).toBe("reveal");
    expect(shortcutFor({ key: "Unidentified", keyCode: 403 }, idle)).toBe("reveal");
    expect(shortcutFor({ key: "Unidentified", keyCode: 404 }, typing)).toBe("awardTitle");
    expect(shortcutFor({ key: "Unidentified", keyCode: 405 }, idle)).toBe("awardArtist");
    expect(shortcutFor({ key: "Unidentified", keyCode: 406 }, idle)).toBe("next");
  });

  it("multimedia: play/pausa, avance y rebobinado", () => {
    expect(shortcutFor({ key: "MediaPlay" }, idle)).toBe("pause");
    expect(shortcutFor({ key: "Unidentified", keyCode: 10252 }, idle)).toBe("pause");
    expect(shortcutFor({ key: "MediaTrackNext" }, idle)).toBe("next");
    expect(shortcutFor({ key: "MediaRewind" }, idle)).toBe("play");
  });

  it("Atrás suelta el campo, pero fuera de él no hace nada", () => {
    expect(shortcutFor({ key: "Unidentified", keyCode: 461 }, typing)).toBe("leaveField");
    expect(shortcutFor({ key: "Unidentified", keyCode: 10009 }, typing)).toBe("leaveField");
    expect(shortcutFor({ key: "GoBack" }, typing)).toBe("leaveField");
    expect(shortcutFor({ key: "Unidentified", keyCode: 461 }, idle)).toBeNull();
    expect(shortcutFor({ key: "BrowserBack" }, idle)).toBeNull();
  });
});
