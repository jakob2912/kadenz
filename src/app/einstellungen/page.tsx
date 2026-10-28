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
 * Kein eigener Tab: die Leiste bleibt bei den vier Dingen, die man täglich
 * braucht, und Einstellungen öffnet man selten. Der Weg hierher ist das Zahnrad oben auf
 * der Startseite.
 */
export default function Einstellungen() {
  return (
    <div className="mx-auto max-w-[520px] pt-10 md:pt-14">
      <Eyebrow>Kadenz</Eyebrow>
      <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em]">Settings</h1>

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
        <Eyebrow>Notifications</Eyebrow>
        <PushSchalter
          einstellungen={einstellungen}
          angemeldet={geraete.map((g) => g.geraet ?? "Browser")}
        />
        {!cronBereit && (
          <p className="mt-3.5 rounded-sm border border-caution/30 bg-caution/10 px-3.5 py-2.5 text-xs leading-relaxed text-caution">
            Morning and evening notifications need the environment variable{" "}
            <code className="font-semibold">CRON_SECRET</code> on Vercel (any long random
            string). Until it is set, only the rest timer notification works.
          </p>
        )}
      </Card>

      <Card>
        <Eyebrow>This device</Eyebrow>
        <GeraeteSchalter />
      </Card>

      <Card>
        <Eyebrow>Data</Eyebrow>
        <a
          href="/api/export"
          className="mt-3 flex min-h-[48px] items-center justify-center rounded-md bg-surface-2 text-sm font-semibold text-fg transition active:scale-[0.98]"
        >
          Download all sets as CSV
        </a>
        <p className="mt-2.5 text-[11px] leading-relaxed text-fg-faint">
          Every logged rep with date, session and weight — for further calculations in
          Excel or Numbers, or as a backup.
        </p>
      </Card>

      <Card>
        <Eyebrow>Access</Eyebrow>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
          {geschuetzt
            ? "Kadenz is password protected. Each device signs in once."
            : "Kadenz is reachable without a password — anyone who knows the address can see your data and log sets. To protect it, set the KADENZ_PASSWORT environment variable on Vercel and redeploy."}
        </p>
      </Card>
    </div>
  );
}
