import { prisma } from "./db";
import { heuteWien } from "./datum";
import {
  MIN_TAGE_ZWISCHEN_ANPASSUNGEN,
  kalorienAnpassung,
  type Anpassung,
  type Makros,
  type WeightEntry,
} from "./coach";

/**
 * Kadenz — Ernährung: Plan lesen, Ziel führen, Vorschläge verwalten.
 *
 * Bewusst KEINE Server-Action-Datei: dieselben Funktionen braucht der
 * MCP-Server in mcp/server.ts, und der läuft ohne Next, ohne Request und ohne
 * next/headers. Was Jakob entscheidet, steht dagegen in
 * ernaehrung-actions.ts — dort und nur dort wird ein Ziel gesetzt.
 *
 * Google Health kommt hier nicht vor. Die Gewichtsreihe wird hereingereicht,
 * weil die App sie aus dem Cookie holt und der MCP-Server aus der Datenbank;
 * dieses Modul hat mit beidem nichts zu tun.
 */

/** Fester Wert der Sperrspalte, siehe Kalorienvorschlag.offenSchluessel. */
const OFFEN = "offen";

export type Zutatplan = {
  name: string;
  menge: number;
  einheit: string;
  alternative: string | null;
};

export type Mahlzeitplan = {
  name: string;
  fenster: string;
  zutaten: Zutatplan[];
};

export type Ziel = Makros & {
  id: string;
  /** ISO-Kalendertag, ab dem das Ziel gilt. */
  gueltigAb: string;
  /** "plan" | "coach" | "jakob" — siehe Schema. */
  quelle: string;
  begruendung: string;
  /** ISO-Zeitstempel. */
  gesetztAm: string;
};

export type Vorschlag = {
  id: string;
  erstelltAm: string;
  kcalAlt: number;
  kcalNeu: number;
  kohlenhydrateAltG: number;
  kohlenhydrateNeuG: number;
  eiweissG: number;
  fettG: number;
  gemesseneRate: number;
  zielRate: number;
  begruendung: string;
};

/**
 * Entweder liegt ein Vorschlag vor — oder es steht da, warum nicht.
 *
 * Der zweite Fall ist der häufigere und der wichtigere. Ein leerer Bereich
 * würde bedeuten "alles in Ordnung", obwohl in Wahrheit oft "ich kann es
 * gerade nicht sagen" gilt. Das sind zwei verschiedene Aussagen.
 */
export type VorschlagLage =
  | { art: "vorschlag"; vorschlag: Vorschlag }
  | { art: "kein-vorschlag"; grund: string };

export async function mahlzeitenLesen(): Promise<Mahlzeitplan[]> {
  const zeilen = await prisma.mahlzeit.findMany({
    orderBy: { position: "asc" },
    include: { zutaten: { orderBy: { position: "asc" } } },
  });

  return zeilen.map((m) => ({
    name: m.name,
    fenster: m.fenster,
    zutaten: m.zutaten.map((z) => ({
      name: z.name,
      menge: z.menge,
      einheit: z.einheit,
      alternative: z.alternative,
    })),
  }));
}

/** Das derzeit gültige Ziel — die jüngste Zeile der Historie. */
export async function aktuellesZiel(): Promise<Ziel | null> {
  const zeile = await prisma.ernaehrungsziel.findFirst({
    orderBy: [{ gueltigAb: "desc" }, { gesetztAm: "desc" }],
  });
  return zeile ? alsZiel(zeile) : null;
}

/** Die Historie, jüngste zuerst. */
export async function zielHistorie(anzahl = 12): Promise<Ziel[]> {
  const zeilen = await prisma.ernaehrungsziel.findMany({
    orderBy: [{ gueltigAb: "desc" }, { gesetztAm: "desc" }],
    take: anzahl,
  });
  return zeilen.map(alsZiel);
}

/**
 * Der offene Vorschlag, falls einer da ist — ohne einen anzulegen.
 *
 * Für Leser, die nichts auslösen dürfen: der MCP-Server beantwortet damit
 * "steht gerade etwas zur Entscheidung an?", ohne dass die bloße Frage einen
 * Vorschlag erzeugt.
 */
export async function offenerVorschlag(): Promise<Vorschlag | null> {
  const zeile = await prisma.kalorienvorschlag.findFirst({
    where: { offenSchluessel: OFFEN },
  });
  return zeile ? alsVorschlag(zeile) : null;
}

