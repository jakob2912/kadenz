"use server";

import { revalidatePath } from "next/cache";
import { trainingsmaxSetzen } from "./bank";

/**
 * Den Trainingsmax fürs Bankdrücken eintragen oder korrigieren.
 *
 * Eigene Datei wie ernaehrung-actions.ts: bank.ts wird auch vom MCP-Server
 * geladen, und der kennt weder "use server" noch revalidatePath.
 */
export async function trainingsmaxEintragen(
  kg: number,
  begruendung?: string
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const r = await trainingsmaxSetzen(
    kg,
    begruendung?.trim() || "Entered by hand, without history in the app."
  );

  if (!r.ok) return r;

  revalidatePath("/training");
  return { ok: true };
}
