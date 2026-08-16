/**
 * Google Health API — OAuth und Datenzugriff
 *
 * Nachfolger der Fitbit Web API, die im September 2026 abgeschaltet wird.
 * Läuft im Testmodus bis 100 Nutzer ohne Security-Review; Jakob ist als
 * Testnutzer im Projekt kadenz-505709 eingetragen.
 *
 * Nur serverseitig verwenden — greift auf das Client Secret zu.
 */

const OAUTH_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN = "https://oauth2.googleapis.com/token";
const API_BASE = "https://health.googleapis.com/v4";

const SCOPE_PREFIX = "https://www.googleapis.com/auth/googlehealth";

export const SCOPES = [
  `${SCOPE_PREFIX}.sleep.readonly`,
  `${SCOPE_PREFIX}.health_metrics_and_measurements.readonly`,
  // Schreibrecht, damit das Morgengewicht aus der App auch in Google Health landet
  `${SCOPE_PREFIX}.health_metrics_and_measurements.writeonly`,
  `${SCOPE_PREFIX}.activity_and_fitness.readonly`,
];

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} fehlt in .env.local`);
  return v;
}

// ─────────────────────────────────────────────────────────────
// OAuth
// ─────────────────────────────────────────────────────────────

export function authUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: env("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: SCOPES.join(" "),
    // offline + consent sind nötig, damit Google einen refresh_token liefert.
    // Ohne den kann der nächtliche Job ohne Jakob am Gerät nichts abrufen.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${OAUTH_AUTH}?${p}`;
}

export type Tokens = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const res = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `Token-Anfrage fehlgeschlagen (${res.status}): ${json.error ?? "unbekannt"} — ${
        json.error_description ?? ""
      }`
    );
  }
  return json as Tokens;
}

export function exchangeCode(code: string): Promise<Tokens> {
  return tokenRequest({
    code,
    client_id: env("GOOGLE_CLIENT_ID"),
    client_secret: env("GOOGLE_CLIENT_SECRET"),
    redirect_uri: env("GOOGLE_REDIRECT_URI"),
    grant_type: "authorization_code",
  });
}

export function refreshAccessToken(refreshToken: string): Promise<Tokens> {
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: env("GOOGLE_CLIENT_ID"),
    client_secret: env("GOOGLE_CLIENT_SECRET"),
    grant_type: "refresh_token",
  });
}

// ─────────────────────────────────────────────────────────────
// Datenzugriff
// ─────────────────────────────────────────────────────────────

/**
 * Jeder Datentyp hat eine Datensatzart (Interval / Session / Sample / Daily),
 * und jede Art filtert über einen ANDEREN Feldpfad:
 *
 *   Interval → {typ}.interval.start_time
 *   Session  → sleep.interval.end_time
 *   Sample   → {typ}.sample_time.physical_time
 *   Daily    → {typ}.date
 *
 * Erlaubt sind nur die Operatoren >= und < — ein <= liefert
 * INVALID_DATA_POINT_FILTER_RESTRICTION_COMPARABLE.
 *
 * Zur Schreibweise des Typ-Präfixes widerspricht sich Googles Doku: an einer
 * Stelle heißt es snake_case ("body_fat"), die Beispiele zeigen camelCase
 * ("heartRateVariability"). Deshalb steht hier pro Typ eine Liste von
 * Kandidaten, die der Reihe nach probiert werden.
 */
export type DataTypeSpec = {
  /** kebab-case, so wie er im URL-Pfad steht */
  path: string;
  /** Filter-Feldpfade, in Reihenfolge der Wahrscheinlichkeit */
  filterFields: string[];
  /** Daily-Typen vergleichen gegen ein Datum, alles andere gegen RFC-3339 */
  literal: "timestamp" | "date";
  /** sleep und exercise deckelt die API bei 25 */
  maxPageSize: number;
};

