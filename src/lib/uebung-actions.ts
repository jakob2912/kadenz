"use server";

import { prisma } from "./db";

/**
 * Notiz zu einer Übung setzen — "Sitz Stufe 4", "Griff eng".
 *
 * Anders als die Notiz zur Einheit gehört sie zur Übung selbst und steht beim
 * nächsten Training wieder da (Hevy nennt das "Sticky Note"). Gespeichert
 * wird in Uebung.notiz, demselben Feld, das bisher nur über den MCP-Server
 * oder die Migration zu setzen war und im Logger unter dem Namen steht.
 *
 * Bewusst nur dieses eine Feld: Übungen tauschen, umbenennen und umsortieren
 * bleibt beim MCP-Server, wo uebungUmbenennen() die geloggten Sätze mit
 * umschreibt. Eine Notiz ändert nichts an der Historie.
 */
export async function uebungNotizSetzen(
  einheit: "push" | "pull",
  name: string,
  notiz: string
): Promise<{ ok: true; notiz: string | null } | { ok: false; fehler: string }> {
  try {
    if (einheit !== "push" && einheit !== "pull") throw new Error("Unbekannte Einheit.");
    if (typeof name !== "string" || name.length === 0 || name.length > 100) {
      throw new Error("Unbekannte Übung.");
    }
    if (typeof notiz !== "string") throw new Error("Notiz fehlt.");

    const text = notiz.trim().slice(0, 200) || null;
    const r = await prisma.uebung.updateMany({
      where: { einheit, name },
      data: { notiz: text },
    });
    if (r.count === 0) {
      throw new Error("Die Übung steht nicht im Katalog — die Notiz hätte keinen Platz.");
    }
    return { ok: true, notiz: text };
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}
