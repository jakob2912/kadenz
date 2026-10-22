import { NextResponse, type NextRequest } from "next/server";
import { ZUGANG_COOKIE, erwartetesToken, gleich, zugangsPasswort } from "@/lib/zugang";

/**
 * Zugangsschutz vor jeder Seite und jeder Server Action — siehe lib/zugang.ts.
 *
 * Ohne KADENZ_PASSWORT tut der Proxy nichts. Mit ihm gilt: gültiges Cookie
 * oder Anmeldeseite. Seitenaufrufe werden dorthin umgeleitet, alles andere
 * (Server Actions, API) bekommt ein 401 — eine Umleitung auf HTML wäre für
 * einen fetch()-Aufrufer nur eine unverständliche Antwort.
 *
 * Ohne Cookie erreichbar sind nur: die Anmeldeseite (lesend), das
 * Anmeldeformular (/api/anmelden), die Cron-Routen per GET (sie prüfen ihr
 * eigenes CRON_SECRET, Vercel hat kein Cookie) und — über den Matcher unten
 * — alles, was der Home-Bildschirm vor der Anmeldung braucht: Manifest,
 * Icons, Service Worker. Server Actions nie, siehe den Block unten.
 */
export async function proxy(request: NextRequest) {
  const passwort = zugangsPasswort();
  if (!passwort) return NextResponse.next();

  const pfad = request.nextUrl.pathname;
  const methode = request.method;

  /* Ohne Cookie durch: die Anmeldeseite NUR lesend, das Anmeldeformular an
     seine eigene Route, und die Cron-Routen nur per GET. Eine Anfrage mit
     dem Header Next-Action ist dagegen NIE ohne Cookie erlaubt, egal auf
     welchem Pfad: Next nimmt auf jeder Seite jede registrierte Server Action
     an — auch über eine 404 unter /api/cron/ —, und eine offene Seite war
     damit eine offene Tür für sämtliche Aktionen der App. */
  const istAktion = request.headers.has("next-action");
  const lesend = methode === "GET" || methode === "HEAD";
  if (!istAktion) {
    if (pfad === "/anmelden" && lesend) return NextResponse.next();
    if (pfad === "/api/anmelden" && methode === "POST") return NextResponse.next();
    if (pfad.startsWith("/api/cron/") && methode === "GET") return NextResponse.next();
  }

  const cookie = request.cookies.get(ZUGANG_COOKIE)?.value;
  if (cookie && gleich(cookie, await erwartetesToken(passwort))) return NextResponse.next();

  const istSeitenaufruf =
    methode === "GET" && (request.headers.get("accept") ?? "").includes("text/html");

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
