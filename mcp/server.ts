/**
 * Kadenz — MCP-Server
 *
 * Gibt Claude Desktop Zugriff auf Jakobs Trainings- und Gesundheitsdaten.
 * Damit übernimmt der Desktop die Rolle des Coaches: er kann rückfragen,
 * Zusammenhänge erklären und — weil dort auch Obsidian angebunden ist —
 * Trainingsdaten mit den Vault-Notizen zusammenbringen. Ein Anthropic-API-Key
 * in der App wird dadurch überflüssig.
 *
 * Start über Claude Desktop, siehe mcp/README.md.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  assessTrend,
  briefing,
  movingAverage,
  readiness,
  weeksToGoal,
} from "../src/lib/coach";
import { besterSatz, e1rm, e1rmReihe, kraftTrend, rangliste } from "../src/lib/kraft";
import { saetzeFuer, saetzeProUebung } from "../src/lib/kraftverlauf";
import {
  aktuellerTrainingsmax,
  bankstandFuer,
  trainingsmaxHistorie,
  trainingsmaxSetzen,
} from "../src/lib/bank";
import { heuteWien, wienerStunde } from "../src/lib/datum";
import { heutigeSaetze, rotationFor, SESSIONS } from "../src/lib/plan";
import {
  einheitFuerTag,
  katalogVollstaendig,
  uebungEntfernen,
  uebungHinzufuegen,
  uebungTauschen,
  uebungUmbenennen,
  uebungenUmsortieren,
  type Einheit,
} from "../src/lib/uebungen";
import { satzSpeichern } from "../src/lib/workouts";
import {
  aktuellesZiel,
  mahlzeitenLesen,
  offenerVorschlag,
  vorschlagLage,
  zielHistorie,
} from "../src/lib/ernaehrung";
import { prisma } from "../src/lib/db";
import { refreshTokenLesen } from "../src/lib/auth-store";
import {
  basisUrl,
  datenbankKonfiguriert,
  fehlendeGoogleVariablen,
} from "../src/lib/konfiguration";
import { listDataPoints, refreshAccessToken } from "../src/lib/google-health";
import {
  buildDailySeries,
  deriveBaseline,
  mapRestingHr,
  mapSleep,
  mapWeight,
  nightlyHrv,
  type ApiHrvPoint,
  type ApiRestingHrPoint,
  type ApiSleepPoint,
  type ApiWeightPoint,
} from "../src/lib/health-mapper";

const ZIEL_KG = 97;
const MAX_RATE = 0.5;

/**
 * Ohne DATABASE_URL meldet der Postgres-Treiber "connect ECONNREFUSED
 * 127.0.0.1:5432" — was aussieht wie eine kaputte Datenbank, obwohl nur die
 * Variable fehlt. Der häufigste Grund dafür: der Server wurde ohne
 * --env-file=.env.local gestartet.
 */
function datenbankPruefen(): void {
  if (!datenbankKonfiguriert()) {
    throw new Error(
      "DATABASE_URL ist nicht gesetzt. Der Server braucht --env-file=.env.local " +
        "(siehe mcp/README.md), sonst findet er die Datenbank nicht."
    );
  }
}

/**
 * Gesundheitsdaten laden — eigene Fassung statt health-service.ts, weil jene
 * den Token über next/headers aus einem Cookie liest. Hier gibt es keinen
 * Request und keine Cookies; der Token kommt aus der Datenbank.
 */
async function ladeGesundheit(tage = 30) {
  datenbankPruefen();

  const fehlend = fehlendeGoogleVariablen();
  if (fehlend.length > 0) {
    throw new Error(
      `Google Health ist nicht eingerichtet — es fehlt: ${fehlend.join(", ")}. ` +
        "Der Server wird mit --env-file=.env.local gestartet; steht die Variable dort?"
    );
  }

  const refresh = await refreshTokenLesen();
  if (!refresh) {
    // Nicht mehr fest auf localhost: derselbe Server läuft auch gegen eine
    // deployte Instanz, und dann ginge der Hinweis ins Leere.
    throw new Error(
      `Kein Google-Refresh-Token in der Datenbank. Einmal über ${basisUrl()}/api/auth/google anmelden.`
    );
  }

  const { access_token } = await refreshAccessToken(refresh);
  const to = new Date();
  const from = new Date(to.getTime() - tage * 864e5);
  const range = { from, to };

  const [sleep, hr, hrv, weight] = await Promise.all([
    listDataPoints<ApiSleepPoint>(access_token, "sleep", range),
    listDataPoints<ApiRestingHrPoint>(access_token, "restingHeartRate", range),
    listDataPoints<ApiHrvPoint>(access_token, "hrv", range),
    listDataPoints<ApiWeightPoint>(access_token, "weight", range),
  ]);

  const naechte = mapSleep(sleep.points);
  const { series } = buildDailySeries(
    naechte,
    mapRestingHr(hr.points),
    nightlyHrv(hrv.points, naechte)
  );

  return { series, baseline: deriveBaseline(series), gewicht: mapWeight(weight.points) };
}

