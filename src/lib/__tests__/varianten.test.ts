import { describe, expect, it } from "vitest";
import {
  amrapPushIndex,
  bankPosition,
  PUSH_TAGE_JE_ZYKLUS,
  besterSatz,
  e1rmReihe,
  istPressvariante,
  varianteFuer,
  type GeloggterSatz,
} from "../kraft";
import { rotationFor } from "../plan";
import { TAGE_JE_ZYKLUS, ZIEL_TM_KG, zielProjektion, zielSatz } from "../bankziel";

/**
 * Der Programmstart aus Jakobs Daten: Zyklus 1 gilt ab dem 20.08.2026, und
 * pushIndexAbDatum() macht daraus den Push-Index 2. Alle Versätze hier sind
 * relativ dazu — Versatz 0 ist der erste TM-Tag.
 */
const START = 2;
const ANKER = { pushIndex: START, zyklus: 1 };

function positionBei(versatz: number) {
  return bankPosition(START + versatz, ANKER);
}

describe("varianteFuer", () => {
  it("macht aus dem TM-Tag die schwere Push-Variante", () => {
    expect(varianteFuer("push", positionBei(0))).toBe("schwer");
    expect(varianteFuer("push", positionBei(2))).toBe("schwer");
  });

  it("macht aus der Push-Einheit dazwischen die leichte Variante", () => {
    expect(varianteFuer("push", positionBei(1))).toBe("leicht");
    expect(varianteFuer("push", positionBei(3))).toBe("leicht");
  });

  it("lässt die Presse in der Deload-Woche weg", () => {
    /* Versatz 6 ist der TM-Tag der vierten Woche, Versatz 7 wäre die
       Zusatz-Einheit — die fällt im Deload aus (bankPosition() gibt "keiner").
       72,5 % lägen über jedem Satz der Deload-Woche, und eine Woche, deren
       Zweck das Zurücknehmen ist, wäre damit die schwerere. */
    expect(positionBei(6).woche).toBe(4);
    expect(varianteFuer("push", positionBei(6))).toBe("schwer");
    expect(varianteFuer("push", positionBei(7))).toBe("ohne");
  });

  it("setzt die Spoto Press auf das Pull nach einer leichten Push-Einheit", () => {
    // Der Bezug eines Pull-Tags ist der Push-Tag davor. Lag dort die leichte
    // Einheit, kommen heute die zwei Sätze dazu.
    expect(varianteFuer("pull", positionBei(1))).toBe("presse");
    expect(varianteFuer("pull", positionBei(3))).toBe("presse");
  });

  it("lässt das Pull nach dem schweren Tag rein", () => {
    // Am Tag nach der schwersten Bankeinheit kommt nichts Zusätzliches auf
    // die Brust.
    expect(varianteFuer("pull", positionBei(0))).toBe("rein");
    expect(varianteFuer("pull", positionBei(2))).toBe("rein");
  });

  it("lässt auch die Pull-Tage der Deload-Woche ohne Presse", () => {
    expect(varianteFuer("pull", positionBei(6))).toBe("rein");
    expect(varianteFuer("pull", positionBei(7))).toBe("rein");
  });

  it("gibt vor dem Programmstart keine Presse aus", () => {
    const vorher = bankPosition(START - 1, ANKER);
    expect(vorher.art).toBe("keiner");
    expect(varianteFuer("push", vorher)).toBe("ohne");
    expect(varianteFuer("pull", vorher)).toBe("rein");
  });
});

describe("rotationFor trägt den Bezugs-Push-Index", () => {
  it("nennt an einem Push-Tag ihn selbst", () => {
    // 09.09.2026 ist laut Rotation ein Push-Tag mit Index 8.
    const r = rotationFor(new Date("2026-09-09T12:00:00Z"));
    if (r.art !== "training") throw new Error("kein Trainingstag");
    expect(r.einheit).toBe("push");
    expect(r.pushIndex).toBe(8);
    expect(r.bezugPushIndex).toBe(8);
  });

  it("nennt an einem Pull-Tag den Push-Tag davor", () => {
    const r = rotationFor(new Date("2026-09-10T12:00:00Z"));
    if (r.art !== "training") throw new Error("kein Trainingstag");
    expect(r.einheit).toBe("pull");
    // pushIndex bleibt null: an einem Pull-Tag wird nicht gebankt, und
    // bankstandFuer() darf von hier aus nichts fortschreiben.
    expect(r.pushIndex).toBeNull();
    expect(r.bezugPushIndex).toBe(8);
  });

  it("bildet Jakobs eigene Beispieltage ab", () => {
    /* Fr, 28.08. lief schwer (62,5/72,5/80 kg — Woche 2), Mo, 31.08. leicht
       (dreimal 65 kg). Genau diese Abwechslung meinte der Wunsch mit
       "Freitag schwer, Montag leicht"; der Wochentag selbst trägt sie nicht —
       am 21.09. fällt Push wieder auf einen Montag, und dann ist es ein
       schwerer Tag. */
    const freitag = rotationFor(new Date("2026-08-28T12:00:00Z"));
    const montag = rotationFor(new Date("2026-08-31T12:00:00Z"));
    if (freitag.art !== "training" || montag.art !== "training") {
      throw new Error("kein Trainingstag");
    }

    expect(varianteFuer("push", bankPosition(freitag.bezugPushIndex, ANKER))).toBe("schwer");
    expect(varianteFuer("push", bankPosition(montag.bezugPushIndex, ANKER))).toBe("leicht");
  });
});

