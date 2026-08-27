import { Suspense } from "react";
import { connection } from "next/server";
import { loadDashboard } from "@/lib/health-service";
import {
  Card,
  Eyebrow,
  Metric,
  NichtVerbunden,
  Skelett,
  alterLabel,
  de,
  heuteWien,
  kurzDatum,
  minToHm,
} from "@/components/ui";
import { ReihenChart } from "@/components/reihen-chart";
import { Kraftverlauf } from "@/components/kraftverlauf";
import {
  ENDZIEL_KG,
  aktuellePhase,
  phasenlauf,
  sollGewichtAm,
  sollKurve,
} from "@/lib/gewichtsplan";

/**
 * Gewicht und Referenzwerte kommen aus Google Health, der Kraftverlauf aus
 * der eigenen Datenbank. Beide bekommen eine eigene Suspense-Grenze: der
 * Kraftverlauf ist meist deutlich schneller da und soll nicht auf Google
 * warten müssen. Vorher wartete die ganze Seite auf beides zugleich.
 */
export default function Verlauf() {
  return (
    <>
      <Suspense
        fallback={
          <>
            <div className="pt-10 md:pt-14">
              <Skelett hoehe={16} className="w-56" />
              <Skelett hoehe={38} className="mt-3 w-40" />
              <Skelett hoehe={18} className="mt-3 w-72" />
            </div>
            <div className="mt-7 grid items-start gap-4 md:grid-cols-2">
              <Skelett hoehe={260} />
              <div className="flex flex-col gap-3.5">
                <Skelett hoehe={110} />
                <Skelett hoehe={200} />
              </div>
            </div>
          </>
        }
      >
        <Gewichtsteil />
      </Suspense>

      <Suspense fallback={<Skelett hoehe={240} className="mt-4" />}>
        <Kraftverlauf />
      </Suspense>
    </>
  );
}

