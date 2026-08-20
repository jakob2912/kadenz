"use server";

import { revalidatePath } from "next/cache";
import { trainingsmaxSetzen } from "./bank";

/**
 * Den Trainingsmax fürs Bankdrücken eintragen oder korrigieren.
 *
 * Eigene Datei wie gewicht-actions.ts: bank.ts wird auch vom MCP-Server
 * geladen, und der kennt weder "use server" noch revalidatePath.
 */
export async function trainingsmaxEintragen(
  kg: number,
  begruendung?: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const r = await trainingsmaxSetzen(
    kg,
    begruendung?.trim() || "Von Hand eingetragen, ohne Vorgeschichte in der App."
  );

  if (!r.ok) return r;

  revalidatePath("/training");
  return { ok: true };
}
