"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { heuteWien } from "./datum";

/**
 * Jakobs Entscheidung über einen Kalorienvorschlag.
 *
 * Das ist die einzige Stelle im Projekt, an der ein Ernaehrungsziel entsteht.
 * Der Coach rechnet, schreibt einen Vorschlag und hört dort auf; das Ziel
 * ändert sich erst hier, und hierher kommt man nur über einen Tipp auf Ja.
 * Deshalb hat auch der MCP-Server keinen Zugriff auf diese Datei — ein
 * Werkzeugaufruf ist kein Ja.
 *
 * Die Fehlerform ist dieselbe wie bei satzSpeichern in workouts.ts und
 * gewichtEintragen in gewicht-actions.ts: { ok } statt geworfener Fehler.
 */

export type EntscheidungErgebnis =
  | { ok: true; kcal: number }
  | { ok: false; fehler: string };

export async function vorschlagAnnehmen(id: string): Promise<EntscheidungErgebnis> {
  // Eine Server Action ist ein offener POST-Endpunkt. Was von der Oberfläche
  // kommt, wird hier noch einmal geprüft.
  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, fehler: "Kein Vorschlag angegeben." };
  }

  try {
    const v = await prisma.kalorienvorschlag.findUnique({ where: { id } });
    if (!v) return { ok: false, fehler: "Diesen Vorschlag gibt es nicht mehr." };
    if (v.status !== "offen") {
      return { ok: false, fehler: `Der Vorschlag wurde bereits entschieden (${v.status}).` };
    }

    /* Beides in einer Transaktion, damit es das eine nie ohne das andere gibt:
       ein Vorschlag auf "angenommen" ohne neues Ziel wäre eine Entscheidung,
       die niemand sieht, ein Ziel ohne erledigten Vorschlag ein Vorschlag, der
       weiter zur Entscheidung auffordert.

       Gegen zwei gleichzeitige Ja-Tipps schützt der eindeutige Index auf
       Ernaehrungsziel.vorschlagId: der zweite Durchlauf kann kein zweites Ziel
       zu demselben Vorschlag anlegen, und die ganze Transaktion fällt zurück. */
    await prisma.$transaction([
      prisma.ernaehrungsziel.create({
        data: {
          // Ortsdatum statt UTC: ein Ja um 23:30 gilt ab heute, nicht ab morgen.
          gueltigAb: new Date(`${heuteWien()}T00:00:00Z`),
          kcal: v.kcalNeu,
          kohlenhydrateG: v.kohlenhydrateNeuG,
          eiweissG: v.eiweissG,
          fettG: v.fettG,
          // "coach" heißt laut Schema: vorgeschlagen von Kadenz UND bestätigt
          // von Jakob. Anders kommt eine solche Zeile nicht zustande.
          quelle: "coach",
          begruendung: v.begruendung,
          vorschlagId: v.id,
        },
      }),
      prisma.kalorienvorschlag.update({
        where: { id: v.id },
        data: { status: "angenommen", entschiedenAm: new Date(), offenSchluessel: null },
      }),
    ]);

    revalidatePath("/ernaehrung");
    return { ok: true, kcal: v.kcalNeu };
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

export async function vorschlagAblehnen(
  id: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, fehler: "Kein Vorschlag angegeben." };
  }

  try {
    /* Ein Nein wird ausdrücklich gespeichert und nicht bloß weggeklickt.
       Ohne die Zeile stünde derselbe Vorschlag beim nächsten Seitenaufruf
       wieder da — und das Ablehnen wäre eine Handlung ohne Wirkung. */
    const ergebnis = await prisma.kalorienvorschlag.updateMany({
      where: { id, status: "offen" },
      data: { status: "abgelehnt", entschiedenAm: new Date(), offenSchluessel: null },
    });

    if (ergebnis.count === 0) {
      return { ok: false, fehler: "Der Vorschlag ist nicht mehr offen." };
    }

    revalidatePath("/ernaehrung");
    return { ok: true };
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}
