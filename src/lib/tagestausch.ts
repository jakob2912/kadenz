import { prisma } from "./db";
import { heuteWien } from "./datum";

/**
 * Kadenz — eine Übung nur für heute tauschen
 *
 * Gerät belegt, Schulter zwickt: heute Kurzhantel statt Maschine, morgen
 * wieder wie geplant. Der Katalog bleibt dafür unangetastet. Gespeichert ist
 * nur, was heute an welcher Stelle steht, und zwar am Kalendertag: morgen
 * gilt der Eintrag nicht mehr, ohne dass ihn jemand löschen muss.
 *
 * Eine Zeile in Einstellung genügt, getrennt je Einheit — wer an einem Tag
 * Push und Pull trainiert, verliert den einen Tausch nicht durch den anderen.
 * Die Sätze der Ersatzübung landen unter ihrem eigenen Namen in SetLog;
 * ihr Kraftverlauf beginnt also sauber für sich, statt die Zahlen der
 * eigentlichen Übung zu verfälschen.
 *
 * Nach Mitternacht ist der Tausch weg — wie die laufende Einheit selbst,
 * die der Logger ebenfalls nur am heutigen Kalendertag sucht.
 */

const SCHLUESSEL = "tagestausch";

type Einheit = "push" | "pull";
type Ablage = { datum: string; ersetzt: Partial<Record<Einheit, Record<string, string>>> };

async function lesen(datum: string): Promise<Ablage> {
  const leer: Ablage = { datum, ersetzt: {} };
  const zeile = await prisma.einstellung.findUnique({ where: { schluessel: SCHLUESSEL } });
  if (!zeile) return leer;
  try {
    const a = JSON.parse(zeile.wert) as Ablage;
    return a.datum === datum && a.ersetzt && typeof a.ersetzt === "object" ? a : leer;
  } catch {
    return leer;
  }
}

/** Was heute in dieser Einheit getauscht ist: alter Name → neuer Name. */
export async function heutigeTausche(
  einheit: Einheit,
  datum: string = heuteWien()
): Promise<Record<string, string>> {
  return (await lesen(datum)).ersetzt[einheit] ?? {};
}

/**
 * Einen Tausch für heute eintragen. `planName` ist der Name aus dem Katalog,
 * nicht der heute angezeigte — wer zweimal tauscht, ersetzt den ersten
 * Tausch, statt eine Kette zu bauen. Ist `neu` wieder der Katalogname, wird
 * der Tausch aufgehoben.
 */
export async function heuteTauschen(
  einheit: Einheit,
  planName: string,
  neu: string
): Promise<Record<string, string>> {
  const datum = heuteWien();
  const ablage = await lesen(datum);
  const ersetzt = { ...(ablage.ersetzt[einheit] ?? {}) };
  if (neu === planName) delete ersetzt[planName];
  else ersetzt[planName] = neu;

  const wert = JSON.stringify({
    datum,
    ersetzt: { ...ablage.ersetzt, [einheit]: ersetzt },
  } satisfies Ablage);
  await prisma.einstellung.upsert({
    where: { schluessel: SCHLUESSEL },
    update: { wert },
    create: { schluessel: SCHLUESSEL, wert },
  });
  return ersetzt;
}
