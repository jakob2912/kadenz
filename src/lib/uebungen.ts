/**
 * Kadenz — Übungskatalog
 *
 * Woher die Übungen einer Einheit kommen und wie sie sich ändern lassen.
 * Bis hierher standen sie als Konstante SESSIONS in plan.ts; eine Übung zu
 * tauschen brauchte ein Deployment.
 *
 * Kein "use server": das Modul wird auch vom MCP-Server geladen, und der
 * kennt Server Actions nicht. Dasselbe Muster wie ernaehrung.ts.
 */

import { prisma } from "./db";
import { wienerDatum } from "./datum";
import { datenbankKonfiguriert } from "./konfiguration";
import { bankPositionFuer, bankstandFuer, type Bankstand } from "./bank";
import { varianteFuer, type Variante } from "./kraft";
import {
  SESSIONS,
  mitHistorie,
  rotationFor,
  saetzeFuerTag,
  type PlannedExercise,
  type ZuPlanen,
} from "./plan";

export type Einheit = "push" | "pull";

export type Katalogeintrag = {
  id: string;
  einheit: Einheit;
  position: number;
  name: string;
  notiz: string | null;
  /** Nicht-null heißt: ein Programm gibt die Sätze vor. Bisher nur "531". */
  programm: string | null;
  /**
   * Nur in dieser Ausprägung der Einheit. Null heißt: in jeder.
   * Die Werte liefert varianteFuer() in kraft.ts.
   */
  variante: string | null;
  /** Wie viele Sätze die Übung vorsieht. Grundsätzlich 2. */
  saetze: number;
  /** Abweichende Satzanzahl an Bank-Tagen. Null heißt: keine Reduktion. */
  saetzeBankTag: number | null;
  startKg: number | null;
  startWdh: number[];
};

const PROGRAMM_BANK = "531";

// ─────────────────────────────────────────────────────────────
// Lesen
// ─────────────────────────────────────────────────────────────

export async function katalogLesen(einheit: Einheit): Promise<Katalogeintrag[]> {
  const zeilen = await prisma.uebung.findMany({
    where: { einheit },
    orderBy: { position: "asc" },
  });
  return zeilen as Katalogeintrag[];
}

export async function katalogVollstaendig(): Promise<Record<Einheit, Katalogeintrag[]>> {
  const zeilen = await prisma.uebung.findMany({
    orderBy: [{ einheit: "asc" }, { position: "asc" }],
  });
  return {
    push: zeilen.filter((z) => z.einheit === "push") as Katalogeintrag[],
    pull: zeilen.filter((z) => z.einheit === "pull") as Katalogeintrag[],
  };
}

/**
 * Katalog mit Rückfallebene.
 *
 * Im Gym zählt, dass der Plan dasteht — dieselbe Haltung wie in mitHistorie().
 * Ist die Datenbank weg, kommen die Übungen aus SESSIONS. Dann fehlt zwar der
 * Bank-Slot, aber acht Übungen sind besser als eine Fehlerseite.
 */
async function katalogMitRueckfall(einheit: Einheit): Promise<Katalogeintrag[]> {
  if (!datenbankKonfiguriert()) return ausSessions(einheit);

  try {
    const zeilen = await katalogLesen(einheit);
    if (zeilen.length > 0) return zeilen;
    console.error(`Übungskatalog für "${einheit}" ist leer, nutze SESSIONS.`);
  } catch (e) {
    console.error(`Übungskatalog für "${einheit}" nicht lesbar, nutze SESSIONS:`, e);
  }
  return ausSessions(einheit);
}

function ausSessions(einheit: Einheit): Katalogeintrag[] {
  return SESSIONS[einheit].exercises.map((ex, i) => ({
    id: `sessions-${einheit}-${i + 1}`,
    einheit,
    position: i + 1,
    name: ex.name,
    notiz: ex.note ?? null,
    programm: null,
    // Ohne Datenbank gibt es weder Trainingsmax noch Varianten: SESSIONS
    // beschreibt die Einheit in ihrer Grundform, und die gilt an jedem Tag.
    variante: null,
    saetze: ex.saetze,
    // Die Rückfallebene kennt keine Bank-Tage: ohne Datenbank gibt es keinen
    // Trainingsmax, also auch keinen Bank-Slot, von dem etwas abzuziehen wäre.
    saetzeBankTag: null,
    startKg: ex.last[0]?.kg ?? null,
    startWdh: ex.last.map((s) => s.reps),
  }));
}

