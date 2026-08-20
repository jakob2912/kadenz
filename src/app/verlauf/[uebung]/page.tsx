import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Eyebrow, de, kurzDatum } from "@/components/ui";
import { ReihenChart } from "@/components/reihen-chart";
import { saetzeFuer, FENSTER_TAGE } from "@/lib/kraftverlauf";
import { besterSatz, e1rm, e1rmReihe, kraftTrend } from "@/lib/kraft";

// Hängt an der Trainingshistorie und ändert sich nach jedem Satz.
export const dynamic = "force-dynamic";

export default async function UebungsVerlauf({
  params,
}: {
  params: Promise<{ uebung: string }>;
}) {
  const { uebung: roh } = await params;
  const uebung = decodeURIComponent(roh);

  let saetze;
  try {
    saetze = await saetzeFuer(uebung);
  } catch (e) {
    console.error(`Historie für "${uebung}" nicht lesbar:`, e);
    return (
      <div className="mx-auto max-w-[520px] pt-10 md:pt-14">
        <Zurueck />
        <h1 className="mt-3 text-[27px] font-bold tracking-[-0.025em]">{uebung}</h1>
        <Card className="mt-5">
          <p className="text-sm leading-relaxed text-fg-dim">
            Die Trainingshistorie ist gerade nicht lesbar. Versuch es gleich noch einmal.
          </p>
        </Card>
      </div>
    );
  }

  /* Kein leerer Bildschirm für eine Übung, die es nie gab: der Name steht in
     der URL, und ein Tippfehler darin sähe sonst aus wie "noch nie geloggt". */
  if (saetze.length === 0) notFound();

  const reihe = e1rmReihe(saetze);
  const urteil = kraftTrend(reihe);
  const best = besterSatz(saetze);
  const bestesMaximum = best ? e1rm(best) : null;
  const aktuell = reihe.length > 0 ? reihe[reihe.length - 1] : null;

  return (
    <div className="mx-auto max-w-[520px] pt-10 md:pt-14">
      <Zurueck />

      <header className="mt-3">
        <Eyebrow>
          Kraftverlauf · {saetze.length} Sätze aus {FENSTER_TAGE} Tagen
        </Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em] md:text-[33px]">
          {uebung}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-dim">
          {urteil.verwertbar ? urteil.text : urteil.grund}
        </p>
      </header>

      <Card className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow>Geschätztes Maximum</Eyebrow>
          <span className="text-[11px] text-fg-faint">
            {reihe.length === 0
              ? "keine verwertbaren Sätze"
              : `${reihe.length} Trainingstage · ab ${kurzDatum(reihe[0].datum)}`}
          </span>
        </div>
        <ReihenChart
          reihe={reihe.map((p) => ({ datum: p.datum, wert: p.e1rm }))}
          bezeichnung={`Kraftverlauf ${uebung}`}
          leer="Keiner der geloggten Sätze taugt zur Schätzung — über zehn Wiederholungen rechnet Kadenz kein Maximum aus."
          einzeln="Erst ein Trainingstag mit verwertbaren Sätzen. Ab dem zweiten steht hier eine Kurve."
        />
        <p className="mt-3.5 text-[11px] leading-relaxed text-fg-faint">
          Geschätzt nach Epley aus dem besten Satz je Trainingstag. Bei einer Maschine ist
          das kein Einer-Maximum im Wortsinn, sondern ein Lastindex — vergleichbar mit sich
          selbst über die Zeit, nicht mit einer Langhantel.
        </p>
      </Card>

      <div className="mt-3.5 grid gap-3.5 md:grid-cols-2">
        <Card>
          <Eyebrow>Bestleistung</Eyebrow>
          {best ? (
            <>
              <p className="num mt-2 text-[27px]">
                {de(best.kg, 1)}
                <span className="ml-1 text-xs font-medium text-fg-faint">kg × {best.reps}</span>
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
                {bestesMaximum === null
                  ? "Zu viele Wiederholungen für eine Schätzung — der Satz zählt als Bestleistung, nicht als Maximum."
                  : `Gemessen, nicht gerechnet. Daraus geschätztes Maximum ${de(bestesMaximum, 1)} kg.`}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-fg-dim">Noch kein gültiger Satz.</p>
          )}
        </Card>

        <Card>
          <Eyebrow>Zuletzt</Eyebrow>
          {aktuell ? (
            <>
              <p className="num mt-2 text-[27px]">
                {de(aktuell.e1rm, 1)}
                <span className="ml-1 text-xs font-medium text-fg-faint">kg geschätzt</span>
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
                Am {kurzDatum(aktuell.datum)}.
                {urteil.verwertbar && (
                  <>
                    {" "}
                    Im Schnitt der zweiten Hälfte {de(urteil.auf, 1)} kg gegen{" "}
                    {de(urteil.von, 1)} kg in der ersten — über {urteil.spanneTage} Tage.
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-fg-dim">
              Kein Satz unter elf Wiederholungen.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Zurueck() {
  return (
    <Link
      href="/verlauf"
      className="text-[13px] font-semibold text-accent transition md:hover:opacity-80"
    >
      ← Verlauf
    </Link>
  );
}