describe("Zyklus vorziehen (Deload überspringen)", () => {
  /* Jakob am 07.09.2026: "das fühlt sich zu leicht an, skip den Deload, ich
     sage direkt Zyklus 2 mit 95 kg". Der 09.09. wäre nach der alten Zählung
     Woche 4 von Zyklus 1 gewesen — Deload mit 40/50/60 %.

     Mit dem Anker an der jüngsten Trainingsmax-Zeile braucht es dafür keinen
     Eingriff in die Vergangenheit: der neue Trainingsmax gilt ab dem 07.09.,
     der erste Push-Tag danach ist der 09.09. (Index 8), und dort fängt Zyklus
     2 mit Woche 1 an. */
  const ankerZyklus2 = { pushIndex: 8, zyklus: 2 };

  it("beginnt den vorgezogenen Zyklus mit Woche 1", () => {
    expect(bankPosition(8, ankerZyklus2)).toEqual({ art: "tm", zyklus: 2, woche: 1 });
  });

  it("führt die Welle von dort regulär weiter", () => {
    expect(bankPosition(10, ankerZyklus2)).toEqual({ art: "tm", zyklus: 2, woche: 2 });
    expect(bankPosition(12, ankerZyklus2)).toEqual({ art: "tm", zyklus: 2, woche: 3 });
    expect(bankPosition(14, ankerZyklus2)).toEqual({ art: "tm", zyklus: 2, woche: 4 });
    expect(bankPosition(16, ankerZyklus2)).toEqual({ art: "tm", zyklus: 3, woche: 1 });
  });

  it("behält die leichten Einheiten dazwischen", () => {
    // Die Abwechslung schwer/leicht hängt an der Parität des Versatzes und
    // bleibt vom Vorziehen unberührt.
    expect(bankPosition(9, ankerZyklus2)).toEqual({ art: "zusatz", zyklus: 2, woche: 1 });
    expect(bankPosition(11, ankerZyklus2)).toEqual({ art: "zusatz", zyklus: 2, woche: 2 });
  });

  it("lässt den nächsten Deload an seiner Stelle", () => {
    // Übersprungen wird genau einer, nicht das Konzept.
    expect(bankPosition(15, ankerZyklus2)).toEqual({ art: "keiner", zyklus: 2, woche: 4 });
  });

  it("legt den AMRAP-Satz vier Push-Tage nach den Anfang", () => {
    // Woche 3 dieses Zyklus — daraus folgt der Trainingsmax für Zyklus 3.
    expect(amrapPushIndex(ankerZyklus2.pushIndex)).toBe(12);
    expect(bankPosition(12, ankerZyklus2).woche).toBe(3);
  });

  it("dauert weiterhin acht Push-Tage", () => {
    expect(
      bankPosition(ankerZyklus2.pushIndex + PUSH_TAGE_JE_ZYKLUS, ankerZyklus2)
    ).toEqual({ art: "tm", zyklus: 3, woche: 1 });
  });
});

describe("istPressvariante", () => {
  it("kennt die drei Varianten", () => {
    expect(istPressvariante("Bankdrücken")).toBe(true);
    expect(istPressvariante("Paused Bench Press")).toBe(true);
    expect(istPressvariante("Spoto Press")).toBe(true);
  });

  it("hält alles andere heraus", () => {
    expect(istPressvariante("Incline Chest Press")).toBe(false);
    expect(istPressvariante("Latzug")).toBe(false);
  });
});

describe("unsaubere Sätze", () => {
  it("übergeht sie beim Bestwert", () => {
    // Jakobs 100 kg standen mit abgehobener Hüfte. Als Bezugsgröße ist ein
    // solcher Satz schlechter als gar keiner.
    const best = besterSatz([
      { kg: 85, reps: 4 },
      { kg: 100, reps: 1, sauber: false },
    ]);
    expect(best?.kg).toBe(85);
  });

  it("lässt nicht beurteilte Sätze mitzählen", () => {
    /* Die gesamte Historie vor dieser Spalte steht auf null. Ein Filter auf
       "nur ausdrücklich sauber" hätte sie auf einen Schlag entwertet. */
    expect(besterSatz([{ kg: 85, reps: 4 }, { kg: 90, reps: 2, sauber: null }])?.kg).toBe(90);
    expect(besterSatz([{ kg: 85, reps: 4 }, { kg: 90, reps: 2, sauber: true }])?.kg).toBe(90);
  });

  it("übergeht sie in der e1RM-Reihe", () => {
    const saetze: GeloggterSatz[] = [
      { uebung: "Bankdrücken", datum: "2026-09-03", kg: 85, reps: 4 },
      { uebung: "Bankdrücken", datum: "2026-09-03", kg: 100, reps: 1, sauber: false },
    ];
    const reihe = e1rmReihe(saetze);
    expect(reihe).toHaveLength(1);
    // 85 × (1 + 4/30) = 96,33 — nicht die 100 aus dem unsauberen Satz.
    expect(reihe[0].e1rm).toBeCloseTo(96.33, 2);
  });

  it("lässt einen Tag ohne einen einzigen sauberen Satz aus der Reihe fallen", () => {
    // Der Tag hat stattgefunden und bleibt in der Historie sichtbar; was
    // wegfällt, ist ausschließlich die Behauptung über die Kraft.
    const reihe = e1rmReihe([
      { uebung: "Bankdrücken", datum: "2026-09-03", kg: 100, reps: 1, sauber: false },
    ]);
    expect(reihe).toHaveLength(0);
  });
});