/** MCP erwartet Text-Inhalte; strukturierte Daten gehen als JSON durch. */
function antwort(daten: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(daten, null, 2) }] };
}

function fehler(e: unknown) {
  return {
    content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }],
    isError: true,
  };
}

const server = new McpServer({ name: "kadenz", version: "1.0.0" });

server.registerTool(
  "regeneration_heute",
  {
    title: "Regeneration heute",
    description:
      "Regenerations-Score aus Schlaf, Tiefschlaf, Ruhepuls und HRV, verglichen mit Jakobs persönlicher Baseline. Sagt außerdem, ob Krafttraining und Cardio vertretbar sind.",
  },
  async () => {
    try {
      const { series, baseline } = await ladeGesundheit(30);
      const heute = series.at(-1);
      if (!heute || !baseline) {
        return antwort({ hinweis: "Noch keine vollständige Nacht mit Ruhepuls und HRV." });
      }
      return antwort({
        datum: heute.date,
        werte: heute,
        baseline,
        regeneration: readiness(heute, baseline),
      });
    } catch (e) {
      return fehler(e);
    }
  }
);

server.registerTool(
  "gewichtstrend",
  {
    title: "Gewichtstrend",
    description:
      "Gewichtsreihe, 7-Tage-Schnitt und Trendurteil. Das Urteil sagt ausdrücklich auch, WANN es nicht rechnet — etwa nach einer Messlücke, solange sich das Gewicht noch nicht stabilisiert hat.",
    inputSchema: { tage: z.number().int().min(7).max(120).optional() },
  },
  async ({ tage }) => {
    try {
      const { gewicht } = await ladeGesundheit(tage ?? 30);
      const aktuell = gewicht.at(-1) ?? null;
      return antwort({
        aktuell,
        schnitt7: movingAverage(gewicht, 7),
        trend: assessTrend(gewicht),
        ziel: {
          kg: ZIEL_KG,
          maxRateProWoche: MAX_RATE,
          wochenBeiMaxRate: aktuell ? weeksToGoal(aktuell.kg, ZIEL_KG, MAX_RATE) : null,
        },
        reihe: gewicht,
      });
    } catch (e) {
      return fehler(e);
    }
  }
);

server.registerTool(
  "training_heute",
  {
    title: "Training heute",
    description:
      "Welche Einheit laut Rotation (Push – Pull – Pause) ansteht, mit den Startgewichten aus der tatsächlichen Trainingshistorie und der Begründung, wo sich etwas ändert.",
  },
  async () => {
    try {
      const heute = await einheitFuerTag(new Date());
      if (heute.art === "pause") {
        return antwort({
          art: "pause",
          naechste: heute.naechste.fokus,
          uebungenMorgen: heute.naechste.uebungen.map((u) => u.name),
        });
      }
      return antwort({
        art: "training",
        einheit: heute.fokus,
        titel: heute.titel,
        bank: heute.bank
          ? {
              bankTag: heute.bank.position.istBankTag,
              zyklus: heute.bank.position.zyklus,
              woche: heute.bank.position.woche,
              trainingsmaxKg: heute.bank.tm?.tmKg ?? null,
              naechsterBankTag: heute.bank.naechsterBankTag,
              hinweis: heute.bank.vorgabe.hinweis,
            }
          : null,
        uebungen: heute.uebungen.map((u) => ({
          name: u.name,
          zuletzt: u.prev,
          startgewicht: u.ziel,
          aenderung: u.delta,
          begruendung: u.grund,
          // Beim 5/3/1 sind die Sätze verschieden schwer — ein einzelnes
          // Startgewicht beschreibt die Übung dort nicht.
          saetze: heutigeSaetze(u).map((s) => ({
            kg: s.kg,
            wdh: s.wdh,
            amrap: s.amrap,
          })),
        })),
      });
    } catch (e) {
      return fehler(e);
    }
  }
);