/**
 * Ein Katalogeintrag als planbare Übung.
 *
 * `istBankTag` meint den TM-Tag und kommt aus dem Bankstand. An Pull-Tagen ist
 * er strukturell false — dort gibt es keinen Bankstand, die Reduktion kann
 * nicht zuschlagen. An der Zusatz-Einheit ebenfalls false: die ist submaximal,
 * sie kostet den übrigen Übungen nichts.
 */
function zuPlanen(eintrag: Katalogeintrag, istBankTag: boolean): ZuPlanen {
  return {
    name: eintrag.name,
    note: eintrag.notiz ?? undefined,
    saetze: saetzeFuerTag(eintrag, istBankTag),
    last: eintrag.startWdh.map((reps) => ({ reps, kg: eintrag.startKg ?? 0 })),
  };
}

// ─────────────────────────────────────────────────────────────
// Der Plan eines Tages
// ─────────────────────────────────────────────────────────────

export type Trainingsplan = {
  einheit: Einheit;
  titel: string;
  fokus: string;
  uebungen: PlannedExercise[];
  /** Nur an Push-Tagen gesetzt. Trägt auch die Auskunft "heute kein TM-Tag". */
  bank: Bankstand | null;
  /**
   * Welche Ausprägung der Einheit heute läuft — schwer, leicht, mit oder ohne
   * Presse. Mitgeführt statt in der Oberfläche neu abgeleitet: die Ableitung
   * braucht die Wellenposition aus der Datenbank, und die steht hier schon.
   */
  variante: Variante;
};

export type Tagesplan =
  | ({ art: "training" } & Trainingsplan)
  | {
      art: "pause";
      naechste: Trainingsplan;
      /** Kalendertag der nächsten Einheit, ISO. Nicht zwingend morgen. */
      naechsterTag: string;
    };

export async function einheitFuerTag(date: Date): Promise<Tagesplan> {
  const rotation = rotationFor(date);

  if (rotation.art === "pause") {
    const naechsterTag = naechsterTrainingstag(date);
    return {
      art: "pause",
      naechste: await trainingsplanFuer(new Date(`${naechsterTag}T12:00:00Z`)),
      naechsterTag,
    };
  }

  return { art: "training", ...(await trainingsplanFuer(date)) };
}

/**
 * Der nächste Tag mit einer Einheit, als ISO-Datum.
 *
 * Vorher stand hier schlicht "morgen": auf einen Rest Day folgte immer Push.
 * Mit eingeschobenen Rest Days stimmt das nicht mehr — zwei Pausentage
 * hintereinander sind möglich, und trainingsplanFuer() wirft für einen
 * Pausentag. Die Schranke von sieben Tagen ist großzügig: drei Tage Rotation
 * plus jeder denkbare Einschub liegen darunter. Wird sie erreicht, ist etwas
 * an den Einschüben falsch, und ein Fehler ist besser als eine Endlosschleife.
 */
function naechsterTrainingstag(date: Date): string {
  let tag = date;

  for (let n = 0; n < 7; n++) {
    tag = morgen(tag);
    if (rotationFor(tag).art === "training") return wienerDatum(tag);
  }

  throw new Error(
    `Ab ${wienerDatum(date)} steht in den nächsten sieben Tagen keine Einheit an. ` +
      `Das kann nur an den eingeschobenen Rest Days liegen.`
  );
}

/**
 * Der Folgetag, über den Wiener Kalendertag statt über +24 Stunden.
 *
 * In der Nacht auf den 25.10. hat der Tag in Wien 25 Stunden. `+864e5` landete
 * dort noch im selben Kalendertag, und der Rest Day hätte als "morgen" wieder
 * sich selbst angezeigt. 12:00 UTC liegt in beiden Zeitzonenlagen sicher
 * mitten im gemeinten Tag.
 */
