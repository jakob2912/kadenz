"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { refreshAccessToken, writeWeight } from "./google-health";

/**
 * Morgengewicht aus dem Dashboard zurück nach Google Health.
 *
 * Der Schreibweg ist bewusst hier und nicht in health-service.ts: dort wird
 * gelesen und ausgewertet, hier wird eine Einzeleingabe abgesetzt. Die
 * Fehlerform ist dieselbe wie bei satzSpeichern in workouts.ts, damit die
 * Oberfläche überall gleich damit umgeht.
 */

/** Plausibilitätsrahmen. Alles außerhalb ist ein Tippfehler, kein Messwert. */
const MIN_KG = 30;
const MAX_KG = 250;

/** Google-Fehlertexte enthalten die rohe API-Antwort — gekürzt bleibt die Karte lesbar. */
const MAX_FEHLERLAENGE = 160;

export type EintragErgebnis =
  | { ok: true; kg: number }
  | { ok: false; fehler: string };

export async function gewichtEintragen(kg: number): Promise<EintragErgebnis> {
  // Eine Server Action ist ein offener POST-Endpunkt. Was die Oberfläche
  // schickt, wird hier noch einmal geprüft — die Prüfung im Browser ist
  // Komfort, keine Grenze.
  if (typeof kg !== "number" || !Number.isFinite(kg)) {
    return { ok: false, fehler: "Das ist keine gültige Zahl." };
  }

  const gerundet = Math.round(kg * 100) / 100;
  if (gerundet < MIN_KG || gerundet > MAX_KG) {
    return {
      ok: false,
      fehler: `Gewicht muss zwischen ${MIN_KG} und ${MAX_KG} kg liegen.`,
    };
  }

  const jar = await cookies();
  const refresh = jar.get("kadenz_google_refresh")?.value;
  if (!refresh) {
    return {
      ok: false,
      fehler: "Nicht mit Google Health verbunden. Bitte erst über /api/auth/google anmelden.",
    };
  }

  let accessToken: string;
  try {
    accessToken = (await refreshAccessToken(refresh)).access_token;
  } catch (e) {
    return { ok: false, fehler: `Google-Zugang ließ sich nicht erneuern: ${kurz(e)}` };
  }

  try {
    await writeWeight(accessToken, gerundet, new Date());
  } catch (e) {
    return { ok: false, fehler: `Google Health hat den Wert nicht angenommen: ${kurz(e)}` };
  }

  // Dashboard und Verlauf lesen Gewicht, 7-Tage-Schnitt und Trend serverseitig
  // aus derselben Quelle. Ohne das stünde nach dem Eintragen noch der alte
  // Wert auf der Seite.
  revalidatePath("/");
  revalidatePath("/verlauf");

  return { ok: true, kg: gerundet };
}

function kurz(e: unknown): string {
  const text = e instanceof Error ? e.message : "Unbekannter Fehler";
  return text.length > MAX_FEHLERLAENGE ? `${text.slice(0, MAX_FEHLERLAENGE)}…` : text;
}
