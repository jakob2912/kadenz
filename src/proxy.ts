import { NextResponse, type NextRequest } from "next/server";
import { ZUGANG_COOKIE, gleich, zugangsPasswort, zugangsToken } from "@/lib/zugang";

/**
 * Zugangsschutz vor jeder Seite und jeder Server Action — siehe lib/zugang.ts.
 *
 * Ohne KADENZ_PASSWORT tut der Proxy nichts. Mit ihm gilt: gültiges Cookie
 * oder Anmeldeseite. Seitenaufrufe werden dorthin umgeleitet, alles andere
 * (Server Actions, API) bekommt ein 401 — eine Umleitung auf HTML wäre für
 * einen fetch()-Aufrufer nur eine unverständliche Antwort.
 *
 * Ausgenommen sind die Cron-Routen (die prüfen ihr eigenes CRON_SECRET, Vercel
 * hat kein Cookie) und alles, was der Home-Bildschirm vor der Anmeldung
 * braucht: Manifest, Icons, Service Worker.
 */
export async function proxy(request: NextRequest) {
  const passwort = zugangsPasswort();
  if (!passwort) return NextResponse.next();

  const pfad = request.nextUrl.pathname;
  if (pfad === "/anmelden" || pfad.startsWith("/api/cron/")) return NextResponse.next();

  const cookie = request.cookies.get(ZUGANG_COOKIE)?.value;
  if (cookie && gleich(cookie, await zugangsToken(passwort))) return NextResponse.next();

  const istSeitenaufruf =
    request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");

  if (istSeitenaufruf) {
    const ziel = new URL("/anmelden", request.url);
    if (pfad !== "/") ziel.searchParams.set("weiter", pfad + request.nextUrl.search);
    return NextResponse.redirect(ziel);
  }

  return new NextResponse("Nicht angemeldet.", { status: 401 });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|icons/|apple-icon|manifest\\.webmanifest|sw\\.js).*)",
  ],
};
