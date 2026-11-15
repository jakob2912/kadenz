import { describe, expect, it } from "vitest";
import {
  amrapPushIndex,
  bankPosition,
  pushTageImZyklus,
  wochenImZyklus,
  alteDeloadRegel,
  NEUE_DELOAD_REGEL_AB,
  besterSatz,
  e1rmReihe,
  type GeloggterSatz,
} from "../kraft";
import { ZIEL_DATUM, ZIEL_TM_KG, zielProjektion, zielSatz } from "../bankziel";
import { phasenlauf } from "../gewichtsplan";

/** Ein festes Zieldatum für die Projektion, unabhängig vom Gewichtsplan. */
const Z = "2027-05-04";

describe("Zyklus vorziehen (Deload überspringen)", () => {
  /* Jakob am 07.09.2026: "das fühlt sich zu leicht an, skip den Deload, ich
     sage direkt Zyklus 2 mit 95 kg". Der 09.09. wäre nach der alten Zählung
     Woche 4 von Zyklus 1 gewesen — Deload mit 40/50/60 %.

     Mit dem Anker an der jüngsten Trainingsmax-Zeile braucht es dafür keinen
     Eingriff in die Vergangenheit: der neue Trainingsmax gilt ab dem 07.09.,
     der erste Push-Tag danach ist der 09.09. (Index 8), und dort fängt Zyklus
     2 mit Woche 1 an.

     Der Zyklus hat am 07.09.2026 angefangen, also vor der neuen Deload-Regel
     vom 15.11.2026: er behält seine vier Wochen. */
  const ankerZyklus2 = { pushIndex: 8, zyklus: 2, tmKg: 100, abIso: "2026-09-07" };

  it("beginnt den vorgezogenen Zyklus mit Woche 1", () => {
    expect(bankPosition(8, ankerZyklus2)).toMatchObject({ art: "tm", zyklus: 2, woche: 1 });
  });

  it("führt die Welle von dort regulär weiter", () => {
    expect(bankPosition(10, ankerZyklus2)).toMatchObject({ art: "tm", zyklus: 2, woche: 2 });
    expect(bankPosition(12, ankerZyklus2)).toMatchObject({ art: "tm", zyklus: 2, woche: 3 });
    expect(bankPosition(14, ankerZyklus2)).toMatchObject({ art: "tm", zyklus: 2, woche: 4 });
    expect(bankPosition(16, ankerZyklus2)).toMatchObject({ art: "tm", zyklus: 3, woche: 1 });
  });

  it("behält die leichten Einheiten dazwischen", () => {
    // Die Abwechslung schwer/leicht hängt an der Parität des Versatzes und
    // bleibt vom Vorziehen unberührt.
    expect(bankPosition(9, ankerZyklus2)).toMatchObject({ art: "zusatz", zyklus: 2, woche: 1 });
    expect(bankPosition(11, ankerZyklus2)).toMatchObject({ art: "zusatz", zyklus: 2, woche: 2 });
  });

  it("lässt den nächsten Deload an seiner Stelle", () => {
    // Übersprungen wird genau einer, nicht das Konzept.
    expect(bankPosition(15, ankerZyklus2)).toMatchObject({ art: "keiner", zyklus: 2, woche: 4 });
  });

  it("legt den AMRAP-Satz vier Push-Tage nach den Anfang", () => {
    // Woche 3 dieses Zyklus — daraus folgt der Trainingsmax für Zyklus 3.
    expect(amrapPushIndex(ankerZyklus2.pushIndex)).toBe(12);
    expect(bankPosition(12, ankerZyklus2).woche).toBe(3);
  });

  it("dauert als alter Zyklus weiterhin acht Push-Tage", () => {
    expect(pushTageImZyklus(2, 100, true)).toBe(8);
    expect(
      bankPosition(ankerZyklus2.pushIndex + pushTageImZyklus(2, 100, true), ankerZyklus2)
    ).toMatchObject({ art: "tm", zyklus: 3, woche: 1 });
  });

  /* Bestehende Anker werden nicht umgeschrieben, aber ab dem nächsten Zyklus
     gilt die neue Regel: Zyklus 3 hat trotz 100 kg drei Wochen. */
  it("rechnet die Zyklen nach dem alten Anker nach der neuen Regel", () => {
    expect(bankPosition(20, ankerZyklus2)).toEqual({ art: "tm", zyklus: 3, woche: 3, wochen: 3 });
    expect(bankPosition(22, ankerZyklus2)).toEqual({ art: "tm", zyklus: 4, woche: 1, wochen: 4 });
  });
});

