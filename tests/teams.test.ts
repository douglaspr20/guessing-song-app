import { describe, expect, it } from "vitest";
import { createGameSchema } from "@/lib/game/filters";
import {
  distribute,
  emptyTeams,
  everyone,
  fillIn,
  memberLine,
  moveMember,
  resizeTeams,
  teamsProblem,
  type TeamDraft,
} from "@/lib/game/teams";

/** Generador determinista para que el sorteo sea repetible. */
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

const team = (name: string, color: TeamDraft["color"], members: string[]): TeamDraft => ({ name, color, members });

describe("reparto al azar", () => {
  const names = ["Ana", "Luis", "Marta", "Pablo", "Rosa", "Tomás", "Inés"];

  it("equilibra (diferencia máxima de 1), no pierde ni duplica a nadie", () => {
    const out = distribute(names, emptyTeams(3), 3, seeded());
    const sizes = out.map((t) => t.members.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(everyone(out).sort()).toEqual([...names].sort());
  });

  it("conserva el nombre y el color de cada equipo", () => {
    const base = [team("Los Rojos", "teja", []), team("Los Verdes", "pino", [])];
    const out = distribute(names, base, 4, seeded(7));
    expect(out.map((t) => [t.name, t.color])).toEqual([
      ["Los Rojos", "teja"],
      ["Los Verdes", "pino"],
    ]);
  });

  it("falla si no caben", () => {
    expect(() => distribute(names, emptyTeams(2), 3)).toThrow(RangeError);
    expect(() => distribute(names, emptyTeams(2), 4)).not.toThrow();
  });
});

describe("añadir y mover", () => {
  it("una persona nueva va al equipo con menos gente", () => {
    const teams = [team("A", "azafran", ["x", "y"]), team("B", "cielo", ["z"])];
    expect(fillIn(teams, "w", 3)?.map((t) => t.members.length)).toEqual([2, 2]);
  });

  it("devuelve null si todos están llenos", () => {
    expect(fillIn([team("A", "azafran", ["x"]), team("B", "cielo", ["y"])], "w", 1)).toBeNull();
  });

  it("mueve de equipo y no deja pasar a uno lleno", () => {
    const teams = [team("A", "azafran", ["x", "y"]), team("B", "cielo", ["z"])];
    expect(moveMember(teams, 0, "x", 1, 2)?.map((t) => t.members)).toEqual([["y"], ["z", "x"]]);
    expect(moveMember(teams, 0, "x", 1, 1)).toBeNull();
  });

  it("al bajar el número de equipos, los miembros de los que desaparecen pasan a los que quedan", () => {
    const teams = [team("A", "azafran", ["a"]), team("B", "cielo", ["b", "c"]), team("C", "menta", ["d"])];
    const out = resizeTeams(teams, 2, 3);
    expect(out).toHaveLength(2);
    expect(everyone(out).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("al subir, los nuevos nacen vacíos con el siguiente color libre", () => {
    const out = resizeTeams([team("A", "azafran", ["a"]), team("B", "cielo", [])], 3, 3);
    expect(out[2]).toEqual({ name: "Equipo Menta", color: "menta", members: [] });
  });

  it("resume los miembros en una línea", () => {
    expect(memberLine(["Ana", "Luis"])).toBe("Ana, Luis");
    expect(memberLine(["Ana", "Luis", "Marta", "Pablo", "Rosa"])).toBe("Ana, Luis, Marta +2");
  });
});

describe("lo que impide grabar", () => {
  it("avisa de equipos vacíos, pasados de máximo y nombres repetidos", () => {
    expect(teamsProblem(emptyTeams(2), 3)).toMatch(/Añade/);
    expect(teamsProblem([team("A", "azafran", ["x"]), team("B", "cielo", [])], 3)).toMatch(/B no tiene a nadie/);
    expect(teamsProblem([team("A", "azafran", ["x", "y"]), team("B", "cielo", ["z"])], 1)).toMatch(/A tiene 2/);
    expect(teamsProblem([team("A", "azafran", ["x"]), team("B", "cielo", ["X"])], 3)).toMatch(/repetidos/);
    expect(teamsProblem([team("A", "azafran", ["x"]), team("a", "cielo", ["y"])], 3)).toMatch(/mismo nombre/);
    expect(teamsProblem([team("A", "azafran", ["x"]), team("B", "cielo", ["y"])], 3)).toBeNull();
  });
});

describe("esquema de la partida", () => {
  const base = { mode: "open", rounds: 3 };
  const ok = [team("A", "azafran", ["x", "y"]), team("B", "cielo", ["z"])];
  const parse = (extra: object) => createGameSchema.safeParse({ ...base, ...extra });

  it("sin formato sigue siendo todos contra todos", () => {
    const r = parse({ players: ["Ana", "Luis"] });
    expect(r.success && r.data).toMatchObject({ format: "solo", players: ["Ana", "Luis"] });
    expect(parse({ players: [] }).success).toBe(false);
    expect(parse({ players: ["Ana", "ana"] }).success).toBe(false);
  });

  it("acepta equipos válidos", () => {
    expect(parse({ format: "teams", teams: ok, maxTeamSize: 2 }).success).toBe(true);
  });

  it("rechaza lo que no cuadra", () => {
    const bad = (extra: object) => expect(parse({ format: "teams", maxTeamSize: 2, teams: ok, ...extra }).success).toBe(false);
    bad({ maxTeamSize: undefined });
    bad({ maxTeamSize: 1 }); // A tiene 2
    bad({ teams: [ok[0]] }); // menos de 2 equipos
    bad({ teams: [ok[0], team("B", "cielo", [])] }); // equipo vacío
    bad({ teams: [ok[0], team("B", "azafran", ["z"])] }); // color repetido
    bad({ teams: [ok[0], team("a", "cielo", ["z"])] }); // nombre de equipo repetido
    bad({ teams: [ok[0], team("B", "cielo", ["X"])] }); // persona repetida entre equipos
    bad({ teams: [ok[0], { name: "B", color: "tomate", members: ["z"] }] }); // color fuera de la paleta
    bad({ teams: emptyTeams(9) });
  });
});
