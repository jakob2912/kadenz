import { describe, expect, it } from "vitest";
import {
  amrapSoll,
  bankPlan,
  bankPosition,
  besterSatz,
  e1rm,
  e1rmReihe,
  kraftTrend,
  naechsterTm,
  rangliste,
  type GeloggterSatz,
} from "../kraft";

/** Sätze über mehrere Trainingstage, alle drei Tage einer. */
function reihe(uebung: string, tage: { datum: string; kg: number; reps: number }[]): GeloggterSatz[] {
  return tage.map((t) => ({ uebung, datum: t.datum, kg: t.kg, reps: t.reps }));
}

describe("e1rm", () => {
  it("gibt bei einer Wiederholung das Gewicht selbst zurück", () => {
    // Epley rechnete hier kg × 1,033 und machte aus einem tatsächlich
    // gehobenen Maximum ein höheres, das nie jemand gehoben hat.
    expect(e1rm({ kg: 100, reps: 1 })).toBe(100);
  });

  it("rechnet nach Epley", () => {
    expect(e1rm({ kg: 100, reps: 5 })).toBeCloseTo(116.67, 2);
  });

  it("verweigert über zehn Wiederholungen", () => {
    expect(e1rm({ kg: 60, reps: 11 })).toBeNull();
  });

  it("verweigert unsinnige Sätze", () => {
    expect(e1rm({ kg: 0, reps: 5 })).toBeNull();
    expect(e1rm({ kg: 80, reps: 0 })).toBeNull();
  });
});

describe("besterSatz", () => {
  it("nimmt das schwerste Gewicht, bei Gleichstand die meisten Wiederholungen", () => {
    const best = besterSatz([
      { kg: 90, reps: 8 },
      { kg: 100, reps: 3 },
      { kg: 100, reps: 5 },
    ]);
    expect(best).toEqual({ kg: 100, reps: 5 });
  });

  it("gibt null zurück, wenn nichts Gültiges dabei ist", () => {
    expect(besterSatz([{ kg: 0, reps: 0 }])).toBeNull();
  });
});

describe("e1rmReihe", () => {
  it("nimmt je Trainingstag nur den besten Satz", () => {
    // Der zweite Satz eines Tages ist bei Jakob systematisch schwächer.
    // Alle Sätze in die Reihe zu nehmen läse Ermüdung innerhalb einer
    // Einheit als Kraftverlust über Wochen.
    const r = e1rmReihe(
      reihe("Bank", [
        { datum: "2026-08-01", kg: 100, reps: 5 },
        { datum: "2026-08-01", kg: 100, reps: 3 },
      ])
    );
    expect(r).toHaveLength(1);
    expect(r[0].e1rm).toBeCloseTo(116.67, 2);
  });

  it("überspringt Sätze, aus denen sich nichts schätzen lässt", () => {
    expect(e1rmReihe(reihe("Crunch", [{ datum: "2026-08-01", kg: 70, reps: 20 }]))).toEqual([]);
  });
});

describe("kraftTrend", () => {
  it("verweigert unter vier Trainingstagen", () => {
    const urteil = kraftTrend([
      { datum: "2026-07-01", e1rm: 100 },
      { datum: "2026-07-22", e1rm: 105 },
      { datum: "2026-07-29", e1rm: 108 },
    ]);
    expect(urteil.verwertbar).toBe(false);
    if (!urteil.verwertbar) expect(urteil.grund).toContain("3 von 4");
  });

  it("verweigert unter 21 Tagen Spanne, auch bei genug Punkten", () => {
    const urteil = kraftTrend([
      { datum: "2026-07-01", e1rm: 100 },
      { datum: "2026-07-04", e1rm: 102 },
      { datum: "2026-07-07", e1rm: 104 },
      { datum: "2026-07-10", e1rm: 106 },
    ]);
    expect(urteil.verwertbar).toBe(false);
    if (!urteil.verwertbar) expect(urteil.grund).toContain("noch 12 Tage");
  });

  it("erkennt Anstieg", () => {
    const urteil = kraftTrend([
      { datum: "2026-07-01", e1rm: 100 },
      { datum: "2026-07-10", e1rm: 102 },
      { datum: "2026-07-20", e1rm: 106 },
      { datum: "2026-07-30", e1rm: 108 },
    ]);
    expect(urteil.verwertbar).toBe(true);
    if (urteil.verwertbar) {
      expect(urteil.richtung).toBe("steigt");
      expect(urteil.prozentPro4Wochen).toBeGreaterThan(0);
    }
  });

  it("nennt eine flache Reihe stehend, nicht steigend", () => {
    const urteil = kraftTrend([
      { datum: "2026-07-01", e1rm: 100 },
      { datum: "2026-07-10", e1rm: 100.4 },
      { datum: "2026-07-20", e1rm: 99.8 },
      { datum: "2026-07-30", e1rm: 100.2 },
    ]);
    expect(urteil.verwertbar && urteil.richtung).toBe("steht");
  });
});

