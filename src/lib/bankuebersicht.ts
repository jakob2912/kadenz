/**
 * Kadenz — alles fürs Bankdrücken an einer Stelle
 *
 * Der Bank-Tab fragt vier Dinge auf einmal: was ist gelaufen, wo steht der
 * Zyklus, was kommt, und wie weit ist es noch bis 140 kg. Zusammengefasst in
 * EINEM Modul und in wenigen Abfragen, nicht je Karte eine — der Pool in db.ts
 * steht auf max 1, dort läuft nichts nebenläufig.
 *
 * Kein "use server": wird auch vom MCP-Server geladen. Dasselbe Muster wie
 * ernaehrung.ts und bank.ts.
 */

import {
  aktuellerTrainingsmax,
  bankstandFuer,
  trainingsmaxHistorie,
  type Bankstand,
  type Trainingsmax,
} from "./bank";
import { neustartsLesen, saetzeFuerMehrere } from "./kraftverlauf";
import { heuteWien } from "./datum";
import { prisma } from "./db";
import {
  datumFuerPushIndex,
  planVorschau,
  pushIndexAbDatum,
  pushTageAb,
  type Vorschautag,
} from "./plan";
import { kalenderLesen } from "./wochenplan";
import {
  BANK_UEBUNG,
  bankPlan,
  bankPosition,
  besterSatz,
  e1rm,
  SCHAETZUNG_TAGE,
  schaetzungAus,
  testPlan,
  type BankSatz,
  type BankWoche,
  type GeloggterSatz,
  type Zyklusanker,
} from "./kraft";
import { zielProjektion, type Zielstand } from "./bankziel";
import { bankcoach, prognose140, type Bankcoach, type Prognose } from "./bankcoach";

/**
 * Wie weit zurück der Bank-Tab liest.
 *
 * Ein Jahr statt der 120 Tage aus kraftverlauf.ts: dieser Tab ist die
 * Langzeitansicht einer einzigen Übung, und die Trainingsmax-Historie reicht
 * ohnehin bis zum Programmstart zurück. Die Datenmenge bleibt trotzdem klein —
 * drei Sätze je Bankeinheit, gut zwei Einheiten je Woche.
 */
export const BANK_FENSTER_TAGE = 365;

/** Eine Bankeinheit, wie sie in der Zeitleiste steht. */
export type Bankeinheit = {
  datum: string;
  saetze: GeloggterSatz[];
  /** Schwerster Satz des Tages, unsaubere übergangen. */
  best: GeloggterSatz | null;
  /** Geschätztes Maximum aus dem besten Satz. Null, wenn nichts verwertbar ist. */
  e1rm: number | null;
  /** Wurde an diesem Tag mindestens ein Satz als unsauber markiert? */
  unsauber: boolean;
};

export type Wochenvorschau = {
  zyklus: number;
  woche: BankWoche;
  /** Kalendertag dieses TM-Tags. */
  datum: string;
  saetze: BankSatz[];
  /** Deload-Woche — keine AMRAP-Zeile, bewusst leicht. */
  deload: boolean;
  /** Testtag statt Deload: Aufwärmen, dann Singles. */
  test: boolean;
};

/** Ein sauber gehobener Single. */
export type EchterPr = {
  kg: number;
  datum: string;
  /**
   * "geloggt": der schwerste saubere Single aus SetLog.
   * "eingetragen": von Jakob genannt (Einstellung bank_pr) — ein Bestwert aus
   * der Zeit vor den sauberen Singles in Kadenz, ohne Satz dahinter.
   */
  quelle: "geloggt" | "eingetragen";
};

const PR_SCHLUESSEL = "bank_pr";