export const DATA_TYPES = {
  sleep: {
    path: "sleep",
    filterFields: ["sleep.interval.end_time"],
    literal: "timestamp",
    maxPageSize: 25,
  },
  restingHeartRate: {
    path: "daily-resting-heart-rate",
    filterFields: ["dailyRestingHeartRate.date", "daily_resting_heart_rate.date"],
    literal: "date",
    maxPageSize: 100,
  },
  hrv: {
    path: "heart-rate-variability",
    filterFields: [
      "heartRateVariability.sample_time.physical_time",
      "heart_rate_variability.sample_time.physical_time",
    ],
    literal: "timestamp",
    maxPageSize: 100,
  },
  weight: {
    path: "weight",
    filterFields: ["weight.sample_time.physical_time"],
    literal: "timestamp",
    maxPageSize: 100,
  },
  steps: {
    path: "steps",
    filterFields: ["steps.interval.start_time"],
    literal: "timestamp",
    maxPageSize: 100,
  },
} as const satisfies Record<string, DataTypeSpec>;

export type DataTypeKey = keyof typeof DATA_TYPES;

async function apiFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Health API ${res.status} bei ${path}: ${text.slice(0, 400)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export type DataPointPage<T = unknown> = {
  dataPoints?: T[];
  nextPageToken?: string;
};

function literalFor(spec: DataTypeSpec, d: Date): string {
  return spec.literal === "date" ? d.toISOString().slice(0, 10) : d.toISOString();
}

/** Nur >= und < sind erlaubt; das obere Ende ist deshalb exklusiv. */
function buildFilter(spec: DataTypeSpec, field: string, from: Date, to: Date): string {
  return `${field} >= "${literalFor(spec, from)}" AND ${field} < "${literalFor(spec, to)}"`;
}

export type ListResult<T> = {
  points: T[];
  /** Welcher Feldpfad tatsächlich funktioniert hat — für Diagnose und Doku. */
  filterField: string;
};

/**
 * Liest alle Datenpunkte eines Typs im Zeitfenster.
 * Probiert die Filter-Kandidaten der Reihe nach durch: schlägt einer mit
 * INVALID_DATA_POINT_FILTER fehl, wird der nächste versucht. Andere Fehler
 * (Rechte, Netzwerk) werden sofort durchgereicht — die will man sehen.
 */
export async function listDataPoints<T = unknown>(
  accessToken: string,
  key: DataTypeKey,
  opts: { from: Date; to: Date }
): Promise<ListResult<T>> {
  const spec: DataTypeSpec = DATA_TYPES[key];
  let lastFilterError: unknown;

  for (const field of spec.filterFields) {
    const out: T[] = [];
    let pageToken: string | undefined;

    try {
      do {
        const q = new URLSearchParams({
          filter: buildFilter(spec, field, opts.from, opts.to),
          pageSize: String(spec.maxPageSize),
        });
        if (pageToken) q.set("pageToken", pageToken);

        const page = await apiFetch<DataPointPage<T>>(
          accessToken,
          `/users/me/dataTypes/${spec.path}/dataPoints?${q}`
        );
        out.push(...(page.dataPoints ?? []));
        pageToken = page.nextPageToken;
      } while (pageToken);

      return { points: out, filterField: field };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("INVALID_DATA_POINT_FILTER")) throw e;
      lastFilterError = e;
    }
  }

  throw lastFilterError ?? new Error(`Kein gültiger Filter für ${key}`);
}

/** Schreibt ein Gewicht zurück nach Google Health, damit dort alles zusammenläuft. */
export async function writeWeight(
  accessToken: string,
  kg: number,
  at: Date = new Date()
): Promise<void> {
  await apiFetch(accessToken, `/users/me/dataTypes/${DATA_TYPES.weight.path}/dataPoints`, {
    method: "POST",
    body: JSON.stringify({
      startTime: at.toISOString(),
      endTime: at.toISOString(),
      value: { weight: { kilograms: kg } },
    }),
  });
}
