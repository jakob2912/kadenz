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
 * Der älteste Tag des Fensters bleibt draußen: das Fenster beginnt mitten in
 * dessen Nacht, und ein HRV-Schnitt aus der halben Nacht würde den richtigen
 * Wert aus einem früheren, längeren Abruf überschreiben.
 *
 * Geschrieben wird nur, was sich geändert hat (IS DISTINCT FROM), damit
 * `aktualisiert` sagt, wann ein Wert wirklich neu kam.
 */
export async function ablegen(
  tage: DailyReadiness[],
  gewichte: WeightEntry[],
  fensterBeginn: string
): Promise<void> {
  const t = tage.filter((d) => d.date > fensterBeginn);
  const g = gewichte.filter((w) => w.date > fensterBeginn);

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
      INSERT INTO "Gewichtsmessung" ("datum", "kg", "aktualisiert")
      SELECT u.d::date, u.kg, now()
      FROM unnest(${g.map((w) => w.date)}::text[], ${g.map((w) => w.kg)}::float8[]) AS u(d, kg)
      ON CONFLICT ("datum") DO UPDATE SET "kg" = EXCLUDED."kg", "aktualisiert" = now()
      WHERE "Gewichtsmessung"."kg" IS DISTINCT FROM EXCLUDED."kg"`;
  }
}

/** Ein eingetragenes Gewicht sofort festhalten — auch wenn Google es ablehnt. */
export async function gewichtAblegen(datum: string, kg: number): Promise<void> {
  await prisma.gewichtsmessung.upsert({
    where: { datum: tag(datum) },
    update: { kg },
    create: { datum: tag(datum), kg },
  });
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

/** Die Gewichte der letzten `tage` Tage, älteste zuerst. */
export async function gewichteLesen(tage: number): Promise<WeightEntry[]> {
  const zeilen = await prisma.gewichtsmessung.findMany({
    where: { datum: { gt: tag(vorTagen(tage)) } },
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
  const eintrag = await prisma.einstellung.findUnique({ where: { schluessel: RUECKFUELLUNG } });
  if (eintrag) {
    erledigt = true;
    return;
  }
  await holen();
  await prisma.einstellung.upsert({
    where: { schluessel: RUECKFUELLUNG },
    update: { wert: heuteWien() },
    create: { schluessel: RUECKFUELLUNG, wert: heuteWien() },
  });
  erledigt = true;
}
