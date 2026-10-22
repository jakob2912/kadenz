"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ZUGANG_COOKIE,
  ZUGANG_MAX_ALTER,
  erwartetesToken,
  gleich,
  zugangsPasswort,
  zugangsToken,
} from "@/lib/zugang";

export type AnmeldeStand = { fehler: string | null };

/**
 * Nur Pfade innerhalb von Kadenz als Ziel. Ein ?weiter=https://… würde aus
 * der Anmeldung sonst eine Umleitung auf beliebige Seiten machen.
 *
 * Aufgelöst wie der Browser es tut, statt am Text zu prüfen: "/\evil.com"
 * beginnt mit einem einzelnen Schrägstrich, Browser lesen den Backslash aber
 * als zweiten — und landen auf evil.com. Erst die aufgelöste URL sagt, ob
 * das Ziel auf dem eigenen Host bleibt.
 */
function sicheresZiel(weiter: FormDataEntryValue | null): string {
  const roh = typeof weiter === "string" ? weiter : "/";
  try {
    const basis = "http://kadenz.invalid";
    const url = new URL(roh, basis);
    return url.origin === basis ? `${url.pathname}${url.search}` : "/";
  } catch {
    return "/";
  }
}

export async function anmelden(_vorher: AnmeldeStand, form: FormData): Promise<AnmeldeStand> {
  const passwort = zugangsPasswort();
  if (!passwort) redirect("/");

  const eingabe = String(form.get("passwort") ?? "");
  const erwartet = await erwartetesToken(passwort);
  const bekommen = await zugangsToken(eingabe);

  if (!gleich(bekommen, erwartet)) {
    // Eine Sekunde Bremse je Fehlversuch: macht Durchprobieren teuer, ohne
    // dass ein Vertipper wehtut.
    await new Promise((r) => setTimeout(r, 1000));
    return { fehler: "Das Passwort stimmt nicht." };
  }

  /* secure am tatsächlichen Protokoll statt an NODE_ENV: ein Produktionsbau,
     der im WLAN über http://<Rechner>:3000 vom iPhone aufgerufen wird, bekäme
     sonst ein Secure-Cookie, das Safari über http verwirft — und die
     Anmeldung liefe im Kreis. */
  const protokoll = (await headers()).get("x-forwarded-proto") ?? "http";
  (await cookies()).set(ZUGANG_COOKIE, erwartet, {
    httpOnly: true,
    secure: protokoll === "https",
    sameSite: "lax",
    path: "/",
    maxAge: ZUGANG_MAX_ALTER,
  });

  redirect(sicheresZiel(form.get("weiter")));
}
