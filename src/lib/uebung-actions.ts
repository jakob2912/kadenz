"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { heuteTauschen } from "./tagestausch";
import { uebungTauschen } from "./uebungen";

/** Länger nimmt diese Aktion keine Notiz an; der MCP-Server prüft dieselbe Grenze. */
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

/**
 * Eine Übung tauschen, direkt aus dem Logger — nur heute oder dauerhaft.
 *
 * Bisher ging das nur über den MCP-Server, also nicht im Gym, wo das Gerät
 * gerade belegt ist. "Nur heute" lässt den Katalog stehen (tagestausch.ts),
 * "dauerhaft" ersetzt die Übung im Katalog wie uebung_tauschen.
 *
 * Bankdrücken ist ausgenommen: dort hängt das 5/3/1 am Platz, und ein Tausch
 * aus dem Logger heraus nähme dem Programm stillschweigend die Übung. Das
 * bleibt eine bewusste Entscheidung über den MCP-Server.
 */
export async function uebungTauschenAktion(
  einheit: "push" | "pull",
  planName: string,
  neu: string,
  dauerhaft: boolean
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  try {
    if (einheit !== "push" && einheit !== "pull") throw new Error("Unbekannte Einheit.");
    const name = typeof neu === "string" ? neu.trim().replace(/\s+/g, " ") : "";
    if (name.length === 0 || name.length > 100) throw new Error("Die neue Übung braucht einen Namen.");
    if (typeof planName !== "string") throw new Error("Unbekannte Übung.");

    const eintrag = await prisma.uebung.findUnique({
      where: { einheit_name: { einheit, name: planName } },
      select: { programm: true },
    });
    if (!eintrag) throw new Error(`"${planName}" steht nicht im Plan.`);
    if (eintrag.programm) {
      throw new Error("Bankdrücken läuft nach Programm und lässt sich hier nicht tauschen.");
    }

    if (dauerhaft) {
      const r = await uebungTauschen(einheit, planName, name);
      if (!r.ok) throw new Error(r.fehler);
    } else {
      await heuteTauschen(einheit, planName, name);
    }
    revalidatePath("/training");
    return { ok: true };
  } catch (e) {
    const text = e instanceof Error ? e.message : "Unbekannter Fehler";
    return { ok: false, fehler: text.length > 160 ? "Datenbank gerade nicht erreichbar." : text };
  }
}
