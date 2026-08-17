import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/google-health";
import { datenbankKonfiguriert, istKonfigurationsFehler } from "@/lib/konfiguration";
import { fehlerSeite } from "@/lib/fehlerseite";

/** Rücksprung von Google nach der Zustimmung. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const jar = await cookies();
  const expected = jar.get("kadenz_oauth_state")?.value;
  jar.delete("kadenz_oauth_state");

  if (error) {
    return fail(`Google hat den Zugriff abgelehnt: ${error}`);
  }
  if (!code) {
    return fail("Google hat keinen Autorisierungscode zurückgegeben.");
  }
  // Zeitkonstanter Vergleich ist hier unnötig — der state ist eine
  // Einmal-Nonce, kein Geheimnis mit Wiederverwendung.
  if (!state || !expected || state !== expected) {
    return fail(
      "state stimmt nicht überein. Login bitte erneut über /api/auth/google starten."
    );
  }

  let refreshToken: string | undefined;
  try {
    const tokens = await exchangeCode(code);
    refreshToken = tokens.refresh_token;
  } catch (e) {
    // Eine fehlende Variable ist etwas anderes als eine Absage von Google:
    // das eine muss Jakob nachtragen, das andere kann er nochmal versuchen.
    if (istKonfigurationsFehler(e)) {
      return fehlerSeite({
        titel: "Google-Login nicht eingerichtet",
        nachricht: `${e.message} In den Projekteinstellungen bei Vercel bzw. in .env.local nachtragen und neu deployen.`,
        status: 500,
      });
    }
    return fail(e instanceof Error ? e.message : "Token-Tausch fehlgeschlagen.");
  }

  if (!refreshToken) {
    return fail(
      "Google hat keinen refresh_token geliefert. Das passiert, wenn die App " +
        "bereits autorisiert war. Zugriff unter myaccount.google.com/permissions " +
        "entfernen und erneut anmelden."
    );
  }

  // Zusätzlich in die Datenbank: der MCP-Server und spätere Hintergrundjobs
  // laufen ohne Browser und kommen an das Cookie nicht heran. Schlägt das
  // fehl, soll der Login im Browser trotzdem gelingen.
  if (datenbankKonfiguriert()) {
    try {
      const { refreshTokenSpeichern } = await import("@/lib/auth-store");
      await refreshTokenSpeichern(refreshToken);
    } catch (e) {
      console.error("Refresh-Token konnte nicht in der Datenbank abgelegt werden:", e);
    }
  } else {
    console.error(
      "DATABASE_URL ist nicht gesetzt — der Refresh-Token liegt nur im Cookie, " +
        "der MCP-Server findet ihn dort nicht."
    );
  }

  jar.set("kadenz_google_refresh", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });

  return NextResponse.redirect(new URL("/?verbunden=1", url.origin));
}

function fail(message: string) {
  return fehlerSeite({
    titel: "Login fehlgeschlagen",
    nachricht: message,
    aktion: { text: "Nochmal versuchen", href: "/api/auth/google" },
  });
}
