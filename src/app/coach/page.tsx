import type { ReactNode } from "react";
import { loadDashboard } from "@/lib/health-service";
import { Eyebrow, NichtVerbunden, de } from "@/components/ui";
import { sessionFor } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function Coach() {
  const data = await loadDashboard(30);
  const heuteTraining = sessionFor(new Date());

  if (!data.verbunden) {
    return <NichtVerbunden titel="Der Coach braucht deine Daten" grund={data.grund} />;
  }

  return (
    <div className="mx-auto max-w-[520px] md:max-w-none">
      <header className="pt-10 md:pt-14">
        <Eyebrow>Dein Coach</Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em] md:text-[33px]">Kadenz</h1>
        {/* Der Hinweis stand bisher als amberfarbene Karte ganz unten. Wer
            oben anfängt zu lesen, sucht bis dahin nach dem Eingabefeld, das
            es nicht gibt. Und amber ist in dieser App Regenerationszustand,
            kein Bauhinweis. */}
        <p className="mt-3 max-w-[min(88%,62ch)] text-[13px] leading-relaxed text-fg-faint">
          Feste Auswertungen aus deinen Daten, noch kein Dialog — es gibt hier nichts zu
          tippen. Die Anbindung an die Claude API, mit der du zurückfragen kannst, kommt
          als nächstes.
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-3.5">
        <Nachricht titel="Befund heute">
          {data.heute && data.baseline ? (
            <>
              Regeneration <b className="font-semibold text-fg">{data.heute.regeneration.score}</b>{" "}
              von 100
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

        <Nachricht titel="Training">
          {heuteTraining.art === "training"
            ? `Heute ${heuteTraining.session.focus} — ${heuteTraining.session.title}.`
            : `Heute Pausentag. Als nächstes ${heuteTraining.naechste.focus}.`}
        </Nachricht>

        <Nachricht titel="Gewicht">
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
      </div>
    </div>
  );
}

/**
 * Eine Aussage des Coaches.
 *
 * Die Überschrift ist ein echtes h2 statt fettem Text am Zeilenanfang: so
 * kann man die drei Themen überfliegen, ohne alles zu lesen, und ein
 * Screenreader kann von Thema zu Thema springen.
 *
 * Die Breite ist auf 62 Zeichen gedeckelt. Auf dem Desktop lief die Blase
 * vorher über 88 % von 1180 px — rund 140 Zeichen pro Zeile, doppelt so viel
 * wie lesbar ist.
 */
function Nachricht({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div className="max-w-[min(88%,62ch)] rounded-md rounded-bl-sm border border-hair bg-surface-2 p-3.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
        {titel}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-dim">{children}</p>
    </div>
  );
}