/** Der eingetragene PR, falls es einen gibt und er lesbar ist. */
export async function eingetragenerPr(): Promise<EchterPr | null> {
  const zeile = await prisma.einstellung.findUnique({ where: { schluessel: PR_SCHLUESSEL } });
  if (!zeile) return null;
  try {
    const { kg, datum } = JSON.parse(zeile.wert) as { kg: unknown; datum: unknown };
    if (typeof kg !== "number" || typeof datum !== "string") return null;
    return { kg, datum, quelle: "eingetragen" };
  } catch {
    return null;
  }
}

/**
 * Der echte PR aus den geloggten Sätzen und dem eingetragenen Wert.
 *
 * Geloggt zählt nur ein Single, der nicht ausdrücklich als unsauber markiert
 * ist. Der eingetragene PR zählt, solange kein geloggter Single schwerer
 * ist; bei Gleichstand gewinnt der geloggte — der hat einen Satz dahinter.
 * Rein, damit die Bankdrücken-Seite und der MCP-Server (bank_coach) dieselbe Zahl nennen.
 */
export function echterPrAus(
  saetze: readonly { kg: number; reps: number; datum: string; sauber?: boolean | null }[],
  eingetragen: EchterPr | null
): EchterPr | null {
  let pr: EchterPr | null = null;
  for (const s of saetze) {
    if (s.reps !== 1 || s.sauber === false) continue;
    if (pr === null || s.kg > pr.kg) pr = { kg: s.kg, datum: s.datum, quelle: "geloggt" };
  }
  if (eingetragen && (pr === null || eingetragen.kg > pr.kg)) pr = eingetragen;
  return pr;
}

/** Den eingetragenen PR setzen — oder mit null entfernen. */
export async function prEintragen(pr: { kg: number; datum: string } | null): Promise<void> {
  if (pr === null) {
    await prisma.einstellung.deleteMany({ where: { schluessel: PR_SCHLUESSEL } });
    return;
  }
  const wert = JSON.stringify({ kg: pr.kg, datum: pr.datum });
  await prisma.einstellung.upsert({
    where: { schluessel: PR_SCHLUESSEL },
    update: { wert },
    create: { schluessel: PR_SCHLUESSEL, wert },
  });
}

export type Bankuebersicht = {
  tm: Trainingsmax | null;
  historie: Trainingsmax[];
  /** Der Stand am nächsten Push-Tag — Zyklus, Woche, Vorgabe. */
  stand: Bankstand | null;
  /** Kalendertag, auf den sich `stand` bezieht. */
  standTag: string;
  /** Die laufende und die nächste Programmwoche. */
  vorschau: Wochenvorschau[];
  einheiten: Bankeinheit[];
  ziel: Zielstand | null;
  /** Schwerster sauberer Single im Fenster — ein gehobenes Gewicht, keine Formel. */
  pr: EchterPr | null;
  /** Kalendertag des nächsten Testtags. */
  naechsterTest: string | null;
  /** Geschätztes Maximum der letzten Wochen — Grundlage des ersten Testversuchs. */
  schaetzung: number | null;
  /** Läuft es, steht es — und was tun? Null ohne Trainingsmax-Historie. */
  coach: Bankcoach | null;
  /** Wann 140 kg stünden, wenn es so weitergeht wie an den schweren Tagen. */
  prognose: Prognose | null;
};

/** Wie viele Tage die Plan-Vorschau reicht — weit genug für den nächsten Testtag. */
const VORSCHAU_TAGE = 120;

/** Wie weit der nächste Testtag gesucht wird: gut drei Zyklen. */
const TEST_SUCHE_PUSH_TAGE = 26;

/**
 * Der Tag, für den der Bank-Tab den Stand zeigt.
 *
 * Heute, wenn heute Push ist — sonst der nächste Push-Tag. Ein Rest Day soll
 * nicht "kein Bankdrücken" anzeigen und damit genau die Frage offenlassen, mit
 * der man diesen Tab öffnet: was steht als nächstes an.
 *
 * Aus der Vorschau des Plans (planVorschau()), also mit vorgezogenen und
 * nachgeholten Einheiten — nicht nach dem starren Wochentag.
 */