function morgen(date: Date): Date {
  const heute = Date.parse(`${wienerDatum(date)}T00:00:00Z`);
  return new Date(new Date(heute + 864e5).toISOString().slice(0, 10) + "T12:00:00Z");
}

async function trainingsplanFuer(date: Date): Promise<Trainingsplan> {
  const rotation = rotationFor(date);

  /* Kann nur eintreten, wenn jemand diese Funktion für einen Pausentag
     aufruft. Dann ist der Fehler im Aufrufer, nicht in den Daten — lieber
     laut als mit einer stillen leeren Einheit. */
  if (rotation.art !== "training") {
    throw new Error(`${wienerDatum(date)} ist ein Rest Day, dafür gibt es keinen Plan.`);
  }

  const einheit = rotation.einheit;
  const texte = SESSIONS[einheit];
  const katalog = await katalogMitRueckfall(einheit);

  let bank: Bankstand | null = null;
  if (einheit === "push" && rotation.pushIndex !== null) {
    try {
      bank = await bankstandFuer(rotation.pushIndex);
    } catch (e) {
      // Ohne Trainingsmax fällt der Bank-Slot weg, der Rest der Einheit steht.
      console.error("Bankstand nicht lesbar:", e);
    }
  }

  /* Die Ausprägung des Tages.
     
     An Push-Tagen steckt die Wellenposition schon im Bankstand — die Abfrage
     ein zweites Mal zu stellen wäre eine überflüssige Rundreise. An Pull-Tagen
     gibt es keinen Bankstand, dort holt bankPositionFuer() nur die Position,
     ohne den Trainingsmax anzufassen.

     Fällt die Datenbank aus, bleibt es bei "ohne" bzw. "rein": beides sind die
     Ausprägungen ohne variantengebundene Übung, und der Katalog aus SESSIONS
     trägt ohnehin keine. So steht die Grundeinheit da, statt dass eine
     geratene Variante eine Presse einblendet, für die es keine Zahlen gibt. */
  let variante: Variante = einheit === "push" ? "ohne" : "rein";
  if (bank !== null) {
    variante = varianteFuer(einheit, bank.position);
  } else if (einheit === "pull" && datenbankKonfiguriert()) {
    try {
      variante = varianteFuer(einheit, await bankPositionFuer(rotation.bezugPushIndex));
    } catch (e) {
      console.error("Wellenposition für den Pull-Tag nicht lesbar:", e);
    }
  }

  /* Zwei verschiedene Fragen, die vorher eine waren.

     Ob heute schwer gebankt wird ("tm"), entscheidet über die Satzanzahl der
     übrigen Übungen: nur an diesen Tagen greift saetzeBankTag.

     Ob überhaupt gebankt wird, entscheidet über den Slot. Seit dem Zusatz-Slot
     steht Bankdrücken an jeder Push-Einheit, an der das Programm läuft — nur
     eben submaximal, wenn es kein TM-Tag ist. Die Vorgabe dafür kommt fertig
     aus bankstandFuer(); hier ist bloß zu entscheiden, ob der Slot mitkommt. */
  const istTmTag = bank !== null && bank.position.art === "tm";
  const bankSlot = bank !== null && bank.position.art !== "keiner";

  const geplant: ZuPlanen[] = [];
  for (const eintrag of katalog) {
    /* Der eigentliche Griff der Session-Varianten, und er ist bewusst genau
       eine Zeile: eine Übung ohne Variante gehört in jede Ausprägung, eine mit
       Variante nur in ihre. Alles Weitere — welcher Tag welche Ausprägung ist
       — steckt in varianteFuer(), und das ist eine reine Funktion, die ein
       Test ohne Datenbank greifen kann. */
    if (eintrag.variante !== null && eintrag.variante !== variante) continue;

    if (eintrag.programm === PROGRAMM_BANK) {
      // Vor dem Programmstart und in der Deload-Zusatzeinheit gibt es nichts
      // vorzugeben — dann bleibt der Slot weg statt leer dazustehen.
      if (!bankSlot) continue;
      geplant.push({ ...zuPlanen(eintrag, istTmTag), programm: bank!.vorgabe });
      continue;
    }
    geplant.push(zuPlanen(eintrag, istTmTag));
  }

  return {
    einheit,
    titel: texte.title,
    fokus: texte.focus,
    uebungen: await mitHistorie(geplant),
    bank,
    variante,
  };
}

