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
const FENSTER_MS = 60_000;
const HOECHSTENS = 10;
let versuche: number[] = [];

/** Mehr als zehn Anmeldeversuche in der letzten Minute? */
function zuVieleVersuche(): boolean {
  const jetzt = Date.now();
  versuche = versuche.filter((t) => jetzt - t < FENSTER_MS);
  if (versuche.length >= HOECHSTENS) return true;
  versuche.push(jetzt);
  return false;
}

export async function POST(request: Request) {
  const passwort = zugangsPasswort();
  const basis = new URL(request.url);
  if (!passwort) return NextResponse.redirect(new URL("/", basis), 303);

  const zurueckMitFehler = (weiter: string) => {
    const zurueck = new URL("/anmelden", basis);
    zurueck.searchParams.set("fehler", "1");
    if (weiter !== "/") zurueck.searchParams.set("weiter", weiter);
    return NextResponse.redirect(zurueck, 303);
  };

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    // Kein Formular (falscher Content-Type) — keine 500, sondern zurück.
    return zurueckMitFehler("/");
  }
  const eingabe = String(form.get("passwort") ?? "");
  const weiter = sicheresZiel(form.get("weiter"));

  /* Bremse vor der teuren Rechnung: PBKDF2 kostet je Versuch eine
     Viertelsekunde Rechenzeit. Wer die Route flutet, soll weder das Passwort
     durchprobieren noch das Rechenkontingent bei Vercel aufbrauchen können.
     Der Zähler lebt je Instanz im Speicher — kein exakter Schutz über alle
     Instanzen, aber für eine App mit einem Nutzer genug. */
  if (zuVieleVersuche()) return zurueckMitFehler(weiter);

  const erwartet = await erwartetesToken(passwort);
  if (!gleich(await zugangsToken(eingabe), erwartet)) {
    // Eine Sekunde Bremse je Fehlversuch: macht Durchprobieren teuer, ohne
    // dass ein Vertipper wehtut.
    await new Promise((r) => setTimeout(r, 1000));
    return zurueckMitFehler(weiter);
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
