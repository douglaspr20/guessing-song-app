import { describe, expect, it } from "vitest";
import { canonicalTitle, isCorrectArtist, isCorrectGuess } from "@/lib/game/matcher";

describe("canonicalTitle", () => {
  it("quita sufijos, paréntesis, tildes y artículos", () => {
    expect(canonicalTitle("Despacito - Remix")).toBe("despacito");
    expect(canonicalTitle("Hey Jude - Remastered 2015")).toBe("hey jude");
    expect(canonicalTitle("Bailando (feat. Descemer Bueno & Gente De Zona)")).toBe("bailando");
    expect(canonicalTitle("La Bamba")).toBe("bamba");
    expect(canonicalTitle("Canción Animal")).toBe("cancion animal");
  });
});

describe("isCorrectGuess", () => {
  it.each([
    ["despacito", "Despacito - Remix"],
    ["Bohemian Rapsody", "Bohemian Rhapsody - Remastered 2011"],
    ["la bamba", "La Bamba"],
    ["bamba", "La Bamba"],
    ["cancion animal", "Canción Animal"],
    ["De música ligera", "De Música Ligera"],
    ["hotel california", "Hotel California - 2013 Remaster"],
    ["Livin la vida loca", "Livin' la Vida Loca"],
    ["rock and roll", "Rock & Roll"],
    ["Bailando feat Descemer Bueno", "Bailando (feat. Descemer Bueno & Gente De Zona)"],
    ["Sweet child o mine", "Sweet Child O' Mine"],
  ])("acepta %j para %j", (guess, title) => {
    expect(isCorrectGuess(guess, title)).toBe(true);
  });

  it.each([
    ["bohemian", "Bohemian Rhapsody"],
    ["hey", "Hey Ya!"],
    ["Yesterday", "Let It Be"],
    ["", "Despacito"],
    ["ella", "Ella Elle L'a"],
    ["sol", "Gol"],
  ])("rechaza %j para %j", (guess, title) => {
    expect(isCorrectGuess(guess, title)).toBe(false);
  });
});

describe("isCorrectArtist", () => {
  it.each([
    ["beatles", ["The Beatles"]],
    ["soda estereo", ["Soda Stereo"]],
    ["gente de zona", ["Enrique Iglesias", "Descemer Bueno", "Gente De Zona"]],
    ["acdc", ["AC/DC"]],
    ["Beyonce", ["Beyoncé"]],
    ["ABBA", ["ABBA"]],
  ])("acepta %j para %j", (guess, artists) => {
    expect(isCorrectArtist(guess, artists)).toBe(true);
  });

  it.each([
    ["queen", ["The Beatles"]],
    ["", ["Soda Stereo"]],
    ["abb", ["ABBA"]],
  ])("rechaza %j para %j", (guess, artists) => {
    expect(isCorrectArtist(guess, artists)).toBe(false);
  });
});
