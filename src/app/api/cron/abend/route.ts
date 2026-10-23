import { NextResponse } from "next/server";
import { heutigeLage } from "@/lib/abzeichen";
import { cronAbweisen } from "@/lib/cron";
import { anAlleSenden, benachrichtigungenLesen } from "@/lib/push";
import { abendNachricht, offeneDinge } from "@/lib/benachrichtigung-texte";

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

  const lage = await heutigeLage();
  const nachricht = abendNachricht(lage);

  /* Ohne Nachricht geht auch keine Zahl ans App-Symbol: iOS erlaubt keinen
     stillen Push, jede Zustellung zeigt eine Benachrichtigung. Wurde etwas
     außerhalb der App erledigt (MCP-Server), bleibt die alte Zahl bis zum
     nächsten Öffnen oder bis zur Morgen-Nachricht stehen. */
  if (!nachricht) return NextResponse.json({ gesendet: false, grund: "nichts zu sagen" });

  const versand = await anAlleSenden({ ...nachricht, badge: offeneDinge(lage) });
  return NextResponse.json({ gesendet: true, nachricht, versand });
}
