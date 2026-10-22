"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ZUGANG_COOKIE,
  ZUGANG_MAX_ALTER,
  gleich,
  zugangsPasswort,
  zugangsToken,
} from "@/lib/zugang";

export type AnmeldeStand = { fehler: string | null };

/**
 * Nur Pfade innerhalb von Kadenz als Ziel. Ein ?weiter=https://… würde aus
 * der Anmeldung sonst eine Umleitung auf beliebige Seiten machen.
 */
function sicheresZiel(weiter: FormDataEntryValue | null): string {
  const ziel = typeof weiter === "string" ? weiter : "/";
  return ziel.startsWith("/") && !ziel.startsWith("//") ? ziel : "/";
}

export async function anmelden(_vorher: AnmeldeStand, form: FormData): Promise<AnmeldeStand> {
  const passwort = zugangsPasswort();
  if (!passwort) redirect("/");

  const eingabe = String(form.get("passwort") ?? "");
  const erwartet = await zugangsToken(passwort);
  const bekommen = await zugangsToken(eingabe);

  if (!gleich(bekommen, erwartet)) {
    // Eine Sekunde Bremse je Fehlversuch: macht Durchprobieren teuer, ohne
    // dass ein Vertipper wehtut.
    await new Promise((r) => setTimeout(r, 1000));
    return { fehler: "Das Passwort stimmt nicht." };
  }

  (await cookies()).set(ZUGANG_COOKIE, erwartet, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ZUGANG_MAX_ALTER,
  });

  redirect(sicheresZiel(form.get("weiter")));
}