// ─────────────────────────────────────────────────────────────
// Ändern
// ─────────────────────────────────────────────────────────────

export type Aenderung = { ok: true; katalog: Katalogeintrag[] } | { ok: false; fehler: string };

/**
 * Positionen einer Einheit in einem Rutsch neu vergeben.
 *
 * Zweistufig über negative Plätze: @@unique([einheit, position]) wird von
 * Postgres sofort geprüft, nicht erst am Ende der Transaktion. Wer Platz 3 auf
 * 4 schiebt, während 4 noch besetzt ist, läuft in den Konflikt — auch wenn am
 * Ende alles stimmen würde. Erst alle auf negative Plätze parken, dann auf die
 * endgültigen setzen: dazwischen kollidiert nichts, weil positive und negative
 * Plätze sich nie in die Quere kommen.
 *
 * Alle Änderungen laufen darüber, statt jede für sich zu verschieben. Eine
 * Regel, die immer gilt, ist leichter richtig zu halten als vier Sonderfälle.
 */
async function positionenSchreiben(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  einheit: Einheit,
  idsInReihenfolge: string[]
): Promise<void> {
  await tx.uebung.updateMany({
    where: { einheit },
    data: { position: { multiply: -1 } },
  });

  for (const [i, id] of idsInReihenfolge.entries()) {
    await tx.uebung.update({ where: { id }, data: { position: i + 1 } });
  }
}