/**
 * Stichtag der letzten echten Anpassung, ab dem neu gemessen wird.
 *
 * Der Ausgangsplan (quelle "plan") zählt ausdrücklich nicht: er lief schon
 * Monate, bevor die App davon wusste. Würde er die Uhr zurücksetzen, hieße es
 * ab dem Tag der Migration zwei Wochen lang "noch keine Aussage möglich",
 * obwohl die Gewichtsreihe längst zu diesem Plan gehört.
 */
async function letzteAnpassungTag(): Promise<string | null> {
  const zeile = await prisma.ernaehrungsziel.findFirst({
    where: { quelle: { not: "plan" } },
    orderBy: [{ gueltigAb: "desc" }, { gesetztAm: "desc" }],
    select: { gueltigAb: true },
  });
  return zeile ? isoTag(zeile.gueltigAb) : null;
}

/**
 * Liegt ein Vorschlag vor, und wenn nicht: warum nicht.
 *
 * Schreibt, wenn ein neuer Vorschlag fällig ist — deshalb ist der eindeutige
 * Index auf offenSchluessel nicht optional. Zwei gleichzeitige Seitenaufrufe
 * dürfen nicht zwei Vorschläge erzeugen, zwischen denen Jakob dann wählen
 * müsste, ohne dass einer davon gemeint war.
 */
export async function vorschlagLage(opts: {
  gewicht: WeightEntry[];
  koerpergewichtKg: number | null;
}): Promise<VorschlagLage> {
  const heute = heuteWien();

  const ziel = await aktuellesZiel();
  if (!ziel) {
    return {
      art: "kein-vorschlag",
      grund:
        "Es ist noch kein Kalorienziel hinterlegt. Ohne Ausgangswert lässt sich keine " +
        "Anpassung berechnen.",
    };
  }

  const neuester = await prisma.kalorienvorschlag.findFirst({
    orderBy: { erstelltAm: "desc" },
  });

  if (neuester) {
    const tage = tageZwischen(isoTag(neuester.erstelltAm), heute);

    /* Ein Vorschlag, der jünger als zehn Tage ist, wird nicht ersetzt — weder
       durch einen neuen noch durch ein neues "kein Vorschlag". Sonst änderte
       sich der Text unter Jakobs Daumen, während er ihn liest. */
    if (tage < MIN_TAGE_ZWISCHEN_ANPASSUNGEN) {
      if (neuester.status === OFFEN) {
        return { art: "vorschlag", vorschlag: alsVorschlag(neuester) };
      }
      return {
        art: "kein-vorschlag",
        grund: entschiedenGrund(neuester.status, tage),
      };
    }
  }

  const urteil = kalorienAnpassung({
    aktuell: {
      kcal: ziel.kcal,
      kohlenhydrateG: ziel.kohlenhydrateG,
      eiweissG: ziel.eiweissG,
      fettG: ziel.fettG,
    },
    gewicht: opts.gewicht,
    letzteAnpassung: await letzteAnpassungTag(),
    heute,
    koerpergewichtKg: opts.koerpergewichtKg,
  });

  if (neuester?.status === OFFEN) {
    /* Älter als zehn Tage und unverändert im Ergebnis: stehen lassen. Ein
       neuer Datensatz mit demselben Inhalt wäre nur eine zweite Zeile in der
       Historie, die dasselbe sagt. */
    if (urteil.art === "vorschlag" && urteil.anpassung.neu.kcal === neuester.kcalNeu) {
      return { art: "vorschlag", vorschlag: alsVorschlag(neuester) };
    }

    // updateMany statt update: läuft ins Leere statt zu werfen, falls Jakob
    // im selben Moment auf Ja getippt hat.
    await prisma.kalorienvorschlag.updateMany({
      where: { id: neuester.id, status: OFFEN },
      data: { status: "ersetzt", entschiedenAm: new Date(), offenSchluessel: null },
    });
  }

  if (urteil.art === "kein-vorschlag") return urteil;

  return { art: "vorschlag", vorschlag: alsVorschlag(await anlegen(ziel, urteil.anpassung)) };
}

