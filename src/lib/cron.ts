import { NextResponse } from "next/server";

/**
 * Prüft, ob ein Aufruf wirklich von Vercels Cron kommt.
 *
 * Vercel schickt bei gesetztem CRON_SECRET den Header
 * "Authorization: Bearer <CRON_SECRET>". Ohne die Variable gibt es nichts zu
 * prüfen — dann bleibt die Route zu, statt für jeden offen zu sein, der die
 * Adresse kennt und Jakob nachts Nachrichten schicken will.
 *
 * Gibt eine fertige Fehlerantwort zurück, oder null, wenn der Aufruf passt.
 */
export function cronAbweisen(request: Request): NextResponse | null {
  const geheimnis = process.env.CRON_SECRET?.trim();
  if (!geheimnis) {
    return NextResponse.json(
      {
        fehler: "CRON_SECRET ist nicht gesetzt.",
        tipp: "In den Vercel-Projekteinstellungen eine zufällige Zeichenkette als CRON_SECRET eintragen und neu deployen.",
      },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${geheimnis}`) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 401 });
  }
  return null;
}
