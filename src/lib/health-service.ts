import { cookies } from "next/headers";
import { refreshTokenLesen } from "./auth-store";
import {
  listDataPoints,
  refreshAccessToken,
  type ListResult,
} from "./google-health";
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
  type DailyReadiness,
} from "./health-mapper";
import {
  assessTrend,
  movingAverage,
  readiness,
  type ReadinessVerdict,
  type TrendVerdict,
  type WeightEntry,
} from "./coach";
import { datenbankKonfiguriert, fehlendeGoogleVariablen } from "./konfiguration";

/**
 * Eine Quelle für Dashboard und API-Route — sonst driften die beiden
 * Auswertungen auseinander und die Seite zeigt etwas anderes als der Endpunkt.
 */
export type Dashboard =
  | { verbunden: false; grund: string }
  | {
      verbunden: true;
      baseline: DailyReadiness | null;
      heute: (DailyReadiness & { regeneration: ReadinessVerdict }) | null;
      gewicht: {
        reihe: WeightEntry[];
        aktuell: WeightEntry | null;
        schnitt7: number | null;
        trend: TrendVerdict;
      };
      tagesreihe: DailyReadiness[];
      unvollstaendig: string[];
    };

export async function loadDashboard(days = 30): Promise<Dashboard> {
  // Fehlende Variablen zuerst, und mit Namen: auf Vercel ist das der
  // wahrscheinlichste Grund, warum nichts kommt. "Nicht verbunden" würde Jakob
  // zum Login schicken, der dann aus demselben Grund auch scheitert.
  const fehlend = fehlendeGoogleVariablen();
  if (fehlend.length > 0) {
    return {
      verbunden: false,
      grund: `Google Health ist nicht eingerichtet — es fehlt: ${fehlend.join(
        ", "
      )}. In den Vercel-Projekteinstellungen bzw. in .env.local nachtragen.`,
    };
  }

  // Cookie zuerst, Datenbank als Rückfall: so funktioniert das Dashboard auch
  // in einem Browser, in dem noch nie eingeloggt wurde, solange der Login
  // irgendwann einmal stattgefunden hat.
  const jar = await cookies();
  let refresh: string | null = jar.get("kadenz_google_refresh")?.value ?? null;

  if (!refresh && datenbankKonfiguriert()) {
    try {
      refresh = await refreshTokenLesen();
    } catch (e) {
      // Eine nicht erreichbare Datenbank ist etwas anderes als ein fehlender
      // Login. Ohne diese Unterscheidung stand hier bisher ein 500.
      return {
        verbunden: false,
        grund: `Die Datenbank ist gerade nicht erreichbar: ${
          e instanceof Error ? e.message : String(e)
        }`,
      };
    }
  }

  if (!refresh) {
    return { verbunden: false, grund: "Noch nicht mit Google Health verbunden." };
  }

  let accessToken: string;
  try {
    accessToken = (await refreshAccessToken(refresh)).access_token;
  } catch (e) {
    return {
      verbunden: false,
      grund: e instanceof Error ? e.message : "Token konnte nicht erneuert werden.",
    };
  }

  const to = new Date();
  const from = new Date(to.getTime() - days * 864e5);
  const range = { from, to };

  // Bisher ungesichert: eine Absage von Google — abgelaufener Testnutzer,
  // entzogener Scope, Netzwerk weg — riss alle drei Seiten in einen 500.
  let ergebnisse: [
    ListResult<ApiSleepPoint>,
    ListResult<ApiRestingHrPoint>,
    ListResult<ApiHrvPoint>,
    ListResult<ApiWeightPoint>,
  ];
  try {
    ergebnisse = await Promise.all([
      listDataPoints<ApiSleepPoint>(accessToken, "sleep", range),
      listDataPoints<ApiRestingHrPoint>(accessToken, "restingHeartRate", range),
      listDataPoints<ApiHrvPoint>(accessToken, "hrv", range),
      listDataPoints<ApiWeightPoint>(accessToken, "weight", range),
    ]);
  } catch (e) {
    return {
      verbunden: false,
      grund: `Google Health hat die Abfrage abgelehnt: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }
  const [sleepRes, hrRes, hrvRes, weightRes] = ergebnisse;

  const nights = mapSleep(sleepRes.points);
  const { series, unvollstaendig } = buildDailySeries(
    nights,
    mapRestingHr(hrRes.points),
    nightlyHrv(hrvRes.points, nights)
  );

  const reihe = mapWeight(weightRes.points);
  const baseline = deriveBaseline(series);
  const latest = series.at(-1) ?? null;

  return {
    verbunden: true,
    baseline,
    heute:
      latest && baseline
        ? { ...latest, regeneration: readiness(latest, baseline) }
        : null,
    gewicht: {
      reihe,
      aktuell: reihe.at(-1) ?? null,
      schnitt7: movingAverage(reihe, 7),
      trend: assessTrend(reihe),
    },
    tagesreihe: series,
    unvollstaendig,
  };
}
