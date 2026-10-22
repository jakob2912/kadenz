import { prisma } from "@/lib/db";

/**
 * Alle Sätze als CSV — die eigenen Daten raus, ohne Supabase-Konsole.
 *
 * Semikolon und Dezimalkomma, weil Excel und Numbers in deutscher Einstellung
 * genau das erwarten; mit Komma als Trenner stünde jede Zeile in einer
 * einzigen Spalte. Das BOM am Anfang sagt Excel, dass es UTF-8 ist —
 * sonst heißt es dort "BankdrÃ¼cken".
 *
 * Geschützt wie jede andere Seite über den Proxy, falls KADENZ_PASSWORT
 * gesetzt ist.
 */
export async function GET() {
  const saetze = await prisma.setLog.findMany({
    orderBy: [{ workout: { date: "asc" } }, { loggedAt: "asc" }, { setIndex: "asc" }],
    select: {
      exercise: true,
      setIndex: true,
      kg: true,
      reps: true,
      loggedAt: true,
      sauber: true,
      workout: { select: { date: true, kind: true } },
    },
  });

  const zelle = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const zahl = (n: number) => String(n).replace(".", ",");
  const uhr = (d: Date) =>
    d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" });

  const zeilen = [
    "Datum;Einheit;Übung;Satz;kg;Wdh;Uhrzeit;Sauber",
    ...saetze.map((s) =>
      [
        s.workout.date.toISOString().slice(0, 10),
        s.workout.kind,
        zelle(s.exercise),
        String(s.setIndex + 1),
        zahl(s.kg),
        String(s.reps),
        uhr(s.loggedAt),
        s.sauber === null ? "" : s.sauber ? "ja" : "nein",
      ].join(";")
    ),
  ];

  const heute = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + zeilen.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kadenz-saetze-${heute}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