server.registerTool(
  "trainingsverlauf",
  {
    title: "Trainingsverlauf",
    description: "Die letzten Trainingseinheiten aus der Datenbank, mit allen geloggten Sätzen.",
    inputSchema: { anzahl: z.number().int().min(1).max(50).optional() },
  },
  async ({ anzahl }) => {
    try {
      datenbankPruefen();
      const workouts = await prisma.workout.findMany({
        orderBy: { date: "desc" },
        take: anzahl ?? 10,
        include: { sets: { orderBy: [{ exercise: "asc" }, { setIndex: "asc" }] } },
      });
      return antwort(
        workouts.map((w) => ({
          datum: w.date.toISOString().slice(0, 10),
          art: w.kind,
          beendet: w.finishedAt?.toISOString() ?? null,
          notiz: w.note,
          volumen: w.sets.reduce((v, s) => v + s.kg * s.reps, 0),
          saetze: w.sets.map((s) => ({
            uebung: s.exercise,
            satz: s.setIndex + 1,
            kg: s.kg,
            wdh: s.reps,
          })),
        }))
      );
    } catch (e) {
      return fehler(e);
    }
  }
);

server.registerTool(
  "satz_eintragen",
  {
    title: "Satz eintragen",
    description:
      "Trägt einen Satz für das heutige Training nach. Nützlich, wenn im Gym etwas vergessen wurde.",
    inputSchema: {
      uebung: z.string().min(1),
      satz: z.number().int().min(1).max(10).describe("Satznummer, 1-basiert"),
      kg: z.number().min(0).max(500),
      wdh: z.number().int().min(1).max(100),
    },
  },
  async ({ uebung, satz, kg, wdh }) => {
    try {
      datenbankPruefen();
      const heute = rotationFor(new Date());
      const kind = heute.art === "training" ? heute.einheit : SESSIONS.pull.key;
      const r = await satzSpeichern({
        kind,
        exercise: uebung,
        setIndex: satz - 1,
        kg,
        reps: wdh,
      });
      return r.ok
        ? antwort({ gespeichert: true, uebung, satz, kg, wdh })
        : fehler(new Error(r.fehler));
    } catch (e) {
      return fehler(e);
    }
  }
);

/**
 * Ernährung
 *
 * Bewusst nur lesen und vorschlagen, kein Werkzeug zum Setzen des Ziels.
 * "Der Coach schlägt vor, entscheidet aber nicht allein" — ein Werkzeugaufruf
 * ist Jakobs Ja nicht, auch dann nicht, wenn er im Chat zustimmt. Das Ziel
 * ändert sich ausschließlich über die Ja-Taste in der App; die dafür nötige
 * Server Action liegt in src/lib/ernaehrung-actions.ts und wird hier
 * absichtlich nicht importiert.
 */

server.registerTool(
  "ernaehrungsplan",
  {
    title: "Ernährungsplan",
    description:
      "Jakobs Mahlzeiten aus dem Fitnessbell-Plan mit Zutaten und Mengen, dazu das aktuell gültige Kalorien- und Makroziel. Der Plan ist nicht auf einzelne Mahlzeiten aufgeschlüsselt — die Makros sind Tagessummen.",
  },
  async () => {
    try {
      datenbankPruefen();
      const [mahlzeiten, ziel] = await Promise.all([mahlzeitenLesen(), aktuellesZiel()]);
      return antwort({ ziel, essensfenster: "05:20–18:00", mahlzeiten });
    } catch (e) {
      return fehler(e);
    }
  }
);

server.registerTool(
  "kalorienziel",
  {
    title: "Kalorienziel",
    description:
      "Das aktuelle Kalorien- und Makroziel, die vollständige Historie (wann wurde was warum gesetzt) und ein eventuell offener Vorschlag. Löst nichts aus — die Frage allein erzeugt keinen Vorschlag.",
    inputSchema: { anzahl: z.number().int().min(1).max(50).optional() },
  },
  async ({ anzahl }) => {
    try {
      datenbankPruefen();
      const [aktuell, historie, offen] = await Promise.all([
        aktuellesZiel(),
        zielHistorie(anzahl ?? 12),
        offenerVorschlag(),
      ]);
      return antwort({ aktuell, historie, offenerVorschlag: offen });
    } catch (e) {
      return fehler(e);
    }
  }
);

