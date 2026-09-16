"use server";

import { revalidatePath } from "next/cache";
import { istWochenplan, wochenplanSetzen } from "./wochenplan";

/**
 * Den Wochenplan umschalten. Eigene Datei wie bank-actions.ts: wochenplan.ts
 * wird auch vom MCP-Server geladen.
 */
export async function wochenplanWechseln(
  plan: string
): Promise<{ ok: true; ab: string | null } | { ok: false; fehler: string }> {
  if (!istWochenplan(plan)) return { ok: false, fehler: "Unbekannter Wochenplan." };

  const r = await wochenplanSetzen(plan);
  if (r.ok) revalidatePath("/", "layout");
  return r;
}
