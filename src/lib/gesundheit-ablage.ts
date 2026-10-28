import { prisma } from "./db";
import { heuteWien } from "./datum";
import type { DailyReadiness } from "./health-mapper";
import type { WeightEntry } from "./coach";

/**
 * Kadenz — die Google-Werte in der eigenen Datenbank
 *
 * Google Health bleibt die Quelle. Hier liegt die Abschrift, aus drei
 * Gründen:
 *
 *   - Die Verbindung läuft im Testmodus jede Woche ab. Bisher stand dann auf
 *     Heute, Verlauf und Essen nur "neu verbinden" — jetzt stehen die Werte
 *     bis zur letzten Nacht weiter da, mit einem Hinweis.
 *   - Diagramme über 90 und 365 Tage. Jeder Abruf holt dreißig Tage; ein Jahr
 *     Schlaf und HRV bei jedem Seitenaufruf zu holen wäre Sekunden.
 *   - Ein Gewicht, das Google gerade nicht annimmt, geht nicht verloren.
 *
 * Kein "use server": reine Hilfen für Server-Code.
 */

const tag = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Was ein Abruf geliefert hat, in die Tabellen schreiben — ein Statement je
 * Tabelle statt einer Zeile je Tag.
 *
 * Die beiden ältesten Tage des Fensters bleiben draußen: das Fenster
 * beginnt zu irgendeiner Uhrzeit, ein Abend-Abruf schneidet die HRV der
 * folgenden Nacht an, und ein Schnitt aus der halben Nacht würde den
 * richtigen Wert aus einem früheren, längeren Abruf überschreiben.
 *
 * Geschrieben wird nur, was sich geändert hat (IS DISTINCT FROM), damit
 * `aktualisiert` sagt, wann ein Wert wirklich neu kam.
 *
 * Gewichte, die Google im Fenster nicht mehr liefert, verschwinden auch hier
 * — sonst käme eine dort gelöschte Fehlmessung über die Ablage zurück. Nur
 * Abschriften, nicht was in Kadenz eingetragen wurde, als Google nichts
 * annahm.
 */
export async function ablegen(
  tage: DailyReadiness[],
  gewichte: WeightEntry[],
  fensterBeginn: string
): Promise<void> {
  const ab = sicherAb(fensterBeginn);
  const t = tage.filter((d) => d.date > ab);
  const g = gewichte.filter((w) => w.date > ab);

  if (t.length > 0) {
    await prisma.$executeRaw`
      INSERT INTO "Tageswert" ("datum", "schlafMin", "tiefschlafMin", "ruhepuls", "hrv", "aktualisiert")
      SELECT u.d::date, u.s, u.t, u.r, u.h, now()
      FROM unnest(
        ${t.map((d) => d.date)}::text[],
        ${t.map((d) => Math.round(d.sleepMin))}::int[],
        ${t.map((d) => Math.round(d.deepMin))}::int[],
        ${t.map((d) => d.restingHr)}::float8[],
        ${t.map((d) => d.hrv)}::float8[]
      ) AS u(d, s, t, r, h)
      ON CONFLICT ("datum") DO UPDATE SET
        "schlafMin" = EXCLUDED."schlafMin",
        "tiefschlafMin" = EXCLUDED."tiefschlafMin",
        "ruhepuls" = EXCLUDED."ruhepuls",
        "hrv" = EXCLUDED."hrv",
        "aktualisiert" = now()
      WHERE ("Tageswert"."schlafMin", "Tageswert"."tiefschlafMin", "Tageswert"."ruhepuls", "Tageswert"."hrv")
        IS DISTINCT FROM (EXCLUDED."schlafMin", EXCLUDED."tiefschlafMin", EXCLUDED."ruhepuls", EXCLUDED."hrv")`;
  }

  if (g.length > 0) {
    await prisma.$executeRaw`
      INSERT INTO "Gewichtsmessung" ("datum", "kg", "quelle", "aktualisiert")
      SELECT u.d::date, u.kg, 'google', now()
      FROM unnest(${g.map((w) => w.date)}::text[], ${g.map((w) => w.kg)}::float8[]) AS u(d, kg)
      ON CONFLICT ("datum") DO UPDATE SET "kg" = EXCLUDED."kg", "quelle" = 'google', "aktualisiert" = now()
      WHERE ("Gewichtsmessung"."kg", "Gewichtsmessung"."quelle") IS DISTINCT FROM (EXCLUDED."kg", 'google')`;
  }

  await prisma.$executeRaw`
    DELETE FROM "Gewichtsmessung"
    WHERE "quelle" = 'google'
      AND "datum" > ${ab}::date
      AND NOT ("datum" = ANY(${g.map((w) => w.date)}::date[]))`;
}

