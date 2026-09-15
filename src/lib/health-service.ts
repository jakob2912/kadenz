import { cookies } from "next/headers";
import { cacheLife, cacheTag } from "next/cache";
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

/**
 * Warum diese Datei einen Cache braucht und welchen.
 *
 * Der Abruf bei Google ist der teure Teil jedes Tab-Wechsels: ein
 * OAuth-Refresh, dann vier Datenabrufe. Heute, Essen, Verlauf und Coach
 * brauchen ihn alle vier.
 *
 * Vorher stand hier `"use cache: private"`. Das war der falsche Griff, und
 * zwar aus einem Grund, der in der Doku steht: eine private Zwischenablage
 * wird NIE auf dem Server abgelegt, sondern nur im Speicher des Browsers —
 * und die Funktion "läuft bei jedem Server-Render". Genau das war zu messen:
 * jeder Tab-Wechsel kostete unverändert vier bis fünf Sekunden, auch beim
 * dritten Mal, weil jede RSC-Anfrage den vollen Abruf neu bezahlte. Der
 * Kommentar an dieser Stelle hat einen Nutzen behauptet, den es nicht gab.
 *
 * Das gewöhnliche `"use cache"` legt das Ergebnis dagegen serverseitig ab und
 * teilt es über alle Renderdurchläufe und alle vier Seiten hinweg. Es darf
 * dafür kein cookies() sehen — deshalb liest gesundheitsdaten() den
 * Refresh-Token aus der eigenen Datenbank statt aus dem Cookie. Beides steht
 * ohnehin nebeneinander: der Login schreibt den Token in beide Ablagen (siehe
 * api/auth/google/callback), und die Datenbank ist die dauerhafte von beiden
 * — der MCP-Server liest sie schon immer.
 *
 * Der Preis, und er ist eine bewusste Entscheidung: die ausgewerteten
 * Gesundheitsdaten liegen jetzt bis zu fünf Minuten in Vercels Datencache
 * statt ausschließlich im Browser. Wer das nicht will, hat nur einen Weg
 * unter zwei Sekunden — die Tagesreihe in der eigenen Supabase ablegen und
 * von dort lesen. Siehe die Notiz am Ende dieser Datei.
 */

/** Trägt den Grund, warum keine Daten kommen, aus dem Cache heraus. */
class NichtVerbundenFehler extends Error {}

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

  /* Ohne Datenbank bleibt nur das Cookie, und dieser Weg lässt sich nicht
     zwischenspeichern — cookies() ist in "use cache" nicht erlaubt. Das ist
     der Ausnahmefall (DATABASE_URL nicht gesetzt), nicht der Normalbetrieb. */
  if (!datenbankKonfiguriert()) {
    const jar = await cookies();
    const refresh = jar.get("kadenz_google_refresh")?.value;
    return alsLage(async () => {
      if (!refresh) throw new NichtVerbundenFehler("Noch nicht mit Google Health verbunden.");
      return auswerten(refresh, days);
    });
  }

  return gesundheitsdaten(days);
}

/**
 * Fehlschläge in ein { verbunden: false } übersetzen — INNERHALB des Scopes,
 * in dem sie geworfen werden.
 *
 * Vorher wurde NichtVerbundenFehler aus der gecachten Funktion hinausgeworfen
 * und in loadDashboard() per instanceof aufgefangen. Das hat nie funktioniert:
 * über die "use cache"-Grenze kommt ein Fehler serialisiert an, als schlichtes
 * Error mit einem digest, und instanceof ist dort immer falsch. Aufgefallen
 * ist es am 15.09.2026, als Googles Refresh-Token ablief — statt "nicht
 * verbunden" zeigten Heute, Essen, Verlauf und Coach "This page couldn't
 * load". Genau der Fall, für den die Unterscheidung gebaut war, war der
 * einzige, in dem sie gebraucht wurde, und dort griff sie nicht.
 *
 * Unerwartete Fehler — ein Programmierfehler in der Auswertung — laufen
 * weiter durch. Die sollen sichtbar sein, nicht als "nicht verbunden"
 * verkleidet.
 */
async function alsLage(ermitteln: () => Promise<Dashboard>): Promise<Dashboard> {
  try {
    return await ermitteln();
  } catch (e) {
    if (e instanceof NichtVerbundenFehler) return { verbunden: false, grund: e.message };
    throw e;
  }
}

