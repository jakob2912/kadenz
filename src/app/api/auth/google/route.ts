import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authUrl } from "@/lib/google-health";
import { istKonfigurationsFehler } from "@/lib/konfiguration";
import { fehlerSeite } from "@/lib/fehlerseite";

/**
 * Startet den Google-Login. Aufruf im Browser: /api/auth/google
 *
 * Der state-Parameter ist die CSRF-Absicherung: wir legen eine Zufallszahl
 * im Cookie ab und vergleichen sie beim Rücksprung. Ohne das könnte eine
 * fremde Seite den Callback mit ihrem eigenen Code auslösen.
 */
export async function GET() {
  const state = crypto.randomUUID();

  // Die Ziel-URL wird vor dem Cookie gebaut: fehlt GOOGLE_CLIENT_ID, soll die
  // Antwort das sagen, statt einen state zu setzen, der nie eingelöst wird.
  let ziel: string;
  try {
    ziel = authUrl(state);
  } catch (e) {
    if (istKonfigurationsFehler(e)) {
      return fehlerSeite({
        titel: "Google-Login nicht eingerichtet",
        nachricht: `${e.message} Ohne sie kann kein Login gestartet werden — in den Projekteinstellungen bei Vercel bzw. in .env.local nachtragen und neu deployen.`,
        status: 500,
      });
    }
    throw e;
  }

  // In Next 16 sind die Request-APIs durchgehend asynchron.
  const jar = await cookies();
  jar.set("kadenz_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // zehn Minuten reichen für einen Login
  });

  // Muss außerhalb des try stehen: redirect() arbeitet intern mit einer
  // geworfenen Ausnahme, die ein catch sonst abfangen würde.
  redirect(ziel);
}
