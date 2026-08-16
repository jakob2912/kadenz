import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { listDataPoints, refreshAccessToken } from "@/lib/google-health";
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
} from "@/lib/health-mapper";
import { assessTrend, movingAverage, readiness } from "@/lib/coach";

/**
 * /api/health/summary — der ausgewertete Stand.
 *
 * Liefert nicht mehr die Rohantworten, sondern das, was der Coach daraus
 * ableitet: Tagesreihe, persönliche Baseline, Regeneration und Trendurteil.
 * Mit ?roh=1 gibt es zusätzlich je drei Rohpunkte zum Nachschauen.
 */
export async function GET(request: Request) {
  const jar = await cookies();
  const refresh = jar.get("kadenz_google_refresh")?.value;
  if (!refresh) {
    return NextResponse.json(
      { fehler: "Nicht verbunden.", tipp: "Zuerst /api/auth/google aufrufen." },
      { status: 401 }
    );
  }

  const params = new URL(request.url).searchParams;
  const days = Number(params.get("tage") ?? 30);
  const to = new Date();
  const from = new Date(to.getTime() - days * 864e5);

  let accessToken: string;
  try {
    accessToken = (await refreshAccessToken(refresh)).access_token;
  } catch (e) {
    return NextResponse.json(
      {
        fehler: "Access-Token konnte nicht erneuert werden.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 401 }
    );
  }

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
  const weights = mapWeight(weightRes.points);
  const baseline = deriveBaseline(series);
  const latest = series.at(-1);

  return NextResponse.json({
    zeitraum: { von: from.toISOString().slice(0, 10), bis: to.toISOString().slice(0, 10) },

    baseline: baseline
      ? {
          ...baseline,
          hinweis:
            "Aus der jeweils besseren Hälfte der Tage — nicht der Mittelwert, " +
            "sonst würde eine Urlaubswoche die Referenz mitverschieben.",
        }
      : { fehler: "Zu wenige Tage mit HRV und Ruhepuls für eine Baseline." },

    heute:
      latest && baseline
        ? {
            datum: latest.date,
            schlaf: `${Math.floor(latest.sleepMin / 60)} h ${latest.sleepMin % 60} m`,
            tiefschlaf: `${latest.deepMin} min`,
            ruhepuls: latest.restingHr,
            hrv: latest.hrv,
            regeneration: readiness(latest, baseline),
          }
        : { fehler: "Noch keine auswertbare Nacht." },

    gewicht: {
      anzahl: weights.length,
      aktuell: weights.at(-1) ?? null,
      schnitt7: movingAverage(weights, 7),
      trend: assessTrend(weights),
      reihe: weights,
    },

    tagesreihe: series,
    verworfen: {
      naechte: unvollstaendig,
      grund: "Ruhepuls oder HRV fehlt — lieber weglassen als mit Nullen rechnen.",
    },

    filterFelder: {
      schlaf: sleepRes.filterField,
      ruhepuls: hrRes.filterField,
      hrv: hrvRes.filterField,
      gewicht: weightRes.filterField,
    },

    ...(params.get("roh")
      ? {
          roh: {
            schlaf: sleepRes.points.slice(0, 1),
            ruhepuls: hrRes.points.slice(0, 3),
            hrv: hrvRes.points.slice(0, 3),
            gewicht: weightRes.points.slice(0, 3),
          },
        }
      : {}),
  });
}