/** Der Tag nach dem Fensterbeginn — bis einschließlich dorthin wird nichts geschrieben. */
export function sicherAb(fensterBeginn: string): string {
  return iso(new Date(tag(fensterBeginn).getTime() + 864e5));
}

/** Die Nächte der letzten `tage` Tage, älteste zuerst. */
export async function tageswerteLesen(tage: number): Promise<DailyReadiness[]> {
  const zeilen = await prisma.tageswert.findMany({
    where: { datum: { gt: tag(vorTagen(tage)) } },
    orderBy: { datum: "asc" },
  });
  return zeilen.map((z) => ({
    date: iso(z.datum),
    sleepMin: z.schlafMin,
    deepMin: z.tiefschlafMin,
    restingHr: z.ruhepuls,
    hrv: z.hrv,
  }));
}

/**
 * Die Gewichte der letzten `tage` Tage, älteste zuerst. `nurKadenz`: nur
 * was es in Google nicht gibt — zum Ergänzen eines frischen Abrufs.
 */
export async function gewichteLesen(tage: number, nurKadenz = false): Promise<WeightEntry[]> {
  const zeilen = await prisma.gewichtsmessung.findMany({
    where: {
      datum: { gt: tag(vorTagen(tage)) },
      ...(nurKadenz ? { quelle: "kadenz" } : {}),
    },
    orderBy: { datum: "asc" },
  });
  return zeilen.map((z) => ({ date: iso(z.datum), kg: z.kg }));
}

/**
 * Zwei Gewichtsreihen zusammenführen: Google gewinnt, wo beide einen Tag
 * haben; Tage, die nur hier liegen (eingetragen, während Google abgelaufen
 * war), kommen dazu.
 */
export function gewichteVereinen(google: WeightEntry[], eigen: WeightEntry[]): WeightEntry[] {
  const nachTag = new Map(eigen.map((w) => [w.date, w]));
  for (const w of google) nachTag.set(w.date, w);
  return [...nachTag.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function vorTagen(tage: number, heute: string = heuteWien()): string {
  return iso(new Date(tag(heute).getTime() - tage * 864e5));
}

// ─────────────────────────────────────────────────────────────
// Einmal ein Jahr nachholen
// ─────────────────────────────────────────────────────────────

const RUECKFUELLUNG = "gesundheit_rueckfuellung";

type Merker = { erledigt?: string; versuch?: string };

/**
 * Ist die Rückfüllung heute (noch) dran? Nicht, wenn sie erledigt ist, und
 * nicht, wenn heute schon ein Versuch lief — ein Jahr Schlaf und HRV sind
 * dreißig und mehr Abrufe bei Google, und ein Fehlschlag soll nicht bei
 * jedem Seitenaufruf von vorn beginnen. Ein abgebrochener Versuch
 * (Zeitlimit der Funktion) zählt ebenfalls: der Merker steht vorher.
 */
export function rueckfuellungFaellig(wert: string | null, heute: string): boolean {
  if (!wert) return true;
  let m: Merker;
  try {
    m = JSON.parse(wert) as Merker;
  } catch {
    return true;
  }
  return !m.erledigt && m.versuch !== heute;
}

/** Pro Serverinstanz: nach dem ersten Blick in die Datenbank nicht jedes Mal neu fragen. */
let erledigt = false;
/** Und nicht zweimal gleichzeitig, wenn zwei Seiten im selben Moment rendern. */
let laeuft: Promise<void> | null = null;

/**
 * Ist das Jahr vor dem ersten Abruf schon nachgeholt? Wenn nicht, `holen`
 * aufrufen und sich den Tag merken. Läuft nach der Antwort (after()), damit
 * niemand auf ein Jahr Schlafdaten wartet.
 */
export async function rueckfuellenWennNoetig(holen: () => Promise<void>): Promise<void> {
  if (erledigt) return;
  laeuft ??= rueckfuellen(holen).finally(() => {
    laeuft = null;
  });
  return laeuft;
}

async function rueckfuellen(holen: () => Promise<void>): Promise<void> {
  const heute = heuteWien();
  const eintrag = await prisma.einstellung.findUnique({ where: { schluessel: RUECKFUELLUNG } });
  if (!rueckfuellungFaellig(eintrag?.wert ?? null, heute)) {
    // Erledigt gilt für immer; ein heutiger Fehlversuch nur bis morgen.
    if (eintrag && (JSON.parse(eintrag.wert) as Merker).erledigt) erledigt = true;
    return;
  }
  const schreiben = (m: Merker) =>
    prisma.einstellung.upsert({
      where: { schluessel: RUECKFUELLUNG },
      update: { wert: JSON.stringify(m) },
      create: { schluessel: RUECKFUELLUNG, wert: JSON.stringify(m) },
    });
  await schreiben({ versuch: heute });
  await holen();
  await schreiben({ versuch: heute, erledigt: heute });
  erledigt = true;
}