async function Gewichtsteil() {
  /* alterLabel() und die Hochrechnung aufs Zielgewicht rechnen beide gegen
     heute. Beim Bauen steht der Tag nicht fest. */
  await connection();

  const data = await loadDashboard(30);

  if (!data.verbunden) {
    /* Der Kraftverlauf hängt an der eigenen Datenbank, nicht an Google. Ihn
       mit auszublenden, weil das Token abgelaufen ist, nähme einem genau dann
       die Trainingshistorie weg, wenn ohnehin schon etwas klemmt. Er steht
       jetzt eine Ebene höher in seiner eigenen Suspense-Grenze und bleibt
       damit von selbst sichtbar. */
    return <NichtVerbunden titel="Verlauf braucht Google Health" grund={data.grund} />;
  }

  const { gewicht, tagesreihe, baseline, unvollstaendig } = data;
  const heuteIso = heuteWien();

  return (
    <>
      <header className="pt-10 md:pt-14">
        {/* Statt "195 cm": die Körpergröße ändert sich nie und beantwortet
            keine Frage. Wie alt der angezeigte Wert ist, entscheidet dagegen,
            ob man ihm überhaupt glauben darf. */}
        <Eyebrow>
          Körpergewicht
          {gewicht.aktuell ? ` · gemessen ${alterLabel(gewicht.aktuell.date, heuteIso)}` : ""}
        </Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em] md:text-[33px]">
          {gewicht.aktuell ? `${de(gewicht.aktuell.kg, 1)} kg` : "—"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-dim">
          {zielSatz(gewicht.aktuell?.kg ?? null, heuteIso)}
        </p>
      </header>

      <div className="mt-7 grid items-start gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow>Gewichtsverlauf</Eyebrow>
            {/* "30 Tage" stand hier fest, auch wenn nur sechs Messungen aus
                acht Tagen vorlagen — der Titel behauptete einen Zeitraum, den
                die Kurve nie gezeigt hat. */}
            <span className="text-[11px] text-fg-faint">
              {gewicht.reihe.length === 0
                ? "keine Messung"
                : `${gewicht.reihe.length} Messungen · ab ${kurzDatum(gewicht.reihe[0].date)}`}
            </span>
          </div>
          {/* Die Soll-Linie hier nur über das gemessene Fenster plus vier
              Wochen: der ganze Plan reicht bis November 2027, und über diese
              Achse gelegt schrumpfte der Monat mit echten Messungen zu einem
              Strich am linken Rand. Die Frage an dieser Karte lautet "liege
              ich gerade richtig", nicht "wo endet das". Letzteres beantwortet
              die Zielkurven-Karte darunter. */}
          <ReihenChart
            reihe={gewicht.reihe.map((r) => ({ datum: r.date, wert: r.kg }))}
            soll={sollAusschnitt(gewicht.reihe[0]?.date ?? heuteIso, 4)}
            sollBezeichnung="Plan"
            bezeichnung="Gewichtsverlauf"
            leer="Noch keine Messung. Trag dein Morgengewicht auf der Startseite ein — ab zwei Messungen steht hier eine Kurve."
            einzeln="Erst eine Messung. Ab der zweiten steht hier eine Kurve."
          />
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card>
            <Eyebrow>Trendurteil</Eyebrow>
            {gewicht.trend.usable ? (
              <p className="num mt-2 text-[27px]">
                {gewicht.trend.kgPerWeek > 0 ? "+" : ""}
                {de(gewicht.trend.kgPerWeek, 2)}
                <span className="ml-1 text-xs font-medium text-fg-faint">kg / Woche</span>
              </p>
            ) : (
              <>
                {/* Der Strich macht sichtbar, dass hier eine Zahl fehlt statt
                    dass die Karte leer aussieht. Der Rahmen bleibt neutral:
                    Amber steht in dieser App für Regeneration, und "noch keine
                    Aussage möglich" ist kein Zustand deines Körpers. */}
                <p className="num mt-2 text-[27px] text-fg-faint">—</p>
                <p className="mt-2 text-sm leading-relaxed text-fg-dim">
                  {gewicht.trend.detail}
                </p>
              </>
            )}
          </Card>

          {baseline ? (
            <Card>
              <Eyebrow>Deine Referenzwerte</Eyebrow>
              <div className="mt-3 flex flex-col gap-2.5">
                <Metric label="Schlaf" value={minToHm(baseline.sleepMin)} />
                <Metric label="Tiefschlaf" value={`${Math.round(baseline.deepMin)} min`} />
                <Metric label="Ruhepuls" value={`${de(baseline.restingHr)} bpm`} />
                <Metric label="HRV" value={`${de(baseline.hrv)} ms`} />
              </div>
              <p className="mt-3.5 text-xs leading-relaxed text-fg-faint">
                Aus der jeweils besseren Hälfte von {tagesreihe.length} Nächten — nicht der
                Mittelwert, sonst würde eine Ausreißerwoche die Referenz mitverschieben.
                {/* unvollstaendig wurde bisher berechnet und weggeworfen. Ohne
                    diese Zeile wirkt es, als hätte die Uhr nur so wenige Nächte
                    aufgezeichnet — tatsächlich fehlt bei den anderen nur ein
                    einzelner Wert. */}
                {unvollstaendig.length > 0 && (
                  <>
                    {" "}
                    {unvollstaendig.length}{" "}
                    {unvollstaendig.length === 1 ? "weitere Nacht" : "weitere Nächte"} ohne
                    Ruhepuls oder HRV — die zählen nicht mit.
                  </>
                )}
              </p>
            </Card>
          ) : (
            <Card>
              <Eyebrow>Deine Referenzwerte</Eyebrow>
              <p className="mt-2 text-sm leading-relaxed text-fg-dim">
                Noch keine Referenz. Dafür braucht Kadenz fünf Nächte, in denen Schlaf,
                Ruhepuls und HRV zusammen aufgezeichnet wurden — bisher sind es{" "}
                {tagesreihe.length}.
              </p>
            </Card>
          )}
        </div>
      </div>

      <Zielkurve reihe={gewicht.reihe.map((r) => ({ datum: r.date, wert: r.kg }))} heuteIso={heuteIso} />
    </>
  );
}

/**
 * Ein Ausschnitt der Sollkurve: ab einem Datum bis einige Wochen über heute
 * hinaus.
 *
 * Gebraucht für die Karte oben, die neben der Messreihe steht. Der ganze Plan
 * reicht bis November 2027 — über diese Zeitachse gelegt schrumpfte der Monat
 * mit echten Messungen auf einen Strich.
 */
function sollAusschnitt(abIso: string, wochenVoraus: number): { datum: string; wert: number }[] {
  const von = Date.parse(`${abIso}T00:00:00Z`);
  const bis = Date.now() + wochenVoraus * 7 * 864e5;

  return sollKurve()
    .filter((p) => {
      const t = Date.parse(`${p.datum}T00:00:00Z`);
      return t >= von && t <= bis;
    })
    .map((p) => ({ datum: p.datum, wert: p.kg }));
}

/**
 * Der ganze Plan in einer Karte.
 *
 * Die Karte oben beantwortet "liege ich gerade richtig". Diese beantwortet
 * "wo führt das hin" — und dafür muss der Mini-Cut als Delle sichtbar sein,
 * sonst ist er nur eine Behauptung im Fließtext.
 */