async function anlegen(ziel: Ziel, a: Anpassung) {
  const daten = {
    kcalAlt: ziel.kcal,
    kcalNeu: a.neu.kcal,
    kohlenhydrateAltG: ziel.kohlenhydrateG,
    kohlenhydrateNeuG: a.neu.kohlenhydrateG,
    eiweissG: a.neu.eiweissG,
    fettG: a.neu.fettG,
    gemesseneRate: a.gemesseneRate,
    zielRate: a.zielRate,
    /* Die Eiweiß-Notiz wandert in die Begründung, statt eine eigene Spalte zu
       bekommen: sie gehört zu genau dieser Entscheidung und muss in fünf
       Monaten noch daneben stehen, wenn jemand fragt, warum damals nur die
       Kohlenhydrate erhöht wurden. */
    begruendung: a.eiweissNotiz ? `${a.begruendung}\n\n${a.eiweissNotiz}` : a.begruendung,
    status: OFFEN,
    offenSchluessel: OFFEN,
  };

  try {
    return await prisma.kalorienvorschlag.create({ data: daten });
  } catch {
    /* Der eindeutige Index hat zugeschlagen: ein zweiter Aufruf war schneller.
       Dann ist sein Vorschlag der richtige — nicht dieser. */
    const vorhanden = await prisma.kalorienvorschlag.findFirst({
      where: { offenSchluessel: OFFEN },
    });
    if (vorhanden) return vorhanden;
    throw new Error("Der Vorschlag ließ sich nicht anlegen.");
  }
}

function entschiedenGrund(status: string, tage: number): string {
  const alter =
    tage === 0 ? "heute" : tage === 1 ? "gestern" : `vor ${tage} Tagen`;
  const rest = MIN_TAGE_ZWISCHEN_ANPASSUNGEN - tage;
  const wartezeit = `Ich messe wieder — noch ${rest === 1 ? "ein Tag" : `${rest} Tage`}.`;

  if (status === "abgelehnt") {
    return `Du hast meinen letzten Vorschlag ${alter} abgelehnt. ${wartezeit}`;
  }
  if (status === "angenommen") {
    return `Das Ziel wurde ${alter} angepasst. ${wartezeit}`;
  }
  return `Der letzte Vorschlag ist ${alter} weggefallen. ${wartezeit}`;
}

type ZielZeile = {
  id: string;
  gueltigAb: Date;
  kcal: number;
  kohlenhydrateG: number;
  eiweissG: number;
  fettG: number;
  quelle: string;
  begruendung: string;
  gesetztAm: Date;
};

function alsZiel(z: ZielZeile): Ziel {
  return {
    id: z.id,
    gueltigAb: isoTag(z.gueltigAb),
    kcal: z.kcal,
    kohlenhydrateG: z.kohlenhydrateG,
    eiweissG: z.eiweissG,
    fettG: z.fettG,
    quelle: z.quelle,
    begruendung: z.begruendung,
    gesetztAm: z.gesetztAm.toISOString(),
  };
}

type VorschlagZeile = {
  id: string;
  erstelltAm: Date;
  kcalAlt: number;
  kcalNeu: number;
  kohlenhydrateAltG: number;
  kohlenhydrateNeuG: number;
  eiweissG: number;
  fettG: number;
  gemesseneRate: number;
  zielRate: number;
  begruendung: string;
};

function alsVorschlag(v: VorschlagZeile): Vorschlag {
  return {
    id: v.id,
    erstelltAm: v.erstelltAm.toISOString(),
    kcalAlt: v.kcalAlt,
    kcalNeu: v.kcalNeu,
    kohlenhydrateAltG: v.kohlenhydrateAltG,
    kohlenhydrateNeuG: v.kohlenhydrateNeuG,
    eiweissG: v.eiweissG,
    fettG: v.fettG,
    gemesseneRate: v.gemesseneRate,
    zielRate: v.zielRate,
    begruendung: v.begruendung,
  };
}

/**
 * Kalendertag eines Zeitstempels als ISO.
 *
 * Für DATE-Spalten liefert der Treiber Mitternacht UTC — dort ist toISOString
 * richtig. Für TIMESTAMP-Spalten (erstelltAm) ist es eine Näherung: zwischen
 * Mitternacht und 02:00 Wiener Zeit zählt der Tag davor. Bei einer Frist von
 * zehn Tagen ist das folgenlos, und der Alternativweg über die Zeitzone würde
 * hier eine Genauigkeit vortäuschen, die die Frist gar nicht hat.
 */
function isoTag(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function tageZwischen(vonIso: string, bisIso: string): number {
  return Math.round(
    (Date.parse(`${bisIso}T00:00:00Z`) - Date.parse(`${vonIso}T00:00:00Z`)) / 864e5
  );
}
