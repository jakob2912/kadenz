import { NextResponse } from "next/server";
import { loadDashboard } from "@/lib/health-service";
import { rotationMitPlan } from "@/lib/wochenplan";
import { heuteWien } from "@/lib/datum";
import { cronAbweisen } from "@/lib/cron";
import { anAlleSenden, benachrichtigungenLesen } from "@/lib/push";
import { morgenNachricht, type MorgenLage } from "@/lib/benachrichtigung-texte";
import { abzeichenZahl } from "@/lib/abzeichen";

/**
 * Morgen-Nachricht — von Vercel Cron aufgerufen, siehe vercel.json.
 *
 * Der Zeitplan steht in UTC und Vercel kennt keine Zeitzonen. Im
 * Gratis-Tarif läuft der Job irgendwann zwischen 05:00 und 05:59 UTC, nicht
 * auf die Minute — in Wien also 6–7 Uhr im Winter, 7–8 Uhr im Sommer.
 */
export async function GET(request: Request) {
  const abgewiesen = cronAbweisen(request);
  if (abgewiesen) return abgewiesen;

  if (!(await benachrichtigungenLesen()).morgen) {
    return NextResponse.json({ gesendet: false, grund: "ausgeschaltet" });
  }

  const heute = heuteWien();
  const [daten, rotation, badge] = await Promise.all([
    loadDashboard(30),
    rotationMitPlan(new Date()),
    // Fällt die Zählung aus, geht die Nachricht trotzdem raus — ohne Zahl.
    abzeichenZahl().catch(() => undefined),
  ]);

  /* Werte aus der eigenen Ablage heißen: Google ist abgelaufen. Das gehört
     in die Morgen-Nachricht, sonst merkt Jakob es erst am Abend. */
  const lage: MorgenLage = daten.verbunden && !daten.abgelaufen
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
    : { verbunden: false, grund: daten.verbunden ? daten.abgelaufen! : daten.grund };

  const plan =
    rotation.art === "training"
      ? ({ art: "training", einheit: rotation.einheit } as const)
      : ({ art: "pause", naechste: rotation.naechste } as const);

  const nachricht = morgenNachricht(lage, plan);
  // Die Zahl am Symbol kommt mit: sie stand seit gestern Abend womöglich auf
  // null, und an einem Trainingstag ist die Einheit ab jetzt offen.
  const versand = await anAlleSenden({ ...nachricht, badge });
  return NextResponse.json({ gesendet: true, nachricht, versand });
}