function Zielkurve({
  reihe,
  heuteIso,
}: {
  reihe: { datum: string; wert: number }[];
  heuteIso: string;
}) {
  const laeufe = phasenlauf();
  const jetzt = aktuellePhase(heuteIso);

  return (
    <Card className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Zielkurve · bis {ENDZIEL_KG} kg</Eyebrow>
        <span className="text-[11px] text-fg-faint">
          Phase {jetzt.nummer} von {laeufe.length} · {jetzt.phase.label}
        </span>
      </div>

      <ReihenChart
        reihe={reihe}
        soll={sollKurve().map((p) => ({ datum: p.datum, wert: p.kg }))}
        sollBezeichnung="Plan"
        bezeichnung="Gewichtsplanung"
        lueckeTage={9999}
        leer="Noch keine Messung."
        einzeln="Erst eine Messung."
      />

      <ol className="mt-4 flex flex-col gap-2.5">
        {laeufe.map((lauf) => {
          const laeuftGerade = lauf.nummer === jetzt.nummer;
          return (
            <li key={lauf.nummer} className="flex items-baseline gap-3">
              <span
                className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-sm text-[10px] font-bold
                            ${laeuftGerade ? "bg-accent/15 text-accent" : "bg-surface-3 text-fg-dim"}`}
              >
                {lauf.nummer}
              </span>
              <span className="min-w-0 flex-1">
                <b className="text-[13px] font-semibold">{lauf.phase.label}</b>{" "}
                <span className="text-[12px] tabular-nums text-fg-dim">
                  {de(lauf.vonKg, 1)} → {de(lauf.bisKg, 1)} kg
                </span>
                <span className="block text-[11px] leading-relaxed text-fg-faint">
                  {kurzDatum(lauf.vonIso)} bis {kurzDatum(lauf.bisIso)} ·{" "}
                  {lauf.phase.rateProWoche > 0 ? "+" : ""}
                  {de(lauf.phase.rateProWoche, 3).replace(/0$/, "")} kg/Woche · {lauf.phase.zweck}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-[11px] leading-relaxed text-fg-faint">
        Die Kurve ist am {kurzDatum("2026-08-25")} bei 82,5 kg verankert und wandert nicht mit —
        nur so ist eine Abweichung überhaupt zu sehen. Ändern lässt sie sich an einer Stelle:
        GEWICHTSPLAN in src/lib/gewichtsplan.ts. Der Kalorien-Coach liest den Korridor aus
        derselben Liste und schlägt im Mini-Cut deshalb Senkungen statt Erhöhungen vor.
      </p>
    </Card>
  );
}

/**
 * Der Satz unter der großen Zahl: wo du stehst, gemessen am Plan.
 *
 * Vorher rechnete er gegen ein festes Ziel von 97 kg hoch und nannte ein
 * Datum, das aus dem gemessenen Tempo folgte. Beides ist überholt: das Ziel
 * ist keine einzelne Zahl mehr, sondern eine Folge von Phasen, und das
 * nächste, was zählt, ist nicht die 100 — es ist die Marke der laufenden
 * Phase.
 *
 * Die Abweichung steht ausdrücklich dabei. Eine Zielkurve, gegen die man sich
 * nicht vergleichen kann, ist Dekoration.
 */
function zielSatz(aktuellKg: number | null, heuteIso: string): string {
  const jetzt = aktuellePhase(heuteIso);
  const soll = sollGewichtAm(heuteIso);
  const marke = `${jetzt.phase.label} bis ${de(jetzt.bisKg, 1)} kg (${kurzDatum(jetzt.bisIso)})`;

  if (aktuellKg === null) return `${marke} · noch keine Messung.`;

  if (soll === null) return `${marke} · du liegst bei ${de(aktuellKg, 1)} kg.`;

  const abweichung = aktuellKg - soll;
  const lage =
    Math.abs(abweichung) < 0.5
      ? "das ist auf Plan"
      : abweichung > 0
        ? `das sind ${de(abweichung, 1)} kg über Plan`
        : `das sind ${de(-abweichung, 1)} kg unter Plan`;

  const fehlend = jetzt.bisKg - aktuellKg;
  const rest =
    fehlend <= 0
      ? " Die Marke dieser Phase ist erreicht."
      : ` Bis zur Marke fehlen ${de(fehlend, 1)} kg.`;

  return `${marke} · heute wären ${de(soll, 1)} kg vorgesehen, ${lage}.${rest}`;
}

