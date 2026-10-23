"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { heuteTauschen, heutigeTausche } from "./tagestausch";
import { uebungTauschen } from "./uebungen";
import { heuteWien } from "./datum";

/** Eine Meldung, die so beim Nutzer ankommen soll — alles andere ist ein Systemfehler. */
class Hinweis extends Error {}

/**
 * Eigene Meldungen durchreichen, alles andere zusammenfassen. Vorher
 * entschied die Länge: ein Prisma-Roman ist lang, aber eine eigene Meldung
 * mit langem Übungsnamen auch — und hieß dann fälschlich "Datenbank nicht
 * erreichbar".
 */
function meldung(e: unknown): string {
  if (e instanceof Hinweis) return e.message;
  console.error(e);
  return "Datenbank gerade nicht erreichbar.";
}

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
    if (einheit !== "push" && einheit !== "pull") throw new Hinweis("Unbekannte Einheit.");
    if (typeof name !== "string" || name.length === 0 || name.length > 100) {
      throw new Hinweis("Unbekannte Übung.");
    }
    if (typeof notiz !== "string") throw new Hinweis("Notiz fehlt.");
    // Ablehnen statt still kürzen: eine abgeschnittene Notiz sähe aus, als
    // wäre sie so gemeint.
    if (notiz.trim().length > NOTIZ_MAX) throw new Hinweis(`Höchstens ${NOTIZ_MAX} Zeichen.`);

    const text = notiz.trim() || null;
    const r = await prisma.uebung.updateMany({
      where: { einheit, name },
      data: { notiz: text },
    });
    if (r.count === 0) {
      throw new Hinweis("Die Übung steht nicht im Katalog — die Notiz hätte keinen Platz.");
    }
    // Sonst zeigt der Router-Cache beim Zurück-Navigieren kurz die alte Notiz.
    revalidatePath("/training");
    return { ok: true, notiz: text };
  } catch (e) {
    /* Eine nicht erreichbare Datenbank meldet Prisma mit einem halben Roman;
       im Gym hilft der nicht weiter. */
    return { ok: false, fehler: meldung(e) };
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
    if (einheit !== "push" && einheit !== "pull") throw new Hinweis("Unbekannte Einheit.");
    if (typeof dauerhaft !== "boolean") throw new Hinweis("Unklar, ob nur heute oder dauerhaft.");
    const name = typeof neu === "string" ? neu.trim().replace(/\s+/g, " ") : "";
    if (name.length === 0 || name.length > 100) {
      throw new Hinweis("Die neue Übung braucht einen Namen.");
    }
    if (typeof planName !== "string") throw new Hinweis("Unbekannte Übung.");

    const [katalog, tausche] = await Promise.all([
      prisma.uebung.findMany({ select: { einheit: true, name: true, programm: true } }),
      heutigeTausche(einheit),
    ]);
    const eintrag = katalog.find((k) => k.einheit === einheit && k.name === planName);
    if (!eintrag) throw new Hinweis(`"${planName}" steht nicht im Plan.`);
    if (eintrag.programm) {
      throw new Hinweis("Bankdrücken läuft nach Programm und lässt sich hier nicht tauschen.");
    }

    /* Zwei gleiche Namen in einer Einheit überschreiben sich die Sätze — die
       Datenbank kennt einen Satz nur als Einheit + Übung + Satznummer. Also
       nichts, was heute schon an einer anderen Stelle steht, und keine
       Programmübung, deren Sätze das 5/3/1 lesen würde. */
    const klein = name.toLowerCase();
    const zurueck = klein === planName.toLowerCase();
    const belegt = katalog.some(
      (k) =>
        k.name.toLowerCase() === klein &&
        ((k.einheit === einheit && k.name !== planName) || k.programm !== null)
    );
    const alsErsatz = Object.entries(tausche).some(
      ([alt, ersatz]) => alt !== planName && ersatz.toLowerCase() === klein
    );
    if (!zurueck && (belegt || alsErsatz)) {
      throw new Hinweis(`"${name}" steht heute schon im Plan. Nimm einen anderen Namen.`);
    }

    /* Was heute schon unter dem angezeigten Namen geloggt ist, hätte nach dem
       Tausch keine Zeile mehr. Der Logger bietet den Tausch dann gar nicht
       an; geprüft wird trotzdem hier, wo es gilt. */
    const angezeigt = tausche[planName] ?? planName;
    const schonGeloggt = await prisma.setLog.count({
      where: {
        exercise: angezeigt,
        workout: { kind: einheit, date: new Date(`${heuteWien()}T00:00:00Z`) },
      },
    });
    if (schonGeloggt > 0) {
      throw new Hinweis(`Für ${angezeigt} sind heute schon Sätze gespeichert — Tauschen geht nicht mehr.`);
    }

    if (dauerhaft) {
      const r = await uebungTauschen(einheit, planName, name);
      if (!r.ok) throw new Hinweis(r.fehler);
      // Ein Tagestausch unter dem alten Katalognamen hätte keinen Platz mehr.
      if (tausche[planName]) await heuteTauschen(einheit, planName, planName);
    } else {
      // "lat pulldown" für "Lat Pulldown" ist das Zurück, kein neuer Name.
      await heuteTauschen(einheit, planName, zurueck ? planName : name);
    }
    revalidatePath("/training");
    return { ok: true };
  } catch (e) {
    return { ok: false, fehler: meldung(e) };
  }
}