describe("rangliste", () => {
  it("ordnet nach Prozent, nicht nach Kilogramm — Nachzügler oben", () => {
    /* Leg Curl legt 5 kg zu (auf 125 kg: 4 %), Preacher Curl 2,5 kg
       (auf 20 kg: 12,5 %). In Kilogramm sortiert stünde Leg Curl vorn,
       obwohl dort anteilig weniger passiert ist. */
    const tage = ["2026-07-01", "2026-07-11", "2026-07-21", "2026-07-31"];
    const raenge = rangliste({
      "Leg Curl": reihe(
        "Leg Curl",
        tage.map((datum, i) => ({ datum, kg: 125 + i * 1.7, reps: 5 }))
      ),
      "Preacher Curl": reihe(
        "Preacher Curl",
        tage.map((datum, i) => ({ datum, kg: 20 + i * 0.85, reps: 5 }))
      ),
    });

    expect(raenge.map((r) => r.uebung)).toEqual(["Leg Curl", "Preacher Curl"]);
  });

  it("hängt Übungen ohne Urteil hinten an", () => {
    const raenge = rangliste({
      Frisch: reihe("Frisch", [{ datum: "2026-07-31", kg: 50, reps: 5 }]),
      Lang: reihe(
        "Lang",
        ["2026-07-01", "2026-07-11", "2026-07-21", "2026-07-31"].map((datum, i) => ({
          datum,
          kg: 100 + i,
          reps: 5,
        }))
      ),
    });

    expect(raenge[0].uebung).toBe("Lang");
    expect(raenge[1].urteil.verwertbar).toBe(false);
  });
});

describe("bankPlan", () => {
  it("liefert die Sollprozente, gerundet auf 2,5 kg", () => {
    expect(bankPlan(100, 1)).toEqual([
      { prozent: 65, wdh: 5, amrap: false, kg: 65 },
      { prozent: 75, wdh: 5, amrap: false, kg: 75 },
      { prozent: 85, wdh: 5, amrap: true, kg: 85 },
    ]);
    expect(bankPlan(90, 1).map((s) => s.kg)).toEqual([57.5, 67.5, 77.5]);
  });

  it("hat in der Deload-Woche keinen AMRAP-Satz", () => {
    // Der Sinn der Woche ist, nicht auszureizen.
    expect(bankPlan(100, 4).some((s) => s.amrap)).toBe(false);
    expect(amrapSoll(4)).toBeNull();
  });
});

describe("bankPosition", () => {
  it("zählt ab dem Programmstart, nicht ab dem Rotationsanker", () => {
    /* Sonst wäre die allererste Bankeinheit je nach Startdatum mitten im
       Zyklus gelandet — im schlechtesten Fall gleich Woche 3 mit 95 %. */
    const start = 7;
    expect(bankPosition(7, start)).toEqual({ istBankTag: true, zyklus: 1, woche: 1 });
    expect(bankPosition(9, start)).toEqual({ istBankTag: true, zyklus: 1, woche: 2 });
    expect(bankPosition(13, start)).toEqual({ istBankTag: true, zyklus: 1, woche: 4 });
    expect(bankPosition(15, start)).toEqual({ istBankTag: true, zyklus: 2, woche: 1 });
  });

  it("macht jede zweite Push-Einheit zum Bank-Tag", () => {
    expect(bankPosition(8, 7).istBankTag).toBe(false);
    expect(bankPosition(10, 7).istBankTag).toBe(false);
  });

  it("meldet vor dem Programmstart keinen Bank-Tag", () => {
    expect(bankPosition(3, 7)).toEqual({ istBankTag: false, zyklus: 1, woche: 1 });
  });
});

describe("naechsterTm", () => {
  const soll = amrapSoll(3)!.wdh;

  it("hebt an, wenn der AMRAP-Satz das Soll erreicht", () => {
    const e = naechsterTm(90, { kg: 85.5, reps: 3 }, soll);
    expect(e.richtung).toBe("hoch");
    expect(e.tmNeu).toBe(92.5);
  });

  it("hält, wenn das Soll verfehlt wird", () => {
    expect(naechsterTm(90, { kg: 85.5, reps: 0 }, soll)).toMatchObject({
      richtung: "bleibt",
      tmNeu: 90,
    });
  });

  it("hält, wenn gar kein AMRAP-Satz geloggt wurde", () => {
    expect(naechsterTm(90, null, soll)).toMatchObject({ richtung: "bleibt", tmNeu: 90 });
  });

  it("setzt zurück, wenn das gemessene Maximum unter den Trainingsmax fällt", () => {
    // Eine einzige Wiederholung bei 95 % heißt: der Trainingsmax liegt über
    // dem, was überhaupt einmal geht.
    const e = naechsterTm(90, { kg: 85.5, reps: 1 }, soll);
    expect(e.richtung).toBe("zurueck");
    expect(e.tmNeu).toBe(77.5);
  });

  it("setzt NICHT zurück, nur weil der AMRAP-Satz das volle Maximum nicht bestätigt", () => {
    /* Der Trainingsmax soll mit Abstand unter dem Maximum liegen. Gegen
       tm / 0,9 zu prüfen hieße zu verlangen, dass jeder AMRAP-Satz das volle
       Maximum belegt — drei saubere Wiederholungen bei 95 % ergäben gut 94 kg
       gegen einen Anspruch von 100 kg und lösten einen Reset aus, obwohl der
       Satz gut lief. */
    expect(naechsterTm(90, { kg: 85.5, reps: 3 }, soll).richtung).not.toBe("zurueck");
  });
});
