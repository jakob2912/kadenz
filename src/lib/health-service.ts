import { cookies } from "next/headers";
import { refreshTokenLesen } from "./auth-store";
import { listDataPoints, refreshAccessToken } from "./google-health";
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
  // Cookie zuerst, Datenbank als Rückfall: so funktioniert das Dashboard auch
  // in einem Browser, in dem noch nie eingeloggt wurde, solange der Login
  // irgendwann einmal stattgefunden hat.
  const jar = await cookies();
  const refresh =
    jar.get("kadenz_google_refresh")?.value ?? (await refreshTokenLesen());

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

  const [sleepRes, hrRes, hrvRes, weightRes] = await Promise.all([
    listDataPoints<ApiSleepPoint>(accessToken, "sleep", range),
    listDataPoints<ApiRestingHrPoint>(accessToken, "restingHeartRate", range),
    listDataPoints<ApiHrvPoint>(accessToken, "hrv", range),
    listDataPoints<ApiWeightPoint>(accessToken, "weight", range),
  ]);

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
