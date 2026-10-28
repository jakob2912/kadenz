import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Eyebrow, Skelett, de, kurzDatum } from "@/components/ui";
import { ReihenChart } from "@/components/reihen-chart";
import { saetzeFuer, trendGrundlage, FENSTER_TAGE } from "@/lib/kraftverlauf";
import { trendSaetze } from "@/lib/bankcoach";
import { besterSatz, e1rm, e1rmReihe, kraftTrend } from "@/lib/kraft";


/**
 * Der Übungsname steht in der URL, die Historie in der Datenbank.
 *
 * Beides ist Request-Zeit: params kennt erst die Anfrage, und die Sätze
 * kommen aus Postgres. Vorgerendert wird deshalb nur die Rückwärts-Verknüpfung
 * und das Gerüst — die kostet nichts und ist der Teil, den man am ehesten
 * braucht, wenn man versehentlich hier gelandet ist.
 */
export default function UebungsVerlauf({
  params,
}: {
  params: Promise<{ uebung: string }>;
}) {
  return (
    <div className="mx-auto max-w-[520px] pt-10 md:pt-14">
      <Zurueck />
      <Suspense
        fallback={
          <>
            <Skelett hoehe={36} className="mt-3 w-56" />
            <Skelett hoehe={220} className="mt-5" />
            <Skelett hoehe={160} className="mt-3.5" />
          </>
        }
      >
        <Inhalt params={params} />
      </Suspense>
    </div>
  );
}

async function Inhalt({ params }: { params: Promise<{ uebung: string }> }) {
  const { uebung: roh } = await params;
  const uebung = decodeURIComponent(roh);

  let saetze;
  try {
    saetze = await saetzeFuer(uebung);
  } catch (e) {
    console.error(`Historie für "${uebung}" nicht lesbar:`, e);
    return (
      <>
        <h1 className="mt-3 text-[27px] font-bold tracking-[-0.025em]">{uebung}</h1>
        <Card className="mt-5">
          <p className="text-sm leading-relaxed text-fg-dim">
            The training history can't be read right now. Try again in a moment.
          </p>
        </Card>
      </>
    );
  }

  /* Kein leerer Bildschirm für eine Übung, die es nie gab: der Name steht in
     der URL, und ein Tippfehler darin sähe sonst aus wie "noch nie geloggt". */
  if (saetze.length === 0) notFound();

  const reihe = e1rmReihe(saetze);

  /* Das Diagramm zeigt alles, was geloggt ist. Das Urteil rechnet ab einem
     gesetzten Neustart und beim Bankdrücken nur mit den schweren Tagen. */
  let grundlage: Awaited<ReturnType<typeof trendGrundlage>> = { neustarts: {}, bankTmHistorie: [] };
  try {
    grundlage = await trendGrundlage();
  } catch (e) {
    console.error("Neustarts nicht lesbar:", e);
  }
  const urteil = kraftTrend(
    e1rmReihe(trendSaetze(uebung, saetze, grundlage.bankTmHistorie)),
    grundlage.neustarts[uebung]
  );
  const best = besterSatz(saetze);
  const bestesMaximum = best ? e1rm(best) : null;
  const aktuell = reihe.length > 0 ? reihe[reihe.length - 1] : null;

  return (
    <>

      <header className="mt-3">
        <Eyebrow>
          Strength trend · {saetze.length} sets over {FENSTER_TAGE} days
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
          <Eyebrow>Estimated max</Eyebrow>
          <span className="text-[11px] text-fg-faint">
            {reihe.length === 0
              ? "no usable sets"
              : `${reihe.length} training days · since ${kurzDatum(reihe[0].datum)}`}
          </span>
        </div>
        <ReihenChart
          reihe={reihe.map((p) => ({ datum: p.datum, wert: p.e1rm }))}
          bezeichnung={`Strength trend ${uebung}`}
          zeitraeume={[90, 365, 3650]}
          leer="None of the logged sets is usable for an estimate — Kadenz doesn't estimate a max above ten reps."
          einzeln="Only one training day with usable sets so far. A curve appears from the second one."
        />
        <p className="mt-3.5 text-[11px] leading-relaxed text-fg-faint">
          Estimated with Epley from the best set per training day. On a machine this isn't
          a true one-rep max but a load index — comparable with itself over time, not
          with a barbell.
        </p>
      </Card>

      <div className="mt-3.5 grid gap-3.5 md:grid-cols-2">
        <Card>
          <Eyebrow>Best performance</Eyebrow>
          {best ? (
            <>
              <p className="num mt-2 text-[27px]">
                {de(best.kg, 1)}
                <span className="ml-1 text-xs font-medium text-fg-faint">kg × {best.reps}</span>
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
                {bestesMaximum === null
                  ? "Too many reps for an estimate — the set counts as a best performance, not as a max."
                  : `Measured, not calculated. Estimated max from it: ${de(bestesMaximum, 1)} kg.`}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-fg-dim">No valid set yet.</p>
          )}
        </Card>

        <Card>
          <Eyebrow>Latest</Eyebrow>
          {aktuell ? (
            <>
              <p className="num mt-2 text-[27px]">
                {de(aktuell.e1rm, 1)}
                <span className="ml-1 text-xs font-medium text-fg-faint">kg estimated</span>
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
                On {kurzDatum(aktuell.datum)}.
                {urteil.verwertbar && (
                  <>
                    {" "}
                    Second-half average {de(urteil.auf, 1)} kg vs{" "}
                    {de(urteil.von, 1)} kg in the first — over {urteil.spanneTage} days.
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-fg-dim">
              No set under eleven reps.
            </p>
          )}
        </Card>
      </div>
    </>
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
