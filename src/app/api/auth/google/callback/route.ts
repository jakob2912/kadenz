import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
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
    return fail(`Google denied access: ${error}`);
  }
  if (!code) {
    return fail("Google returned no authorization code.");
  }
  // Zeitkonstanter Vergleich ist hier unnötig — der state ist eine
  // Einmal-Nonce, kein Geheimnis mit Wiederverwendung.
  if (!state || !expected || state !== expected) {
    return fail(
      "state doesn't match. Please start the sign-in again via /api/auth/google."
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
        titel: "Google sign-in not set up",
        nachricht: `${e.message} Add it in the Vercel project settings or .env.local and redeploy.`,
        status: 500,
      });
    }
    return fail(e instanceof Error ? e.message : "Token exchange failed.");
  }

  if (!refreshToken) {
    return fail(
      "Google returned no refresh_token. That happens when the app " +
        "was already authorized. Remove access at myaccount.google.com/permissions " +
        "and sign in again."
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
      "DATABASE_URL isn't set — the refresh token only lives in the cookie, " +
        "where the MCP server can't find it."
    );
  }

  jar.set("kadenz_google_refresh", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });

  /* Den zwischengespeicherten Stand verwerfen. Ist der alte Token abgelaufen,
     liegt dort ein "nicht verbunden" — und die Weiterleitung unten führt
     direkt auf die Startseite, die genau diesen Eintrag liest.

     { expire: 0 } und nicht "max": "max" markiert nur als veraltet und liefert
     beim nächsten Aufruf erst noch einmal den alten Stand aus. Wer sich gerade
     neu verbunden hat, sähe dann ausgerechnet "nicht verbunden". updateTag
     wäre die direkte Wahl, ist aber nur in Server Actions erlaubt, nicht in
     Route Handlern. */
  revalidateTag("gesundheit", { expire: 0 });

  return NextResponse.redirect(new URL("/?verbunden=1", url.origin));
}

function fail(message: string) {
  return fehlerSeite({
    titel: "Sign-in failed",
    nachricht: message,
    aktion: { text: "Try again", href: "/api/auth/google" },
  });
}
