import { NextResponse } from "next/server";
import { connection } from "next/server";
import { abzeichenZahl } from "@/lib/abzeichen";

/**
 * Die Zahl am App-Symbol, abgefragt von der offenen App (AppAbzeichen in
 * components/pwa.tsx). Geschützt wie jede Seite über den Proxy.
 */
export async function GET() {
  await connection();
  try {
    return NextResponse.json({ anzahl: await abzeichenZahl() });
  } catch (e) {
    console.error("Abzeichen nicht berechnet:", e);
    return NextResponse.json({ anzahl: null }, { status: 503 });
  }
}
