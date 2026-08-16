import type { ReactNode } from "react";
import { loadDashboard } from "@/lib/health-service";
import { Card, Eyebrow, de } from "@/components/ui";
import { sessionFor } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function Coach() {
  const data = await loadDashboard(30);
  const heuteTraining = sessionFor(new Date());

  return (
    <div className="mx-auto max-w-[520px] md:max-w-none">
      <header className="pt-10 md:pt-14">
        <Eyebrow>Dein Coach</Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em] md:text-[33px]">Kadenz</h1>
      </header>

      <div className="mt-6 flex flex-col gap-3.5">
        {!data.verbunden ? (
          <Nachricht>{data.grund}</Nachricht>
        ) : (
          <>
            <Nachricht>
              <b className="font-semibold text-fg">Befund heute.</b>{" "}
              {data.heute && data.baseline ? (
                <>
                  Regeneration{" "}
                  <b className="font-semibold text-fg">{data.heute.regeneration.score}</b> von 100
                  {data.heute.regeneration.drivers.length > 0 && (
                    <> — {data.heute.regeneration.drivers.join(", ")}</>
                  )}
                  .{" "}
                  {data.heute.regeneration.allowCardio
                    ? "Cardio ist frei."
                    : "Krafttraining läuft, Cardio setze ich aus."}
                </>
              ) : (
                "Noch keine vollständige Nacht mit Ruhepuls und HRV."
              )}
            </Nachricht>

            <Nachricht>
              <b className="font-semibold text-fg">Training.</b>{" "}
              {heuteTraining.art === "training"
                ? `Heute ${heuteTraining.session.focus} — ${heuteTraining.session.title}.`
                : `Heute Pausentag. Als nächstes ${heuteTraining.naechste.focus}.`}
            </Nachricht>

            <Nachricht>
              <b className="font-semibold text-fg">Gewicht.</b>{" "}
              {data.gewicht.trend.usable ? (
                <>
                  Dein Schnitt steigt mit{" "}
                  <b className="font-semibold text-fg">
                    {de(data.gewicht.trend.kgPerWeek, 2)} kg pro Woche
                  </b>
                  . Zielkorridor ist 0,25 bis 0,50.
                </>
              ) : (
                data.gewicht.trend.detail
              )}
            </Nachricht>
          </>
        )}

        <Card tone="warnung">
          <Eyebrow>Noch nicht fertig</Eyebrow>
          <p className="mt-2 text-sm leading-relaxed text-fg-dim">
            Das hier sind feste Auswertungen aus deinen Daten, noch kein Dialog. Die Anbindung
            an die Claude API — mit der du zurückfragen kannst — kommt als nächstes, zusammen
            mit der Datenbank für die Trainingslogs.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Nachricht({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-hair bg-surface-2 p-3.5 text-sm leading-relaxed text-fg-dim">
      {children}
    </div>
  );
}
