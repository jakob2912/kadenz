import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authUrl } from "@/lib/google-health";

/**
 * Startet den Google-Login. Aufruf im Browser: /api/auth/google
 *
 * Der state-Parameter ist die CSRF-Absicherung: wir legen eine Zufallszahl
 * im Cookie ab und vergleichen sie beim Rücksprung. Ohne das könnte eine
 * fremde Seite den Callback mit ihrem eigenen Code auslösen.
 */
export async function GET() {
  const state = crypto.randomUUID();

  // In Next 16 sind die Request-APIs durchgehend asynchron.
  const jar = await cookies();
  jar.set("kadenz_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // zehn Minuten reichen für einen Login
  });

  redirect(authUrl(state));
}