/**
 * Der teure Teil, serverseitig zwischengespeichert.
 *
 * Fünf Minuten, wenn es geklappt hat: Schlaf und Ruhepuls stehen nach der
 * Nacht fest, und das Morgengewicht wird einmal am Tag eingetragen. Wer es
 * einträgt, soll es trotzdem sofort sehen — dafür ruft gewichtEintragen()
 * updateTag("gesundheit") auf.
 *
 * Dreißig Sekunden, wenn nicht. Ein Fehlschlag wird ebenfalls abgelegt,
 * aber nur kurz (bedingte cacheLife, siehe Next-Doku "Conditional cache
 * lifetimes"). Das ist absichtlich: ohne Ablage liefe bei abgelaufenem Token
 * jeder Tab-Wechsel erneut gegen Google in dieselbe Absage. Und nach dem
 * erneuten Login verwirft der OAuth-Callback den Eintrag ohnehin sofort.
 */
async function gesundheitsdaten(days: number): Promise<Dashboard> {
  "use cache";
  cacheTag("gesundheit");

  const lage = await alsLage(async () => {
    let refresh: string | null;
    try {
      refresh = await refreshTokenLesen();
    } catch (e) {
      // Eine nicht erreichbare Datenbank ist etwas anderes als ein fehlender
      // Login. Ohne diese Unterscheidung stand hier bisher ein 500.
      throw new NichtVerbundenFehler(
        `Die Datenbank ist gerade nicht erreichbar: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }

    if (!refresh) throw new NichtVerbundenFehler("Noch nicht mit Google Health verbunden.");
    return auswerten(refresh, days);
  });

  // Genau ein cacheLife je Aufruf, je nach Ausgang.
  if (lage.verbunden) {
    cacheLife({ stale: 300, revalidate: 300, expire: 900 });
  } else {
    cacheLife({ stale: 30, revalidate: 30, expire: 60 });
  }

  return lage;
}

/** OAuth-Refresh, die vier Abrufe, die Auswertung. */
async function auswerten(refresh: string, days: number): Promise<Dashboard> {
  let accessToken: string;
  try {
    accessToken = (await refreshAccessToken(refresh)).access_token;
  } catch (e) {
    const text = e instanceof Error ? e.message : "Token konnte nicht erneuert werden.";

    /* invalid_grant heißt: Google nimmt diesen Refresh-Token nicht mehr an.
       Bei Kadenz ist das kein Ausnahmefall, sondern der Wochenrhythmus — das
       OAuth-Projekt steht auf "Testing", und Google lässt Refresh-Tokens von
       Apps im Testmodus nach sieben Tagen verfallen. Der Rohtext ("Token-
       Anfrage fehlgeschlagen (400): invalid_grant — Token has been expired or
       revoked") stand bis zum 15.09.2026 so auf der Seite. Er ist richtig,
       aber er sagt nicht, was zu tun ist. */
    if (text.includes("invalid_grant")) {
      throw new NichtVerbundenFehler(
        "Die Verbindung zu Google Health ist abgelaufen. Einmal neu verbinden, dann " +
          "laufen Schlaf, Ruhepuls, HRV und Gewicht wieder. Das passiert etwa jede " +
          "Woche, solange das Google-Projekt im Testmodus steht."
      );
    }

    throw new NichtVerbundenFehler(text);
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
    throw new NichtVerbundenFehler(
      `Google Health hat die Abfrage abgelehnt: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
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

/*
 * Offen, und der nächste sinnvolle Schritt: die Tagesreihe in der eigenen
 * Datenbank ablegen.
 *
 * Der Cache oben löst den Tab-Wechsel, aber er läuft alle fünf Minuten ab, und
 * eine kalt gestartete Funktion auf Vercel findet ihn gar nicht vor — dann
 * kostet der erste Aufruf wieder den vollen Abruf bei Google. Schlaf,
 * Ruhepuls und HRV eines vergangenen Tages ändern sich aber nie mehr. Sie
 * gehören einmal geschrieben und danach gelesen: eine Tabelle neben Workout
 * und SetLog, ein Abgleich, der nur das Fenster seit dem letzten Eintrag holt.
 * Lesen wäre dann eine Abfrage in der Größenordnung von 50 Millisekunden
 * statt eines Abrufs von anderthalb Sekunden, unabhängig vom Cache, und die
 * Daten lägen in Jakobs eigener Supabase statt in Vercels Datencache.
 */
