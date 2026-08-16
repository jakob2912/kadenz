import { prisma } from "./db";

/**
 * Ablage des Google-Refresh-Tokens.
 *
 * Der Token kommt beim Login im Browser an und landet dort in einem
 * httpOnly-Cookie. Ein separater Prozess — der MCP-Server, später der
 * Nacht-Job — kann darauf nicht zugreifen. Deshalb wird er zusätzlich in
 * der Datenbank abgelegt: eine Stelle, die alle erreichen.
 */

const SCHLUESSEL = "google_refresh_token";

export async function refreshTokenSpeichern(token: string): Promise<void> {
  await prisma.einstellung.upsert({
    where: { schluessel: SCHLUESSEL },
    update: { wert: token },
    create: { schluessel: SCHLUESSEL, wert: token },
  });
}

export async function refreshTokenLesen(): Promise<string | null> {
  const eintrag = await prisma.einstellung.findUnique({
    where: { schluessel: SCHLUESSEL },
  });
  return eintrag?.wert ?? null;
}