function naechsterPushTag(
  vorschau: readonly Vorschautag[]
): { iso: string; pushIndex: number } | null {
  const tag = vorschau.find((v) => v.einheit === "push" && v.pushIndex !== null);
  return tag ? { iso: tag.datum, pushIndex: tag.pushIndex! } : null;
}

/** Die Sätze eines Tages zu einer Einheit zusammenfassen. */
function zuEinheiten(saetze: GeloggterSatz[]): Bankeinheit[] {
  const gruppen = new Map<string, GeloggterSatz[]>();

  for (const s of saetze) {
    const liste = gruppen.get(s.datum);
    if (liste) liste.push(s);
    else gruppen.set(s.datum, [s]);
  }

  const einheiten: Bankeinheit[] = [];
  for (const [datum, liste] of gruppen) {
    /* besterSatz() übergeht unsaubere Sätze von selbst — das ist der Sinn der
       Markierung. Der Tag verschwindet deswegen nicht: er hat stattgefunden,
       die Sätze stehen in der Liste, und `unsauber` sagt, dass etwas dabei
       war. Was wegfällt, ist ausschließlich die Behauptung über die Kraft. */
    const best = (besterSatz(liste) as GeloggterSatz | null) ?? null;

    einheiten.push({
      datum,
      saetze: [...liste].sort((a, b) => a.kg - b.kg),
      best,
      e1rm: best ? e1rm(best) : null,
      unsauber: liste.some((s) => s.sauber === false),
    });
  }

  // Jüngste zuerst: der Tab beantwortet "was war zuletzt", nicht "wie fing es an".
  return einheiten.sort((a, b) => b.datum.localeCompare(a.datum));
}

/**
 * Was das Programm in dieser und der nächsten Woche vorsieht.
 *
 * Zwei Wochen und nicht der ganze Zyklus: die übernächste liegt zwölf Tage
 * entfernt, und bis dahin kann sich der Trainingsmax bewegt haben. Weiter weg
 * wäre eine Zahl mit Verfallsdatum.
 *
 * In Einerschritten gesucht, aber nur TM- und Testtage aufgenommen: nur jede
 * zweite Push-Einheit trägt die Welle (bankPosition()), die dazwischen läuft
 * submaximal und gehört nicht in eine Programmvorschau.
 */
function vorschauAb(
  pushIndex: number,
  anker: Zyklusanker,
  tmKg: number,
  schaetzung: number | null,
  tagVon: (pushIndex: number) => string | null
): Wochenvorschau[] {
  const out: Wochenvorschau[] = [];

  for (let n = 0; out.length < 2 && n < 10; n++) {
    const index = pushIndex + n;
    const pos = bankPosition(index, anker);
    if (pos.art !== "tm" && pos.art !== "test") continue;
    // Ein verfallener Platz kommt nicht mehr dran — siehe pushTageAb().
    const datum = tagVon(index);
    if (datum === null) continue;

    const test = pos.art === "test";
    out.push({
      zyklus: pos.zyklus,
      woche: pos.woche,
      datum,
      saetze: test ? testPlan(tmKg, schaetzung) : bankPlan(tmKg, pos.woche),
      deload: !test && pos.woche === 4,
      test,
    });
  }

  return out;
}

