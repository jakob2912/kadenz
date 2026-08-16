import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/google-health";

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
  try {
    const { refreshTokenSpeichern } = await import("@/lib/auth-store");
    await refreshTokenSpeichern(refreshToken);
  } catch (e) {
    console.error("Refresh-Token konnte nicht in der Datenbank abgelegt werden:", e);
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
  return new NextResponse(
    `<!doctype html><meta charset="utf-8">
     <title>Login fehlgeschlagen</title>
     <body style="background:#090b0d;color:#e9eef2;font:16px/1.6 -apple-system,system-ui,sans-serif;padding:2.5rem;max-width:38rem">
       <h1 style="font-size:1.35rem;letter-spacing:-.02em">Login fehlgeschlagen</h1>
       <p style="color:#94a3ae">${escapeHtml(message)}</p>
       <p><a href="/api/auth/google" style="color:#a9c9ff">Nochmal versuchen</a></p>
     </body>`,
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