describe("Vierte Woche nur im Testzyklus", () => {
  /* Jakob am 02.10.2026: die Deloads weglassen, bis der Trainingsmax bei
     rund 100 kg steht. Seit dem 15.11.2026 gar kein Deload mehr: jeder
     Zyklus hat drei Wochen, auf Woche 3 folgt direkt Woche 1 des nächsten —
     nur der Testzyklus hat eine vierte, und dort steht der Test. */
  const anker = { pushIndex: 8, zyklus: 2, tmKg: 95 };

  it("hat drei Wochen, auch ab 100 kg", () => {
    expect(wochenImZyklus(2, 95)).toBe(3);
    expect(wochenImZyklus(2, 100)).toBe(3);
    expect(wochenImZyklus(2, 120)).toBe(3);
    expect(wochenImZyklus(2, null)).toBe(3);
    expect(bankPosition(8, anker)).toMatchObject({ zyklus: 2, woche: 1, wochen: 3 });
    expect(bankPosition(8, { ...anker, tmKg: 105 })).toMatchObject({ wochen: 3 });
  });

  it("hat im Testzyklus vier Wochen", () => {
    expect(wochenImZyklus(4, 95)).toBe(4);
    expect(wochenImZyklus(7, 120)).toBe(4);
  });

  it("rechnet nur Zyklen, die vor dem 16.11.2026 angefangen haben, nach der alten Schwelle", () => {
    expect(alteDeloadRegel("2026-11-15")).toBe(true);
    expect(alteDeloadRegel(NEUE_DELOAD_REGEL_AB)).toBe(false);
    expect(alteDeloadRegel(undefined)).toBe(false);
    expect(wochenImZyklus(2, 100, true)).toBe(4);
    expect(wochenImZyklus(2, 95, true)).toBe(3);
    expect(wochenImZyklus(2, null, true)).toBe(4);
    const alt = { pushIndex: 8, zyklus: 2, tmKg: 105, abIso: "2026-11-01" };
    expect(bankPosition(14, alt)).toEqual({ art: "tm", zyklus: 2, woche: 4, wochen: 4 });
    expect(bankPosition(16, alt)).toEqual({ art: "tm", zyklus: 3, woche: 1, wochen: 3 });
    const neu = { ...alt, abIso: "2026-11-20" };
    expect(bankPosition(14, neu)).toEqual({ art: "tm", zyklus: 3, woche: 1, wochen: 3 });
  });

  it("springt nach Woche 3 in den nächsten Zyklus", () => {
    expect(bankPosition(12, anker)).toEqual({ art: "tm", zyklus: 2, woche: 3, wochen: 3 });
    expect(bankPosition(13, anker)).toEqual({ art: "zusatz", zyklus: 2, woche: 3, wochen: 3 });
    expect(bankPosition(14, anker)).toEqual({ art: "tm", zyklus: 3, woche: 1, wochen: 3 });
    expect(bankPosition(20, anker)).toEqual({ art: "tm", zyklus: 4, woche: 1, wochen: 4 });
  });

  it("behält im Testzyklus die vierte Woche für den Maximalversuch", () => {
    // Zyklus 4 ist ein Testzyklus: Anfang bei 8 + 6 + 6 = 20, Woche 4 bei 26.
    expect(bankPosition(26, anker)).toEqual({ art: "test", zyklus: 4, woche: 4, wochen: 4 });
    expect(bankPosition(28, anker)).toMatchObject({ art: "tm", zyklus: 5, woche: 1 });
  });

  it("nimmt den AMRAP-Satz weiter aus Woche 3", () => {
    expect(bankPosition(amrapPushIndex(anker.pushIndex), anker).woche).toBe(3);
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
    // Ohne Deload: 21 Tage je Zyklus.
    expect(stand.kurve[1].datum).toBe("2026-09-09");
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

    // Ein Zyklus ohne Deload dauert 21 Tage; die Waagrechte deckt 20 davon ab.
    const abstand =
      (Date.parse(`${stand.kurve[2].datum}T00:00:00Z`) -
        Date.parse(`${stand.kurve[0].datum}T00:00:00Z`)) /
      864e5;
    expect(abstand).toBe(21);

    // Der Testzyklus (4) dauert mit seiner vierten Woche 28 Tage, ...
    const dauer = (zyklus: number) => {
      const i = stand.kurve.findIndex((p) => p.zyklus === zyklus);
      return (
        (Date.parse(`${stand.kurve[i + 2].datum}T00:00:00Z`) -
          Date.parse(`${stand.kurve[i].datum}T00:00:00Z`)) /
        864e5
      );
    };
    expect(dauer(4)).toBe(28);
    // ... ein Zyklus ab 100 kg ohne Test dagegen weiter 21 (Zyklus 5, 100 kg).
    expect(stand.kurve.find((p) => p.zyklus === 5)!.tmKg).toBe(100);
    expect(dauer(5)).toBe(21);
  });

  it("überschreitet das Ziel nicht", () => {
    const stand = zielProjektion(125, 1, "2026-08-20");
    expect(stand.kurve.at(-1)!.tmKg).toBe(ZIEL_TM_KG);
  });

  /* Mit festem Zieldatum, damit die Rechnung nicht am Gewichtsplan hängt:
     Z ist ein Zieldatum wie das Ende eines Aufbaus. Acht Zyklen ab 107,5 kg
     (davon zwei Testzyklen à 28 Tage, sechs à 21) sind 182 Tage und enden am
     18.02.2027; die 15 Zyklen ab 90 kg (vier Testzyklen) sind 343 Tage, enden
     am 29.07.2027 und passen nicht. */
  it("erkennt, dass 8 Zyklen vor dem Ende des Aufbaus liegen", () => {
    const stand = zielProjektion(107.5, 1, "2026-08-20", Z);
    expect(stand.zyklenNoetig).toBe(8);
    expect(stand.fruehestensAm).toBe("2027-02-18");
    expect(stand.imPlan).toBe(true);
    expect(stand.puffertage).toBe(75);
  });

  it("erkennt, dass 15 Zyklen nicht mehr vor das Ende des Aufbaus passen", () => {
    const stand = zielProjektion(90, 1, "2026-08-20", Z);
    expect(stand.zyklenNoetig).toBe(15);
    expect(stand.fruehestensAm).toBe("2027-07-29");
    expect(stand.imPlan).toBe(false);
  });

  it("nimmt als Zieldatum den Beginn des Cuts aus dem Gewichtsplan", () => {
    const cut = phasenlauf().find((l) => l.phase.art === "cut")!;
    expect(ZIEL_DATUM).toBe(cut.vonIso);
    expect(ZIEL_DATUM).toBe("2027-04-15");
    expect(zielProjektion(90, 1, "2026-08-20").zielIso).toBe(ZIEL_DATUM);
  });

  it("meldet ein unerreichbares Ziel als solches", () => {
    const stand = zielProjektion(60, 1, "2027-06-01", Z);
    expect(stand.imPlan).toBe(false);
    expect(zielSatz(stand)).toContain("after the end of the bulk (4 May 2027)");
  });

  it("sagt im Text ausdrücklich, dass es nicht gleichmäßig geht", () => {
    const text = zielSatz(zielProjektion(107.5, 1, "2026-08-20", Z));
    expect(text).toContain("doesn't add that evenly");
    expect(text).toContain("8 cycles");
    expect(text).toContain("not a single cycle stalls");
    expect(text).toContain("until the end of the bulk (4 May 2027)");
    expect(text).toContain("every 3rd cycle runs a week longer for the test");
    expect(text).toContain("5 kg after a strong AMRAP set or test");
    expect(text).not.toContain("backs off");
  });

  it("wechselt den Ton, sobald der Trainingsmax das Ziel trägt", () => {
    const stand = zielProjektion(ZIEL_TM_KG, 20, "2027-01-01");
    expect(stand.fehltTmKg).toBe(0);
    expect(zielSatz(stand)).toContain("lifting it once");
  });
});
