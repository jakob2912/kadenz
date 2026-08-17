import { planMitHistorie, sessionFor } from "@/lib/plan";
import { laufendesTraining } from "@/lib/workouts";
import { TrainingLogger, TrainingStart } from "@/components/training-logger";
import { Card, Eyebrow } from "@/components/ui";

// Die Startgewichte hängen an der Trainingshistorie und ändern sich nach
// jedem Satz — hier darf nichts zwischengespeichert werden.
export const dynamic = "force-dynamic";

export default async function Training() {
  const heute = sessionFor(new Date());

  if (heute.art === "pause") {
    const naechste = heute.naechste;
    return (
      <div className="mx-auto max-w-[520px] pt-10 md:pt-14">
        <Eyebrow>Heute</Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em]">Rest Day</h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-dim">
          Deine Rotation ist Push – Pull – Rest Day. Nach einem Rest Day folgt immer Push,
          morgen also <b className="font-semibold text-fg">{naechste.focus}</b>.
        </p>

        {/* Vorher endete die Seite hier. Wer am Rest Day auf "Training" tippt,
            will wissen, was ansteht — nicht nur, dass heute nichts ansteht.
            Die Übungsliste liegt ohnehin im Plan und kostet keine Abfrage. */}
        <Card className="mt-5">
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow>Morgen</Eyebrow>
            <span className="text-[11px] text-fg-faint">
              {naechste.exercises.length} Übungen ·{" "}
              {naechste.exercises.reduce((n, e) => n + e.last.length, 0)} Sätze
            </span>
          </div>
          <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.015em]">
            {naechste.title}
          </p>
          <ol className="mt-3.5 flex flex-col gap-2">
            {naechste.exercises.map((ex, i) => (
              <li key={ex.name} className="flex items-center gap-3">
                <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-sm bg-surface-3 text-[11px] font-bold text-fg-dim">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-fg-dim">
                  {ex.name}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-fg-faint">
                  {ex.last.length} × {ex.last[0]?.kg.toString().replace(".", ",")} kg
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3.5 text-[11px] leading-relaxed text-fg-faint">
            Gewichte aus der letzten Ausführung. Das tatsächliche Zielgewicht rechnet
            Kadenz morgen aus deinen Wiederholungen.
          </p>
        </Card>
      </div>
    );
  }

  const uebungen = await planMitHistorie(heute.session);

  // Ist die Datenbank kurz nicht erreichbar, soll man trotzdem loggen können:
  // dann gilt "jetzt" als Beginn, statt die Seite mit einem Fehler abzuräumen.
  let laufend = null;
  try {
    laufend = await laufendesTraining(heute.session.key);
  } catch (e) {
    console.error("Trainingsstatus nicht lesbar:", e);
    return (
      <TrainingLogger uebungen={uebungen} session={heute.session} startedAtMs={Date.now()} />
    );
  }

  if (laufend === null) {
    return <TrainingStart session={heute.session} uebungen={uebungen} />;
  }

  return (
    <TrainingLogger
      uebungen={uebungen}
      session={heute.session}
      startedAtMs={laufend.startedAtMs}
    />
  );
}
