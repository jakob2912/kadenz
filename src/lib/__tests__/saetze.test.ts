import { describe, expect, it } from "vitest";
import { heutigeSaetze, saetzeFuerTag, type PlannedExercise } from "../plan";

/**
 * Eine geplante Übung, wie sie mitHistorie() liefert.
 *
 * Die Sätze kommen aus `saetze`, nicht aus `last` — genau das ist die
 * Eigenschaft, die hier abgesichert wird. Vor dem 25.08.2026 zählte
 * heutigeSaetze() die Einträge in `last`, und eine Übung ohne Historie bekam
 * dadurch gar keine Sätze.
 */
function uebung(felder: Partial<PlannedExercise> = {}): PlannedExercise {
  return {
    name: "Testübung",
    saetze: 2,
    last: [
      { reps: 6, kg: 100 },
      { reps: 5, kg: 100 },
    ],
    ziel: 100,
    delta: 0,
    grund: null,
    prev: [],
    programmSaetze: [],
    programmHinweis: null,
    ...felder,
  };
}

describe("heutigeSaetze", () => {
  it("plant so viele Sätze, wie der Katalog vorgibt", () => {
    expect(heutigeSaetze(uebung({ saetze: 2 }))).toHaveLength(2);
    expect(heutigeSaetze(uebung({ saetze: 1 }))).toHaveLength(1);
    expect(heutigeSaetze(uebung({ saetze: 3 }))).toHaveLength(3);
  });

  it("legt alle Sätze auf das Zielgewicht aus progression()", () => {
    const saetze = heutigeSaetze(uebung({ saetze: 2, ziel: 102.5 }));
    expect(saetze.map((s) => s.kg)).toEqual([102.5, 102.5]);
    expect(saetze.every((s) => !s.amrap)).toBe(true);
  });

  it("nimmt die Wiederholungen aus der letzten Ausführung", () => {
    const saetze = heutigeSaetze(uebung({ saetze: 2, last: [{ reps: 8, kg: 90 }, { reps: 6, kg: 90 }] }));
    expect(saetze.map((s) => s.wdh)).toEqual([8, 6]);
  });

  /* Der Kern des Fehlers: der Adductor kam ohne startWdh aus dem MCP-Server
     und stand mit einer leeren Satzliste im Plan — Tabellenkopf, keine Zeile. */
  it("plant auch ohne jede Historie Sätze", () => {
    const saetze = heutigeSaetze(uebung({ saetze: 2, last: [] }));
    expect(saetze).toHaveLength(2);
    expect(saetze.map((s) => s.wdh)).toEqual([8, 8]);
  });

  /* Reicht die Historie nicht so weit wie der Plan, wiederholt sich der letzte
     bekannte Wert. Eine Zeile ohne Sollwert wäre im Gym unbrauchbar. */
  it("füllt fehlende Wiederholungen mit dem letzten bekannten Wert", () => {
    const saetze = heutigeSaetze(
      uebung({ saetze: 4, last: [{ reps: 7, kg: 80 }, { reps: 6, kg: 80 }] })
    );
    expect(saetze.map((s) => s.wdh)).toEqual([7, 6, 6, 6]);
  });

  /* Vorher schrumpfte der Plan still: wer von zwei geplanten Sätzen nur einen
     abhakte, bekam beim nächsten Training nur noch einen vorgeschlagen. */
  it("schrumpft nicht, wenn zuletzt weniger Sätze geloggt wurden", () => {
    expect(heutigeSaetze(uebung({ saetze: 2, last: [{ reps: 5, kg: 100 }] }))).toHaveLength(2);
  });

  it("lässt einem Programm den Vortritt", () => {
    const vorgabe = [
      { kg: 75, wdh: 5, amrap: false },
      { kg: 85, wdh: 3, amrap: false },
      { kg: 95, wdh: 1, amrap: true },
    ];
    // saetze steht auf 2 und wird ausdrücklich ignoriert: beim 5/3/1 haben die
    // Sätze verschiedene Gewichte, die aus dem Trainingsmax folgen.
    expect(heutigeSaetze(uebung({ saetze: 2, programmSaetze: vorgabe }))).toEqual(vorgabe);
  });

  /* Ohne Trainingsmax gibt das Programm nichts vor. Dann bleibt die Liste
     leer, statt auf saetze zurückzufallen — der Slot soll leer aussehen. */
  it("bleibt beim Programm ohne Vorgabe leer", () => {
    const ex = uebung({ saetze: 3, programmSaetze: [], programmHinweis: "Trainingsmax fehlt." });
    expect(heutigeSaetze({ ...ex, saetze: 0 })).toEqual([]);
  });
});

/**
 * Die Bank-Tag-Reduktion.
 *
 * Anforderung im Wortlaut: an Push-/Bankdrück-Tagen fällt bei der Incline
 * Chest Press ein Satz weg, und die Reduzierung greift nur dort, wo sie
 * tatsächlich vorgesehen ist.
 */
describe("saetzeFuerTag", () => {
  const inclineChestPress = { saetze: 2, saetzeBankTag: 1 };
  const butterfly = { saetze: 2, saetzeBankTag: null };
  const hackSquat = { saetze: 1, saetzeBankTag: null };

  it("zieht am Bank-Tag genau bei der vorgesehenen Übung einen Satz ab", () => {
    expect(saetzeFuerTag(inclineChestPress, true)).toBe(1);
  });

  it("lässt dieselbe Übung an gewöhnlichen Push-Tagen bei zwei Sätzen", () => {
    expect(saetzeFuerTag(inclineChestPress, false)).toBe(2);
  });

  it("rührt Übungen ohne hinterlegte Bank-Tag-Anzahl nicht an", () => {
    expect(saetzeFuerTag(butterfly, true)).toBe(2);
    expect(saetzeFuerTag(butterfly, false)).toBe(2);
    expect(saetzeFuerTag(hackSquat, true)).toBe(1);
    expect(saetzeFuerTag(hackSquat, false)).toBe(1);
  });

  /* An Pull-Tagen gibt es keinen Bankstand, istBankTag ist dort immer false.
     Selbst eine Pull-Übung mit gesetztem saetzeBankTag bliebe unberührt. */
  it("greift nicht, solange kein Bank-Tag ist", () => {
    expect(saetzeFuerTag({ saetze: 2, saetzeBankTag: 1 }, false)).toBe(2);
  });
});
