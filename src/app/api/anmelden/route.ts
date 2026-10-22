import { NextResponse } from "next/server";
import {
  ZUGANG_COOKIE,
  ZUGANG_MAX_ALTER,
  erwartetesToken,
  gleich,
  sicheresZiel,
  zugangsPasswort,
  zugangsToken,
} from "@/lib/zugang";

/**
 * Anmeldung als gewöhnliches Formular-POST, nicht als Server Action.
 *
 * Bis zum 22.10.2026 war es eine Server Action auf /anmelden — und weil der
 * Proxy /anmelden ohne Cookie durchlassen musste, lief über diese Seite JEDE
 * Server Action der App ohne Anmeldung durch: Next nimmt auf jeder Seite
 * jede registrierte Aktion an, sie wird nur über den Header Next-Action
 * ausgewählt. Nachgewiesen mit laufendesTraining, das auf /anmelden ohne
 * Passwort die heutigen Sätze lieferte. Jetzt ist die Anmeldung der einzige
 * Weg ohne Cookie, und sie kann nichts außer anmelden.
 */
export async function POST(request: Request) {
  const passwort = zugangsPasswort();
  const basis = new URL(request.url);
  if (!passwort) return NextResponse.redirect(new URL("/", basis), 303);

  const form = await request.formData();
  const eingabe = String(form.get("passwort") ?? "");
  const weiter = sicheresZiel(form.get("weiter"));

  const erwartet = await erwartetesToken(passwort);
  if (!gleich(await zugangsToken(eingabe), erwartet)) {
    // Eine Sekunde Bremse je Fehlversuch: macht Durchprobieren teuer, ohne
    // dass ein Vertipper wehtut.
    await new Promise((r) => setTimeout(r, 1000));
    const zurueck = new URL("/anmelden", basis);
    zurueck.searchParams.set("fehler", "1");
    if (weiter !== "/") zurueck.searchParams.set("weiter", weiter);
    return NextResponse.redirect(zurueck, 303);
  }

  const antwort = NextResponse.redirect(new URL(weiter, basis), 303);
  /* secure am tatsächlichen Protokoll statt an NODE_ENV: ein Produktionsbau,
     der im WLAN über http://<Rechner>:3000 vom iPhone aufgerufen wird, bekäme
     sonst ein Secure-Cookie, das Safari über http verwirft — und die
     Anmeldung liefe im Kreis. */
  const protokoll = request.headers.get("x-forwarded-proto") ?? basis.protocol.replace(":", "");
  antwort.cookies.set(ZUGANG_COOKIE, erwartet, {
    httpOnly: true,
    secure: protokoll === "https",
    sameSite: "lax",
    path: "/",
    maxAge: ZUGANG_MAX_ALTER,
  });
  return antwort;
}
