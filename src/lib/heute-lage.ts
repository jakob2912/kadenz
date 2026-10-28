/**
 * Kadenz — läuft alles nach Plan?
 *
 * Die eine Zeile oben auf der Startseite: "Bench and weight on track." oder,
 * wenn nicht, was zu tun ist, damit es wieder passt. Rein und ohne
 * Datenbank, damit sich die Schwellen prüfen lassen.
 */

import type { CoachLage } from "./bankcoach";

/** ~6000 kcal je kg im Aufbau, wie in coach.ts. */
const KCAL_PRO_KG = 6000;
/** Über wie viele Tage eine Abweichung vom Gewichtsplan aufgeholt werden soll. */
const AUFHOLTAGE = 14;
/** Bis hierher gilt das Gewicht als auf Plan — die Tagesschwankung ist größer. */
const TOLERANZ_KG = 0.5;

export type Lage = {
  /** Alles auf Kurs? Dann steht nur der Titel da. */
  aufKurs: boolean;
  titel: string;
  /** Was zu tun ist, je ein Satz. Leer, wenn alles passt. */
  schritte: string[];
};

function kg(n: number): string {
  return n.toFixed(1);
}

/** Auf 50 kcal gerundet, mindestens 100, höchstens 500 am Tag. */
function kcalProTag(abweichungKg: number): number {
  const roh = (Math.abs(abweichungKg) * KCAL_PRO_KG) / AUFHOLTAGE;
  return Math.min(500, Math.max(100, Math.round(roh / 50) * 50));
}

export function lageHeute(e: {
  /** Gleitender 7-Tage-Schnitt, sonst die letzte Messung. */
  gewichtKg: number | null;
  /** Wo der Gewichtsplan heute steht. */
  sollKg: number | null;
  /** Null ohne Trainingsmax-Historie. */
  bank: { lage: CoachLage; vorschlag: string; zielImPlan: boolean | null } | null;
}): Lage {
  const schritte: string[] = [];

  if (e.gewichtKg !== null && e.sollKg !== null) {
    const ab = e.gewichtKg - e.sollKg;
    if (ab < -TOLERANZ_KG) {
      schritte.push(
        `Weight is ${kg(-ab)} kg under plan — eat about ${kcalProTag(ab)} kcal more per day for two weeks.`
      );
    } else if (ab > TOLERANZ_KG) {
      schritte.push(
        `Weight is ${kg(ab)} kg over plan — eat about ${kcalProTag(ab)} kcal less per day for two weeks.`
      );
    }
  }

  /* Auf Kurs heißt bei der Bank: die schweren Tage legen zu und das Ziel ist
     noch drin. "Zu wenig Daten" oder gar kein Coach ist keine Aussage — dann
     behauptet die Zeile auch nichts über die Bank. */
  let bankBekannt = false;
  if (e.bank && e.bank.lage !== "unklar") {
    bankBekannt = true;
    if (e.bank.lage === "steht" || e.bank.lage === "faellt") {
      schritte.push(`Bench: ${e.bank.vorschlag}`);
    } else if (e.bank.zielImPlan === false) {
      schritte.push(`Bench: 140 kg by the end of 2027 is out of reach at the current pace. ${e.bank.vorschlag}`);
    }
  }
  const gewichtBekannt = e.gewichtKg !== null && e.sollKg !== null;

  const aufKurs = schritte.length === 0;
  let titel = "Not quite on plan";
  if (aufKurs) {
    if (bankBekannt && gewichtBekannt) titel = "Bench and weight on track.";
    else if (gewichtBekannt) titel = "Weight on track — not enough bench data yet.";
    else if (bankBekannt) titel = "Bench on track — no recent weight to compare.";
    else titel = "Not enough data yet to judge.";
  }
  return { aufKurs, titel, schritte };
}
