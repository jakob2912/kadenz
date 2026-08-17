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

import { assessTrend, movingAverage, readiness, weeksToGoal } from "../src/lib/coach";
import { planMitHistorie, sessionFor, SESSIONS } from "../src/lib/plan";
import { satzSpeichern } from "../src/lib/workouts";
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
      const heute = sessionFor(new Date());
      if (heute.art === "pause") {
        return antwort({ art: "pause", naechste: heute.naechste.focus });
      }
      const uebungen = await planMitHistorie(heute.session);
      return antwort({
        art: "training",
        einheit: heute.session.focus,
        titel: heute.session.title,
        uebungen: uebungen.map((u) => ({
          name: u.name,
          zuletzt: u.prev,
          startgewicht: u.ziel,
          aenderung: u.delta,
          begruendung: u.grund,
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
      const heute = sessionFor(new Date());
      const kind = heute.art === "training" ? heute.session.key : SESSIONS.pull.key;
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