describe("zielProjektion", () => {
  it("rechnet das Ziel auf den Trainingsmax um, nicht umgekehrt", () => {
    /* 140 kg Maximum brauchen 90 % davon, also rechnerisch 126 kg. Der
       Trainingsmax bewegt sich aber in 2,5er-Schritten, und 125 kg — die
       Stufe darunter — behaupten nur 138,9 kg. Aufgerundet auf 127,5. */
    expect(ZIEL_TM_KG).toBe(127.5);
    expect(ZIEL_TM_KG / 0.9).toBeGreaterThanOrEqual(140);
  });

  it("braucht von 90 kg aus 15 Zyklen", () => {
    const stand = zielProjektion(90, 1, "2026-08-20");
    // 127,5 − 90 = 37,5 kg, in Schritten von 2,5 kg sind das genau 15.
    expect(stand.fehltTmKg).toBe(37.5);
    expect(stand.zyklenNoetig).toBe(15);
  });

  it("liefert eine Treppe und keine Gerade", () => {
    const stand = zielProjektion(90, 1, "2026-08-20");

    /* Zwei Punkte je Zyklus (Anfang und letzter Tag) plus der Zielpunkt:
       15 × 2 + 1 = 31. Genau diese Paare machen aus der Linie eine Treppe
       statt einer Geraden. */
    expect(stand.kurve).toHaveLength(31);
    expect(stand.kurve[0]).toMatchObject({ tmKg: 90, zyklus: 1, datum: "2026-08-20" });

    // Punkt 0 und 1 tragen denselben Trainingsmax — das ist die Waagrechte.
    expect(stand.kurve[1].tmKg).toBe(90);
    expect(stand.kurve[1].datum).toBe("2026-09-12");
    // Erst danach der Sprung.
    expect(stand.kurve[2].tmKg).toBe(92.5);

    /* Über die ganze Kurve: jeder Schritt ist entweder waagrecht oder ein
       Sprung um genau TM_SCHRITT_KG. Eine Gerade hätte lauter gleich große
       Zwischenschritte. */
    const spruenge = new Set<number>();
    for (let i = 1; i < stand.kurve.length; i++) {
      spruenge.add(Number((stand.kurve[i].tmKg - stand.kurve[i - 1].tmKg).toFixed(2)));
    }
    expect([...spruenge].sort()).toEqual([0, 2.5]);

    // Ein Zyklus dauert 24 Tage; die Waagrechte deckt 23 davon ab.
    const abstand =
      (Date.parse(`${stand.kurve[2].datum}T00:00:00Z`) -
        Date.parse(`${stand.kurve[0].datum}T00:00:00Z`)) /
      864e5;
    expect(abstand).toBe(TAGE_JE_ZYKLUS);
  });

  it("überschreitet das Ziel nicht", () => {
    const stand = zielProjektion(125, 1, "2026-08-20");
    expect(stand.kurve.at(-1)!.tmKg).toBe(ZIEL_TM_KG);
  });

  it("erkennt, dass 15 Zyklen vor Ende 2027 liegen", () => {
    const stand = zielProjektion(90, 1, "2026-08-20");
    expect(stand.imPlan).toBe(true);
    expect(stand.puffertage).toBeGreaterThan(0);
  });

  it("meldet ein unerreichbares Ziel als solches", () => {
    const stand = zielProjektion(60, 1, "2027-06-01");
    expect(stand.imPlan).toBe(false);
    expect(zielSatz(stand)).toContain("nach Ende 2027");
  });

  it("sagt im Text ausdrücklich, dass es nicht gleichmäßig geht", () => {
    const text = zielSatz(zielProjektion(90, 1, "2026-08-20"));
    expect(text).toContain("nicht gleichmäßig");
    expect(text).toContain("15 Zyklen");
    expect(text).toContain("kein einziger Zyklus stehen bleibt");
  });

  it("wechselt den Ton, sobald der Trainingsmax das Ziel trägt", () => {
    const stand = zielProjektion(ZIEL_TM_KG, 20, "2027-01-01");
    expect(stand.fehltTmKg).toBe(0);
    expect(zielSatz(stand)).toContain("sauber zu heben");
  });
});