server.registerTool(
  "kalorienvorschlag_pruefen",
  {
    title: "Kalorienvorschlag prüfen",
    description:
      "Prüft, ob das Kalorienziel angepasst werden sollte, und legt bei Bedarf einen Vorschlag an, den Jakob in der App mit Ja oder Nein beantwortet. Ändert das Ziel NICHT. Antwortet ausdrücklich auch mit dem Grund, warum gerade nichts vorgeschlagen wird — etwa weil der Gewichtstrend nach einer Messlücke nicht verwertbar ist oder die letzte Anpassung noch keine zehn Tage zurückliegt.",
  },
  async () => {
    try {
      datenbankPruefen();
      // Dieselben 30 Tage wie loadDashboard() in der App: eine andere Spanne
      // ergäbe eine andere Rate, und der Vorschlag hinge davon ab, wer gefragt
      // hat — App oder Claude Desktop.
      const { gewicht } = await ladeGesundheit(30);
      return antwort(
        await vorschlagLage({
          gewicht,
          koerpergewichtKg: gewicht.at(-1)?.kg ?? null,
        })
      );
    } catch (e) {
      return fehler(e);
    }
  }
);


// ─────────────────────────────────────────────────────────────
// Übungskatalog
//
// Anders als beim Kalorienziel darf hier geschrieben werden. Der Grund ist
// nicht Nachlässigkeit, sondern der Zweck: eine Übung tauschen, weil das Gerät
// belegt ist oder die Schulter zwickt, ist genau die Entscheidung, die im
// Gespräch fällt und nicht per Formular. Ein falsch getauschtes Gerät ist
// zudem in einem Aufruf rückgängig gemacht — ein falsch gesetztes
// Kalorienziel läuft zehn Tage mit, bevor man es überhaupt merkt.
// ─────────────────────────────────────────────────────────────

const einheitSchema = z.enum(["push", "pull"]);

server.registerTool(
  "uebungen_lesen",
  {
    title: "Übungskatalog lesen",
    description:
      "Der aktuelle Split: welche Übungen in welcher Reihenfolge zu Push und Pull gehören, mit Notizen und Referenzgewichten. Grundlage für jedes Tauschen und Umsortieren.",
  },
  async () => {
    try {
      datenbankPruefen();
      return antwort(await katalogVollstaendig());
    } catch (e) {
      return fehler(e);
    }
  }
);

server.registerTool(
  "uebung_tauschen",
  {
    title: "Übung tauschen",
    description:
      "Ersetzt eine Übung durch eine andere und behält deren Platz in der Einheit. Die Sätze der alten Übung bleiben unter ihrem Namen in der Historie stehen — der Kraftverlauf findet sie weiter.",
    inputSchema: {
      einheit: einheitSchema,
      alt: z.string().min(1).describe("Name der Übung, die weichen soll"),
      neu: z.string().min(1).describe("Name der neuen Übung"),
      notiz: z.string().optional(),
      startKg: z.number().min(0).max(500).optional().describe("Referenzgewicht, solange nichts geloggt ist"),
      startWdh: z.array(z.number().int().min(1).max(50)).optional().describe("Wiederholungen je Satz, etwa [6, 5]"),
    },
  },
  async ({ einheit, alt, neu, notiz, startKg, startWdh }) => {
    try {
      datenbankPruefen();
      const r = await uebungTauschen(einheit as Einheit, alt, neu, { notiz, startKg, startWdh });
      return r.ok ? antwort({ getauscht: `${alt} → ${neu}`, katalog: r.katalog }) : fehler(new Error(r.fehler));
    } catch (e) {
      return fehler(e);
    }
  }
);

server.registerTool(
  "uebung_hinzufuegen",
  {
    title: "Übung hinzufügen",
    description: "Nimmt eine Übung neu in eine Einheit auf, wahlweise an einer bestimmten Stelle.",
    inputSchema: {
      einheit: einheitSchema,
      name: z.string().min(1),
      position: z.number().int().min(1).max(30).optional().describe("1-basiert; ohne Angabe ans Ende"),
      notiz: z.string().optional(),
      startKg: z.number().min(0).max(500).optional(),
      startWdh: z.array(z.number().int().min(1).max(50)).optional(),
    },
  },
  async ({ einheit, name, position, notiz, startKg, startWdh }) => {
    try {
      datenbankPruefen();
      const r = await uebungHinzufuegen(einheit as Einheit, name, { position, notiz, startKg, startWdh });
      return r.ok ? antwort({ hinzugefuegt: name, katalog: r.katalog }) : fehler(new Error(r.fehler));
    } catch (e) {
      return fehler(e);
    }
  }
);

