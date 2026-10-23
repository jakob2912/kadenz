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
 * Eine Zeile in Einstellung genügt — es gibt immer nur einen heutigen Tag.
 * Die Sätze der Ersatzübung landen unter ihrem eigenen Namen in SetLog;
 * ihr Kraftverlauf beginnt also sauber für sich, statt die Zahlen der
 * eigentlichen Übung zu verfälschen.
 */

const SCHLUESSEL = "tagestausch";

type Ablage = { datum: string; einheit: "push" | "pull"; ersetzt: Record<string, string> };

async function lesen(): Promise<Ablage | null> {
  const zeile = await prisma.einstellung.findUnique({ where: { schluessel: SCHLUESSEL } });
  if (!zeile) return null;
  try {
    return JSON.parse(zeile.wert) as Ablage;
  } catch {
    return null;
  }
}

/** Was heute in dieser Einheit getauscht ist: alter Name → neuer Name. */
export async function heutigeTausche(
  einheit: "push" | "pull",
  datum: string = heuteWien()
): Promise<Record<string, string>> {
  const ablage = await lesen();
  return ablage && ablage.datum === datum && ablage.einheit === einheit ? ablage.ersetzt : {};
}

/**
 * Einen Tausch für heute eintragen. `planName` ist der Name aus dem Katalog,
 * nicht der heute angezeigte — wer zweimal tauscht, ersetzt den ersten
 * Tausch, statt eine Kette zu bauen. Ist `neu` wieder der Katalogname, wird
 * der Tausch aufgehoben.
 */
export async function heuteTauschen(
  einheit: "push" | "pull",
  planName: string,
  neu: string
): Promise<Record<string, string>> {
  const datum = heuteWien();
  const bisher = await heutigeTausche(einheit, datum);
  const ersetzt = { ...bisher };
  if (neu === planName) delete ersetzt[planName];
  else ersetzt[planName] = neu;

  const wert = JSON.stringify({ datum, einheit, ersetzt } satisfies Ablage);
  await prisma.einstellung.upsert({
    where: { schluessel: SCHLUESSEL },
    update: { wert },
    create: { schluessel: SCHLUESSEL, wert },
  });
  return ersetzt;
}
