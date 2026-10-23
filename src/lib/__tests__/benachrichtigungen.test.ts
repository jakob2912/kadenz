import { describe, expect, it } from "vitest";
import { abendNachricht, morgenNachricht, offeneDinge } from "../benachrichtigung-texte";

describe("morgenNachricht", () => {
  it("nennt Regeneration und Einheit, und erinnert ans Wiegen", () => {
    const n = morgenNachricht(
      { verbunden: true, regeneration: { score: 78, band: "gut" }, gewogenHeute: false },
      { art: "training", einheit: "push" }
    );
    expect(n.title).toBe("Regeneration 78 · erholt");
    expect(n.body).toContain("Heute Push");
    expect(n.body).toContain("Morgengewicht");
    expect(n.tag).toBe("morgen");
  });

  it("lässt die Wiege-Erinnerung weg, wenn schon gewogen", () => {
    const n = morgenNachricht(
      { verbunden: true, regeneration: { score: 60, band: "mittel" }, gewogenHeute: true },
      { art: "pause", naechste: "pull" }
    );
    expect(n.body).not.toContain("Morgengewicht");
    expect(n.body).toContain("Rest Day");
    expect(n.body).toContain("Pull");
  });

  it("rät an einem schlechten Trainingstag zum Halten, nicht an einem Rest Day", () => {
    const schlecht = { verbunden: true as const, regeneration: { score: 30, band: "schlecht" as const }, gewogenHeute: true };
    expect(morgenNachricht(schlecht, { art: "training", einheit: "pull" }).body).toContain("halten");
    expect(morgenNachricht(schlecht, { art: "pause", naechste: "push" }).body).not.toContain("halten");
  });

  it("sagt zuerst, dass Google neu verbunden werden muss", () => {
    const n = morgenNachricht(
      { verbunden: false, grund: "abgelaufen" },
      { art: "training", einheit: "push" }
    );
    expect(n.title).toBe("Google Health neu verbinden");
    expect(n.body).toContain("Heute Push");
  });

  it("kommt ohne vollständige Nacht mit neutralem Titel aus", () => {
    const n = morgenNachricht(
      { verbunden: true, regeneration: null, gewogenHeute: true },
      { art: "training", einheit: "push" }
    );
    expect(n.title).toBe("Guten Morgen");
  });
});

describe("abendNachricht", () => {
  it("erinnert an eine geplante, noch nicht begonnene Einheit", () => {
    const n = abendNachricht({
      plan: { art: "training", einheit: "pull" },
      trainiertHeute: false,
      kalorienvorschlagOffen: false,
    });
    expect(n?.title).toBe("Heute noch Pull");
    expect(n?.url).toBe("/training");
  });

  it("schweigt, wenn heute schon trainiert wurde — auch die andere Einheit", () => {
    expect(
      abendNachricht({
        plan: { art: "training", einheit: "push" },
        trainiertHeute: true,
        kalorienvorschlagOffen: false,
      })
    ).toBeNull();
  });

  it("schweigt am Rest Day ohne offenen Vorschlag", () => {
    expect(
      abendNachricht({
        plan: { art: "pause", naechste: "push" },
        trainiertHeute: false,
        kalorienvorschlagOffen: false,
      })
    ).toBeNull();
  });

  it("meldet einen offenen Kalorienvorschlag, auch am Rest Day", () => {
    const n = abendNachricht({
      plan: { art: "pause", naechste: "push" },
      trainiertHeute: false,
      kalorienvorschlagOffen: true,
    });
    expect(n?.url).toBe("/ernaehrung");
  });

  it("fasst offenes Training und offenen Vorschlag in eine Nachricht", () => {
    const n = abendNachricht({
      plan: { art: "training", einheit: "push" },
      trainiertHeute: false,
      kalorienvorschlagOffen: true,
    });
    expect(n?.url).toBe("/training");
    expect(n?.body).toContain("Kalorienvorschlag");
  });
});

describe("offeneDinge (Zahl am App-Symbol)", () => {
  const training = { art: "training", einheit: "push" } as const;
  const pause = { art: "pause", naechste: "pull" } as const;

  it("zählt die geplante, noch nicht begonnene Einheit", () => {
    expect(offeneDinge({ plan: training, trainiertHeute: false, kalorienvorschlagOffen: false })).toBe(1);
  });

  it("zählt nichts, sobald trainiert wurde oder Rest Day ist", () => {
    expect(offeneDinge({ plan: training, trainiertHeute: true, kalorienvorschlagOffen: false })).toBe(0);
    expect(offeneDinge({ plan: pause, trainiertHeute: false, kalorienvorschlagOffen: false })).toBe(0);
  });

  it("addiert einen offenen Kalorienvorschlag", () => {
    expect(offeneDinge({ plan: training, trainiertHeute: false, kalorienvorschlagOffen: true })).toBe(2);
    expect(offeneDinge({ plan: pause, trainiertHeute: false, kalorienvorschlagOffen: true })).toBe(1);
  });
});
