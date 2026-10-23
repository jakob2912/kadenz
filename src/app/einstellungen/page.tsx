import { Suspense } from "react";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { benachrichtigungenLesen } from "@/lib/push";
import { zugangsPasswort } from "@/lib/zugang";
import { Card, Eyebrow, Skelett } from "@/components/ui";
import { PushSchalter, GeraeteSchalter } from "@/components/einstellungen";

/**
 * Einstellungen — Benachrichtigungen, dieses Gerät, Daten.
 *
 * Kein eigener Tab: die Leiste trägt seit dem Bench-Tab sechs Einträge, und
 * Einstellungen öffnet man selten. Der Weg hierher ist das Zahnrad oben auf
 * der Startseite.
 */
export default function Einstellungen() {
  return (
    <div className="mx-auto max-w-[520px] pt-10 md:pt-14">
      <Eyebrow>Kadenz</Eyebrow>
      <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em]">Einstellungen</h1>

      <Suspense fallback={<Skelett hoehe={320} className="mt-6" />}>
        <Inhalt />
      </Suspense>
    </div>
  );
}

async function Inhalt() {
  await connection();

  const [einstellungen, geraete] = await Promise.all([
    benachrichtigungenLesen(),
    prisma.pushAbo.findMany({
      select: { geraet: true, angelegt: true, zuletztZugestellt: true },
      orderBy: { angelegt: "asc" },
    }),
  ]);

  const cronBereit = Boolean(process.env.CRON_SECRET?.trim());
  const geschuetzt = zugangsPasswort() !== null;

  return (
    <div className="mt-6 flex flex-col gap-3.5">
      <Card>
        <Eyebrow>Benachrichtigungen</Eyebrow>
        <PushSchalter
          einstellungen={einstellungen}
          angemeldet={geraete.map((g) => g.geraet ?? "Browser")}
        />
        {!cronBereit && (
          <p className="mt-3.5 rounded-sm border border-caution/30 bg-caution/10 px-3.5 py-2.5 text-xs leading-relaxed text-caution">
            Morgen- und Abend-Nachricht brauchen die Umgebungsvariable{" "}
            <code className="font-semibold">CRON_SECRET</code> bei Vercel (eine beliebige
            lange Zufallszeichenkette). Bis sie gesetzt ist, kommt nur die Satzpause.
          </p>
        )}
      </Card>

      <Card>
        <Eyebrow>Dieses Gerät</Eyebrow>
        <GeraeteSchalter />
      </Card>

      <Card>
        <Eyebrow>Daten</Eyebrow>
        <a
          href="/api/export"
          className="mt-3 flex min-h-[48px] items-center justify-center rounded-md bg-surface-2 text-sm font-semibold text-fg transition active:scale-[0.98]"
        >
          Alle Sätze als CSV herunterladen
        </a>
        <p className="mt-2.5 text-[11px] leading-relaxed text-fg-faint">
          Jede geloggte Wiederholung mit Datum, Einheit und Gewicht — zum Weiterrechnen in
          Excel oder Numbers, oder als Sicherung.
        </p>
      </Card>

      <Card>
        <Eyebrow>Zugang</Eyebrow>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
          {geschuetzt
            ? "Kadenz ist mit Passwort geschützt. Jedes Gerät meldet sich einmal an."
            : "Kadenz ist ohne Passwort erreichbar — wer die Adresse kennt, sieht deine Daten und kann Sätze eintragen. Zum Schützen bei Vercel die Umgebungsvariable KADENZ_PASSWORT setzen und neu deployen."}
        </p>
      </Card>
    </div>
  );
}