export async function bankuebersicht(): Promise<Bankuebersicht> {
  const heute = heuteWien();
  const { wahlen, eintraege } = await kalenderLesen();
  const plan = planVorschau(heute, wahlen, eintraege, VORSCHAU_TAGE);
  const tagVon = pushTageAb(heute, wahlen, eintraege, VORSCHAU_TAGE);
  const naechster = naechsterPushTag(plan);

  const [historie, saetze] = await Promise.all([
    trainingsmaxHistorie(24),
    saetzeFuerMehrere([BANK_UEBUNG], BANK_FENSTER_TAGE),
  ]);

  let stand: Bankstand | null = null;
  if (naechster) {
    try {
      stand = await bankstandFuer(naechster.pushIndex, wahlen, tagVon);
    } catch (e) {
      // Der Verlauf und die Historie stehen auch ohne den Stand. Diesen Tab
      // wegen einer nicht lesbaren Fortschreibung ganz zu leeren wäre falsch.
      console.error("Bankstand für die Übersicht nicht lesbar:", e);
    }
  }

  /* Nach bankstandFuer() lesen: das schreibt den Zyklus nötigenfalls fort, und
     danach steht ein anderer Trainingsmax da als davor. Die Reihenfolge ist
     hier kein Stil, sondern der Unterschied zwischen dem Wert von gestern und
     dem von heute. */
  const tm = stand?.tm ?? historie[0] ?? (await aktuellerTrainingsmax());

  const einheiten = zuEinheiten(saetze);

  const seit = new Date(Date.parse(`${heute}T00:00:00Z`) - SCHAETZUNG_TAGE * 864e5)
    .toISOString()
    .slice(0, 10);
  const schaetzung = schaetzungAus(saetze.filter((s) => s.datum >= seit && s.datum <= heute));

  let eingetragen: EchterPr | null = null;
  try {
    eingetragen = await eingetragenerPr();
  } catch (e) {
    console.error("Eingetragener PR nicht lesbar:", e);
  }
  const pr = echterPrAus(saetze, eingetragen);

  let vorschau: Wochenvorschau[] = [];
  let ziel: Zielstand | null = null;
  let naechsterTest: string | null = null;

  if (tm !== null && naechster !== null) {
    /* Der Anker ist der Anfang des LAUFENDEN Zyklus, nicht der des Programms:
       gueltigAb der jüngsten Trainingsmax-Zeile. Genau daran hängt seit dem
       Deload-Skip die Wochenzählung — siehe zyklusanker() in bank.ts. */
    const anker: Zyklusanker = {
      pushIndex: pushIndexAbDatum(tm.gueltigAb, wahlen),
      zyklus: tm.zyklus,
      tmKg: tm.tmKg,
    };

    vorschau = vorschauAb(naechster.pushIndex, anker, tm.tmKg, schaetzung, tagVon);

    for (let n = 0; n < TEST_SUCHE_PUSH_TAGE; n++) {
      if (bankPosition(naechster.pushIndex + n, anker).art === "test") {
        naechsterTest = tagVon(naechster.pushIndex + n);
        if (naechsterTest !== null) break;
      }
    }

    /* Die Projektion beginnt am Anfang des laufenden Zyklus, nicht heute: der
       Trainingsmax gilt für diesen Zyklus bereits, und ihn ab heute
       weiterzuzählen verschöbe die ganze Treppe um bis zu 24 Tage nach hinten. */
    ziel = zielProjektion(tm.tmKg, anker.zyklus, datumFuerPushIndex(anker.pushIndex, wahlen));
  }

  /* Der Coach sieht nur die schweren Tage — siehe schwereBankTage(). Die
     Historie hier reicht 24 Zyklen zurück, also weit über sein Fenster. */
  let coach: Bankcoach | null = null;
  let prognose: Prognose | null = null;
  try {
    const neustarts = await neustartsLesen();
    coach = bankcoach({
      saetze,
      tmHistorie: historie,
      tmKg: tm?.tmKg ?? null,
      heuteIso: heute,
      neustartAb: neustarts[BANK_UEBUNG],
    });
    prognose = prognose140(coach.urteil, heute);
  } catch (e) {
    // Ohne Coach steht der Rest des Tabs trotzdem.
    console.error("Bank-Coach nicht berechenbar:", e);
  }

  return {
    tm,
    historie,
    stand,
    standTag: naechster?.iso ?? heute,
    vorschau,
    einheiten,
    ziel,
    pr,
    naechsterTest,
    schaetzung,
    coach,
    prognose,
  };
}
