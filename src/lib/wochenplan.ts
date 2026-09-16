/**
 * Kadenz — welcher Wochenplan gilt
 *
 * Die Rechnung steht rein in plan.ts. Hier liegt der Teil mit Datenbank: die
 * Planwechsel lesen und einen neuen eintragen.
 *
 * Kein "use server": das Modul wird auch vom MCP-Server geladen.
 */

import { prisma } from "./db";
import { heuteWien } from "./datum";
import { datenbankKonfiguriert } from "./konfiguration";
import {
  eingestellterWochenplan,
  rotationFor,
  type Planwechsel,
  type Rotation,
  type Wochenplan,
} from "./plan";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function tagVerschoben(isoTag: string, tage: number): string {
  return iso(new Date(Date.parse(`${isoTag}T00:00:00Z`) + tage * 864e5));
}

export function istWochenplan(wert: string): wert is Wochenplan {
  return wert === "werktage" || wert === "wochenende";
}

/**
 * Alle Planwechsel, aufsteigend.
 *
 * Ist die Datenbank nicht erreichbar, gilt der Standardplan: im Gym zählt,
 * dass ein Plan dasteht — dieselbe Haltung wie mitHistorie() in plan.ts.
 */
export async function wochenplaeneLesen(): Promise<Planwechsel[]> {
  if (!datenbankKonfiguriert()) return [];
  try {
    const zeilen = await prisma.planwechsel.findMany({ orderBy: { ab: "asc" } });
    return zeilen.flatMap((z) => (istWochenplan(z.plan) ? [{ ab: iso(z.ab), plan: z.plan }] : []));
  } catch (e) {
    console.error("Wochenplan nicht lesbar, nutze Werktage:", e);
    return [];
  }
}

/** rotationFor() mit den gespeicherten Planwechseln. */
export async function rotationMitPlan(date: Date): Promise<Rotation> {
  return rotationFor(date, await wochenplaeneLesen());
}

/** Der eingestellte Wochenplan, und ab wann er gilt. */
export async function aktuellerWochenplan(): Promise<{ plan: Wochenplan; ab: string | null }> {
  const plaene = await wochenplaeneLesen();
  return { plan: eingestellterWochenplan(plaene), ab: plaene.at(-1)?.ab ?? null };
}

/**
 * Auf einen Wochenplan umschalten.
 *
 * Ab wann der neue Plan gilt, entscheidet sich an dem, was schon trainiert
 * ist — der Schalter wird umgelegt, wenn ein Tag ausfällt:
 *   - Heute schon eine Einheit geloggt: ab morgen. Sonst verlöre die heutige
 *     Einheit ihren Platz im Plan, und ein heutiger Push würde morgen noch
 *     einmal verlangt.
 *   - Gestern war laut bisherigem Plan Training, aber nichts geloggt: ab
 *     gestern. Wer den Montag ausfallen lässt und erst am Dienstag umschaltet,
 *     bekommt so den Montags-Push am Dienstag, statt ihn zu überspringen.
 *   - Sonst ab heute.
 *
 * Spätere Wechsel werden dabei verworfen: der neue Plan gilt, bis wieder
 * umgeschaltet wird.
 */
export async function wochenplanSetzen(
  plan: Wochenplan
): Promise<{ ok: true; ab: string | null } | { ok: false; fehler: string }> {
  try {
    const heute = heuteWien();
    const gestern = tagVerschoben(heute, -1);
    const plaene = await wochenplaeneLesen();

    if (eingestellterWochenplan(plaene) === plan) return { ok: true, ab: null };

    const geloggt = await prisma.workout.findMany({
      where: {
        date: { in: [new Date(`${gestern}T00:00:00Z`), new Date(`${heute}T00:00:00Z`)] },
      },
      select: { date: true },
    });
    const tage = new Set(geloggt.map((w) => iso(w.date)));

    let ab = heute;
    if (tage.has(heute)) {
      ab = tagVerschoben(heute, 1);
    } else if (
      !tage.has(gestern) &&
      rotationFor(new Date(`${gestern}T12:00:00Z`), plaene).art === "training"
    ) {
      ab = gestern;
    }

    const abDatum = new Date(`${ab}T00:00:00Z`);
    await prisma.$transaction([
      prisma.planwechsel.deleteMany({ where: { ab: { gte: abDatum } } }),
      prisma.planwechsel.create({ data: { ab: abDatum, plan } }),
    ]);

    return { ok: true, ab };
  } catch (e) {
    console.error("Wochenplan nicht speicherbar:", e);
    return { ok: false, fehler: "Der Wochenplan konnte nicht gespeichert werden." };
  }
}
