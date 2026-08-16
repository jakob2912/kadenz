import { planMitHistorie, sessionFor } from "@/lib/plan";
import { TrainingLogger } from "@/components/training-logger";
import { Eyebrow } from "@/components/ui";

// Die Startgewichte hängen an der Trainingshistorie und ändern sich nach
// jedem Satz — hier darf nichts zwischengespeichert werden.
export const dynamic = "force-dynamic";

export default async function Training() {
  const heute = sessionFor(new Date());

  if (heute.art === "pause") {
    return (
      <div className="mx-auto max-w-[520px] pt-10 md:pt-14">
        <Eyebrow>Heute</Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em]">Pausentag</h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-dim">
          Deine Rotation ist Push – Pull – Pause. Als nächstes steht{" "}
          <b className="font-semibold text-fg">{heute.naechste.focus}</b> an.
        </p>
      </div>
    );
  }

  const uebungen = await planMitHistorie(heute.session);
  return <TrainingLogger uebungen={uebungen} session={heute.session} />;
}
