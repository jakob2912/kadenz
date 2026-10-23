"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";

/** Länger hat keine Notiz im Katalog — auch die vom MCP-Server gesetzten nicht. */
const NOTIZ_MAX = 300;

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
    // Ablehnen statt still kürzen: eine abgeschnittene Notiz sähe aus, als
    // wäre sie so gemeint.
    if (notiz.trim().length > NOTIZ_MAX) throw new Error(`Höchstens ${NOTIZ_MAX} Zeichen.`);

    const text = notiz.trim() || null;
    const r = await prisma.uebung.updateMany({
      where: { einheit, name },
      data: { notiz: text },
    });
    if (r.count === 0) {
      throw new Error("Die Übung steht nicht im Katalog — die Notiz hätte keinen Platz.");
    }
    // Sonst zeigt der Router-Cache beim Zurück-Navigieren kurz die alte Notiz.
    revalidatePath("/training");
    return { ok: true, notiz: text };
  } catch (e) {
    /* Eine nicht erreichbare Datenbank meldet Prisma mit einem halben Roman;
       im Gym hilft der nicht weiter. */
    const text = e instanceof Error ? e.message : "Unbekannter Fehler";
    return { ok: false, fehler: text.length > 160 ? "Datenbank gerade nicht erreichbar." : text };
  }
}
