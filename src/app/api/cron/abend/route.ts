import { NextResponse } from "next/server";
import { rotationMitPlan } from "@/lib/wochenplan";
import { heutigeEinheit } from "@/lib/training-lesen";
import { offenerVorschlag } from "@/lib/ernaehrung";
import { cronAbweisen } from "@/lib/cron";
import { anAlleSenden, benachrichtigungenLesen } from "@/lib/push";
import { abendNachricht } from "@/lib/benachrichtigung-texte";

/**
 * Abend-Erinnerung — von Vercel Cron aufgerufen, siehe vercel.json.
 *
 * Eingetragen 16:30 UTC; im Gratis-Tarif läuft der Job irgendwann zwischen
 * 16:00 und 16:59 UTC, also 17–18 Uhr im Winter und 18–19 Uhr im Sommer.
 * Früh genug, um noch ins Gym zu gehen, spät genug, dass ein Training nach
 * der Schule schon begonnen hätte. Schickt nichts, wenn es nichts zu sagen
 * gibt.
 */
export async function GET(request: Request) {
  const abgewiesen = cronAbweisen(request);
  if (abgewiesen) return abgewiesen;

  if (!(await benachrichtigungenLesen()).abend) {
    return NextResponse.json({ gesendet: false, grund: "ausgeschaltet" });
  }

  const [rotation, einheit, vorschlag] = await Promise.all([
    rotationMitPlan(new Date()),
    heutigeEinheit(),
    offenerVorschlag(),
  ]);

  const nachricht = abendNachricht({
    plan:
      rotation.art === "training"
        ? { art: "training", einheit: rotation.einheit }
        : { art: "pause", naechste: rotation.naechste },
    trainiertHeute: einheit !== null,
    kalorienvorschlagOffen: vorschlag !== null,
  });

  if (!nachricht) return NextResponse.json({ gesendet: false, grund: "nichts zu sagen" });

  const versand = await anAlleSenden(nachricht);
  return NextResponse.json({ gesendet: true, nachricht, versand });
}
