"use server";

import { revalidatePath } from "next/cache";
import { istFrueh, istSpaet, wochenwahlSetzen, type Wochenstand } from "./wochenplan";

/**
 * Einen Wochenschalter umlegen. Eigene Datei wie bank-actions.ts:
 * wochenplan.ts wird auch vom MCP-Server geladen.
 */
export async function wochenschalterUmlegen(
  schalter: "frueh" | "spaet",
  wert: string
): Promise<{ ok: true; stand: Wochenstand } | { ok: false; fehler: string }> {
  let r;
  if (schalter === "frueh" && istFrueh(wert)) r = await wochenwahlSetzen({ frueh: wert });
  else if (schalter === "spaet" && istSpaet(wert)) r = await wochenwahlSetzen({ spaet: wert });
  else return { ok: false, fehler: "Unbekannter Schalter." };

  if (r.ok) revalidatePath("/", "layout");
  return r;
}