server.registerTool(
  "uebung_entfernen",
  {
    title: "Übung entfernen",
    description:
      "Nimmt eine Übung aus der Einheit und schließt die Lücke in der Reihenfolge. Geloggte Sätze bleiben erhalten.",
    inputSchema: { einheit: einheitSchema, name: z.string().min(1) },
  },
  async ({ einheit, name }) => {
    try {
      datenbankPruefen();
      const r = await uebungEntfernen(einheit as Einheit, name);
      return r.ok ? antwort({ entfernt: name, katalog: r.katalog }) : fehler(new Error(r.fehler));
    } catch (e) {
      return fehler(e);
    }
  }
);

server.registerTool(
  "uebung_umbenennen",
  {
    title: "Übung umbenennen",
    description:
      "Benennt eine Übung um UND schreibt alle geloggten Sätze auf den neuen Namen um. Nur dafür ist dieses Werkzeug da: SetLog.exercise hält den Namen als Text, und ohne das Umschreiben hinge die Historie verwaist unter dem alten Namen — die Übung sähe im Kraftverlauf aus, als hätte sie nie stattgefunden.",
    inputSchema: { einheit: einheitSchema, alt: z.string().min(1), neu: z.string().min(1) },
  },
  async ({ einheit, alt, neu }) => {
    try {
      datenbankPruefen();
      const r = await uebungUmbenennen(einheit as Einheit, alt, neu);
      return r.ok
        ? antwort({ umbenannt: `${alt} → ${neu}`, saetzeUmgeschrieben: r.saetzeUmgeschrieben })
        : fehler(new Error(r.fehler));
    } catch (e) {
      return fehler(e);
    }
  }
);