function sauber(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Eine Übung durch eine andere ersetzen — der Fall, für den das Ganze gebaut ist.
 *
 * Die alte Zeile wird gelöscht, nicht stillgelegt. Ihre geloggten Sätze
 * bleiben davon unberührt: SetLog.exercise ist Freitext ohne Fremdschlüssel,
 * und der Kraftverlauf findet sie weiter unter ihrem Namen.
 */
export async function uebungTauschen(
  einheit: Einheit,
  alterName: string,
  neuerName: string,
  opts: {
    notiz?: string | null;
    startKg?: number | null;
    startWdh?: number[];
    saetze?: number;
    saetzeBankTag?: number | null;
  } = {}
): Promise<Aenderung> {
  const neu = sauber(neuerName);
  if (neu.length === 0) return { ok: false, fehler: "Die neue Übung braucht einen Namen." };

  try {
    const alt = await prisma.uebung.findUnique({
      where: { einheit_name: { einheit, name: sauber(alterName) } },
    });
    if (!alt) {
      return { ok: false, fehler: `"${alterName}" steht nicht in der ${einheit}-Einheit.` };
    }

    await prisma.uebung.update({
      where: { id: alt.id },
      data: {
        name: neu,
        notiz: opts.notiz ?? null,
        startKg: opts.startKg ?? null,
        startWdh: opts.startWdh ?? alt.startWdh,
        // Ein Tausch nimmt das Programm mit: wer Bankdrücken ersetzt, ersetzt
        // nicht den 5/3/1-Slot, sondern die Übung darin. Dasselbe gilt für die
        // Satzanzahl — der Platz im Split behält seinen Umfang, wenn nichts
        // anderes gesagt wird.
        programm: alt.programm,
        saetze: opts.saetze ?? alt.saetze,
        saetzeBankTag: opts.saetzeBankTag !== undefined ? opts.saetzeBankTag : alt.saetzeBankTag,
      },
    });

    return { ok: true, katalog: await katalogLesen(einheit) };
  } catch (e) {
    return { ok: false, fehler: fehlertext(e, neu, einheit) };
  }
}

export async function uebungHinzufuegen(
  einheit: Einheit,
  name: string,
  opts: {
    position?: number;
    notiz?: string | null;
    startKg?: number | null;
    startWdh?: number[];
    saetze?: number;
    saetzeBankTag?: number | null;
  } = {}
): Promise<Aenderung> {
  const neu = sauber(name);
  if (neu.length === 0) return { ok: false, fehler: "Die Übung braucht einen Namen." };

  try {
    const vorhanden = await katalogLesen(einheit);
    const stelle = Math.min(
      Math.max(1, opts.position ?? vorhanden.length + 1),
      vorhanden.length + 1
    );

    await prisma.$transaction(async (tx) => {
      const angelegt = await tx.uebung.create({
        data: {
          einheit,
          // Hinter allen bestehenden parken; die endgültige Position vergibt
          // positionenSchreiben() gleich darunter.
          position: vorhanden.length + 1,
          name: neu,
          notiz: opts.notiz ?? null,
          startKg: opts.startKg ?? null,
          startWdh: opts.startWdh ?? [],
          /* Ohne Angabe greift der Spalten-Default 2. Vorher entschied allein
             startWdh über die Satzanzahl, und das hier daneben stehende
             `?? []` hieß damit: keine Sätze. Genau daran ist der Adductor
             hängen geblieben. */
          ...(opts.saetze !== undefined ? { saetze: opts.saetze } : {}),
          ...(opts.saetzeBankTag !== undefined ? { saetzeBankTag: opts.saetzeBankTag } : {}),
        },
      });

      const ids = vorhanden.map((u) => u.id);
      ids.splice(stelle - 1, 0, angelegt.id);
      await positionenSchreiben(tx, einheit, ids);
    });

    return { ok: true, katalog: await katalogLesen(einheit) };
  } catch (e) {
    return { ok: false, fehler: fehlertext(e, neu, einheit) };
  }
}

export async function uebungEntfernen(einheit: Einheit, name: string): Promise<Aenderung> {
  try {
    const vorhanden = await katalogLesen(einheit);
    const weg = vorhanden.find((u) => u.name === sauber(name));
    if (!weg) {
      return { ok: false, fehler: `"${name}" steht nicht in der ${einheit}-Einheit.` };
    }

    await prisma.$transaction(async (tx) => {
      await tx.uebung.delete({ where: { id: weg.id } });
      await positionenSchreiben(
        tx,
        einheit,
        vorhanden.filter((u) => u.id !== weg.id).map((u) => u.id)
      );
    });

    return { ok: true, katalog: await katalogLesen(einheit) };
  } catch (e) {
    return { ok: false, fehler: fehlertext(e, name, einheit) };
  }
}

/**
 * Umbenennen — und zwar mitsamt der Historie.
 *
 * Das ist der Grund, warum diese Funktion existiert statt eines einfachen
 * UPDATE auf den Katalog. SetLog.exercise hält den Namen als Text; wird nur
 * der Katalog umgeschrieben, hängen die alten Sätze verwaist unter dem alten
 * Namen. Die Trainingsseite zeigte dann bei der Übung "noch nie geloggt" und
 * schlüge die Referenzgewichte vor, und ihr geschätztes Maximum im
 * Kraftverlauf begänne bei null — beides lautlos, ohne Fehlermeldung.
 *
 * Beides in einer Transaktion: entweder passt der Name überall oder nirgends.
 */
export async function uebungUmbenennen(
  einheit: Einheit,
  alterName: string,
  neuerName: string
): Promise<{ ok: true; saetzeUmgeschrieben: number } | { ok: false; fehler: string }> {
  const alt = sauber(alterName);
  const neu = sauber(neuerName);

  if (neu.length === 0) return { ok: false, fehler: "Der neue Name darf nicht leer sein." };
  if (alt === neu) return { ok: true, saetzeUmgeschrieben: 0 };

  try {
    return await prisma.$transaction(async (tx) => {
      const zeile = await tx.uebung.findUnique({
        where: { einheit_name: { einheit, name: alt } },
      });
      if (!zeile) {
        return { ok: false as const, fehler: `"${alt}" steht nicht in der ${einheit}-Einheit.` };
      }

      await tx.uebung.update({ where: { id: zeile.id }, data: { name: neu } });

      const { count } = await tx.setLog.updateMany({
        where: { exercise: alt },
        data: { exercise: neu },
      });

      return { ok: true as const, saetzeUmgeschrieben: count };
    });
  } catch (e) {
    return { ok: false, fehler: fehlertext(e, neu, einheit) };
  }
}

/**
 * Die Satzanzahl einer Übung setzen.
 *
 * Eigene Funktion statt eines Umwegs über uebungTauschen(): eine Übung auf
 * drei Sätze zu stellen ist kein Tausch, und wer sie dafür durch sich selbst
 * ersetzen müsste, verlöre dabei jedes Mal startKg und startWdh.
 *
 * `saetzeBankTag` ausdrücklich dreiwertig: fehlt der Wert, bleibt die
 * bestehende Regel stehen; null nimmt sie weg. Ohne diese Unterscheidung
 * würde jedes Setzen der Satzanzahl nebenbei die Bank-Tag-Regel löschen.
 */
export async function uebungSaetzeSetzen(
  einheit: Einheit,
  name: string,
  saetze: number,
  saetzeBankTag?: number | null
): Promise<Aenderung> {
  if (!Number.isInteger(saetze) || saetze < 1 || saetze > 10) {
    return { ok: false, fehler: "Die Satzanzahl muss zwischen 1 und 10 liegen." };
  }
  if (
    saetzeBankTag !== undefined &&
    saetzeBankTag !== null &&
    (!Number.isInteger(saetzeBankTag) || saetzeBankTag < 1 || saetzeBankTag > saetze)
  ) {
    return {
      ok: false,
      fehler:
        `Die Bank-Tag-Anzahl muss zwischen 1 und ${saetze} liegen. ` +
        `Mehr als sonst wäre keine Reduktion — dafür ist das Feld nicht da.`,
    };
  }

  try {
    const zeile = await prisma.uebung.findUnique({
      where: { einheit_name: { einheit, name: sauber(name) } },
    });
    if (!zeile) {
      return { ok: false, fehler: `"${name}" steht nicht in der ${einheit}-Einheit.` };
    }

    if (zeile.programm !== null) {
      return {
        ok: false,
        fehler:
          `"${zeile.name}" hängt am Programm "${zeile.programm}" — dort gibt der Zyklus die ` +
          `Sätze vor, eine Zahl hier hätte keine Wirkung.`,
      };
    }

    await prisma.uebung.update({
      where: { id: zeile.id },
      data: {
        saetze,
        ...(saetzeBankTag !== undefined ? { saetzeBankTag } : {}),
      },
    });

    return { ok: true, katalog: await katalogLesen(einheit) };
  } catch (e) {
    return { ok: false, fehler: fehlertext(e, name, einheit) };
  }
}

export async function uebungenUmsortieren(
  einheit: Einheit,
  namenInReihenfolge: string[]
): Promise<Aenderung> {
  try {
    const vorhanden = await katalogLesen(einheit);
    const gewuenscht = namenInReihenfolge.map(sauber);

    const bekannt = new Map(vorhanden.map((u) => [u.name, u.id]));
    const fehlend = gewuenscht.filter((n) => !bekannt.has(n));
    if (fehlend.length > 0) {
      return { ok: false, fehler: `Nicht in der ${einheit}-Einheit: ${fehlend.join(", ")}.` };
    }

    /* Die Liste muss vollständig sein. Eine Teilliste ließe offen, wo die
       übrigen Übungen landen — und "irgendwo dahinter" ist keine Antwort,
       die jemand vorhergesagt hätte. */
    if (gewuenscht.length !== vorhanden.length) {
      return {
        ok: false,
        fehler:
          `Die Reihenfolge nennt ${gewuenscht.length} von ${vorhanden.length} Übungen. ` +
          `Nenn alle, sonst ist nicht bestimmt, wohin der Rest kommt.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await positionenSchreiben(
        tx,
        einheit,
        gewuenscht.map((n) => bekannt.get(n)!)
      );
    });

    return { ok: true, katalog: await katalogLesen(einheit) };
  } catch (e) {
    return { ok: false, fehler: fehlertext(e, namenInReihenfolge.join(", "), einheit) };
  }
}

function fehlertext(e: unknown, name: string, einheit: Einheit): string {
  const code = (e as { code?: string })?.code;
  if (code === "P2002") {
    return `"${name}" steht schon in der ${einheit}-Einheit. Zwei gleiche Namen in einer Einheit gehen nicht — die geloggten Sätze wären danach nicht mehr zuzuordnen.`;
  }
  console.error("Übungskatalog nicht änderbar:", e);
  return "Die Änderung am Übungskatalog hat nicht geklappt.";
}
