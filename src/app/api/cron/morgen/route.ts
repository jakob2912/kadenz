import { NextResponse } from "next/server";
import { loadDashboard } from "@/lib/health-service";
import { rotationMitPlan } from "@/lib/wochenplan";
import { heuteWien } from "@/lib/datum";
import { cronAbweisen } from "@/lib/cron";
import { anAlleSenden, benachrichtigungenLesen } from "@/lib/push";
import { morgenNachricht, type MorgenLage } from "@/lib/benachrichtigung-texte";

/**
 * Morgen-Nachricht — von Vercel Cron aufgerufen, siehe vercel.json.
 *
 * Der Zeitplan steht in UTC und Vercel kennt keine Zeitzonen: 05:15 UTC ist
 * im Winter 06:15, im Sommer 07:15 in Wien. Im Gratis-Tarif läuft der Job
 * zudem irgendwann innerhalb dieser Stunde, nicht auf die Minute.
 */
export async function GET(request: Request) {
  const abgewiesen = cronAbweisen(request);
  if (abgewiesen) return abgewiesen;

  if (!(await benachrichtigungenLesen()).morgen) {
    return NextResponse.json({ gesendet: false, grund: "ausgeschaltet" });
  }

  const heute = heuteWien();
  const [daten, rotation] = await Promise.all([loadDashboard(30), rotationMitPlan(new Date())]);

  const lage: MorgenLage = daten.verbunden
    ? {
        verbunden: true,
        // Nur die Nacht auf heute zählt. Hat die Uhr nicht synchronisiert,
        // wäre die Zahl von gestern — und die als heutige zu melden ist
        // schlimmer als keine.
        regeneration:
          daten.heute && daten.heute.date === heute
            ? { score: daten.heute.regeneration.score, band: daten.heute.regeneration.band }
            : null,
        gewogenHeute: daten.gewicht.aktuell?.date === heute,
      }
    : { verbunden: false, grund: daten.grund };

  const plan =
    rotation.art === "training"
      ? ({ art: "training", einheit: rotation.einheit } as const)
      : ({ art: "pause", naechste: rotation.naechste } as const);

  const nachricht = morgenNachricht(lage, plan);
  const versand = await anAlleSenden(nachricht);
  return NextResponse.json({ gesendet: true, nachricht, versand });
}