server.registerTool(
  "uebungen_umsortieren",
  {
    title: "Übungen umsortieren",
    description:
      "Setzt die Reihenfolge einer Einheit neu. Die Liste muss ALLE Übungen der Einheit nennen — sonst wäre nicht bestimmt, wohin der Rest kommt.",
    inputSchema: { einheit: einheitSchema, reihenfolge: z.array(z.string().min(1)).min(1) },
  },
  async ({ einheit, reihenfolge }) => {
    try {
      datenbankPruefen();
      const r = await uebungenUmsortieren(einheit as Einheit, reihenfolge);
      return r.ok ? antwort({ katalog: r.katalog }) : fehler(new Error(r.fehler));
    } catch (e) {
      return fehler(e);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// Kraft
// ─────────────────────────────────────────────────────────────

server.registerTool(
  "kraftfortschritt",
  {
    title: "Kraftfortschritt",
    description:
      "Geschätztes Maximum je Übung (Epley aus dem besten Satz je Trainingstag), Bestleistung und Urteil, ob es steigt. Ohne Übungsname die Rangliste aller Übungen, aufsteigend — was hängt, steht oben. Verglichen wird in Prozent pro vier Wochen, weil 2,5 kg je nach Übung ein Achtel oder ein Fünfzigstel sind. Das Urteil sagt ausdrücklich auch, wann es NICHT rechnet: unter vier Trainingstagen oder 21 Tagen Spanne wäre jede Zahl geraten.",
    inputSchema: { uebung: z.string().min(1).optional() },
  },
  async ({ uebung }) => {
    try {
      datenbankPruefen();

      if (uebung) {
        const saetze = await saetzeFuer(uebung);
        if (saetze.length === 0) {
          return antwort({ uebung, hinweis: "Keine geloggten Sätze in den letzten 120 Tagen." });
        }
        const best = besterSatz(saetze);
        return antwort({
          uebung,
          saetze: saetze.length,
          bestleistung: best ? { kg: best.kg, wdh: best.reps, e1rm: e1rm(best) } : null,
          reihe: e1rmReihe(saetze),
          urteil: kraftTrend(e1rmReihe(saetze)),
        });
      }

      const proUebung = await saetzeProUebung();
      return antwort(
        rangliste(proUebung).map((rang) => {
          const best = besterSatz(proUebung[rang.uebung]);
          return {
            uebung: rang.uebung,
            bestleistung: best ? { kg: best.kg, wdh: best.reps, e1rm: e1rm(best) } : null,
            urteil: rang.urteil,
          };
        })
      );
    } catch (e) {
      return fehler(e);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// Bankdrücken 5/3/1
// ─────────────────────────────────────────────────────────────

server.registerTool(
  "bank_plan_heute",
  {
    title: "Bankdrücken heute",
    description:
      "Wo das 5/3/1 gerade steht: Zyklus, Programmwoche, Trainingsmax und die drei Sätze mit Gewicht. Bank-Tag ist jede zweite Push-Einheit, also alle sechs Tage. Ohne Trainingsmax steht hier der Hinweis, dass er fehlt — Kadenz schätzt ihn nicht.",
  },
  async () => {
    try {
      datenbankPruefen();
      const rotation = rotationFor(new Date());

      if (rotation.art !== "training" || rotation.pushIndex === null) {
        return antwort({
          hinweis:
            rotation.art === "pause"
              ? "Heute ist Rest Day."
              : "Heute ist Pull — Bankdrücken liegt in der Push-Einheit.",
        });
      }

      const stand = await bankstandFuer(rotation.pushIndex);
      return antwort({
        bankTag: stand.position.istBankTag,
        zyklus: stand.position.zyklus,
        woche: stand.position.woche,
        naechsterBankTag: stand.naechsterBankTag,
        trainingsmax: stand.tm,
        saetze: stand.vorgabe.saetze,
        hinweis: stand.vorgabe.hinweis,
      });
    } catch (e) {
      return fehler(e);
    }
  }
);

server.registerTool(
  "bank_trainingsmax",
  {
    title: "Trainingsmax lesen",
    description:
      "Der aktuelle Trainingsmax fürs Bankdrücken samt Historie — jeder Zyklus mit der Begründung, warum er gestiegen, geblieben oder zurückgesetzt worden ist.",
    inputSchema: { anzahl: z.number().int().min(1).max(50).optional() },
  },
  async ({ anzahl }) => {
    try {
      datenbankPruefen();
      return antwort({
        aktuell: await aktuellerTrainingsmax(),
        historie: await trainingsmaxHistorie(anzahl ?? 10),
      });
    } catch (e) {
      return fehler(e);
    }
  }
);

server.registerTool(
  "bank_tm_setzen",
  {
    title: "Trainingsmax setzen",
    description:
      "Setzt den Trainingsmax fürs Bankdrücken. Nötig zum Einstieg — Langhantel-Bankdrücken hat in Kadenz keine Historie, aus der er sich schätzen ließe — und danach nur noch als Korrektur. Der Trainingsmax ist rund 90 % dessen, was einmal sicher geht, nicht der Tagesrekord. Im laufenden Betrieb schreibt Kadenz ihn nach jedem Zyklus selbst fort.",
    inputSchema: {
      kg: z.number().min(20).max(300),
      begruendung: z.string().min(1).describe("Woher die Zahl stammt — landet unverändert in der Historie"),
    },
  },
  async ({ kg, begruendung }) => {
    try {
      datenbankPruefen();
      const r = await trainingsmaxSetzen(kg, begruendung);
      return r.ok ? antwort({ gesetzt: r.tm }) : fehler(new Error(r.fehler));
    } catch (e) {
      return fehler(e);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// Tagesbriefing
// ─────────────────────────────────────────────────────────────

server.registerTool(
  "briefing_heute",
  {
    title: "Briefing heute",
    description:
      "Wie die Nacht war und was daraus folgt: Schlafdauer und Tiefschlaf gegen Jakobs persönliche Referenz, die Freigabe für Kraft und Cardio und konkrete Verbesserungsvorschläge. Jeder Vorschlag hängt an einem gemessenen Wert — liegt keiner daneben, ist die Liste leer, und genau das ist die Aussage. Dieselbe Funktion erzeugt den Text auf der Startseite.",
  },
  async () => {
    try {
      const { series, baseline } = await ladeGesundheit(30);
      const heute = series.at(-1);
      if (!heute || !baseline) {
        return antwort({ hinweis: "Noch keine vollständige Nacht mit Ruhepuls und HRV." });
      }

      return antwort(
        briefing({
          heute,
          baseline,
          urteil: readiness(heute, baseline),
          nachtDatum: heute.date,
          heuteIso: heuteWien(),
          trainingHeute: rotationFor(new Date()).art === "training",
          stunde: wienerStunde(),
        })
      );
    } catch (e) {
      return fehler(e);
    }
  }
);

/**
 * Kein Top-Level-await: das Projekt hat keinen Modultyp gesetzt, tsx übersetzt
 * daher nach CommonJS, und dort ist es nicht erlaubt.
 *
 * Fehler gehen auf stderr — stdout gehört ausschließlich dem MCP-Protokoll,
 * jede Zeile daneben würde die Verbindung zerstören.
 */
async function main() {
  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  console.error("MCP-Server konnte nicht starten:", e);
  process.exit(1);
});
