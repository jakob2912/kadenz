import { describe, expect, it } from "vitest";
import { gleich, sicheresZiel } from "../zugang";

describe("sicheresZiel", () => {
  it("lässt eigene Pfade samt Suche durch", () => {
    expect(sicheresZiel("/training?einheit=push")).toBe("/training?einheit=push");
    expect(sicheresZiel("/")).toBe("/");
  });

  it("weist fremde Hosts in allen Schreibweisen ab", () => {
    for (const boese of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "/\tevil.com".replace("\t", "/\t/"),
      "/.//evil.com",
      "/..//evil.com",
      "/a/..//evil.com",
      "javascript:alert(1)",
    ]) {
      expect(sicheresZiel(boese), boese).toBe("/");
    }
  });

  it("nimmt bei Unsinn die Startseite", () => {
    expect(sicheresZiel(null)).toBe("/");
    expect(sicheresZiel(42)).toBe("/");
  });
});

describe("gleich", () => {
  it("vergleicht exakt", () => {
    expect(gleich("abc", "abc")).toBe(true);
    expect(gleich("abc", "abd")).toBe(false);
    expect(gleich("abc", "abcd")).toBe(false);
  });
});
