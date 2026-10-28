import { Suspense } from "react";
import { connection } from "next/server";
import { loadDashboard } from "@/lib/health-service";
import {
  AbgelaufenHinweis,
  Card,
  Eyebrow,
  Metric,
  NichtVerbunden,
  Skelett,
  alterLabel,
  de,
  heuteWien,
  kurzDatum,
  langDatum,
  minToHm,
} from "@/components/ui";
import { ReihenChart } from "@/components/reihen-chart";
import { Kraftverlauf } from "@/components/kraftverlauf";
import { Einheitenverlauf } from "@/components/einheitenverlauf";
import { Wochenueberblick } from "@/components/wochenueberblick";
import { NaechteChart } from "@/components/naechte-chart";
import { gewichteLesen, gewichteVereinen, tageswerteLesen } from "@/lib/gesundheit-ablage";
import { VerlaufUmschalter } from "@/components/verlauf-umschalter";
import {
  START,
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
      <VerlaufUmschalter aktiv="koerper" />
      <Suspense
        fallback={
          <>
            <div className="pt-6 md:pt-8">
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

      <Suspense fallback={<Skelett hoehe={240} className="mt-4" />}>
        <Einheitenverlauf />
      </Suspense>

      <Suspense fallback={<Skelett hoehe={530} className="mt-4" />}>
        <Wochenueberblick />
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
    return (
      <NichtVerbunden
        titel="History needs Google Health"
        grund={data.grund}
        className="pt-6 md:pt-8"
      />
    );
  }

  const { gewicht, tagesreihe, baseline, unvollstaendig } = data;
  const heuteIso = heuteWien();

  /* Für die Diagramme ein Jahr aus der eigenen Ablage, die letzten dreißig
     Tage frisch von Google darübergelegt. Fehlt die Ablage, bleibt es bei
     den dreißig Tagen. */
  let jahrGewicht = gewicht.reihe;
  let jahrNaechte = tagesreihe;
  try {
    const [g, n] = await Promise.all([gewichteLesen(365), tageswerteLesen(365)]);
    // Die frische Reihe zuerst: sie gewinnt, wo beide einen Tag haben.
    jahrGewicht = gewichteVereinen(gewicht.reihe, g);
    const frisch = new Map(tagesreihe.map((t) => [t.date, t]));
    jahrNaechte = [...n.filter((t) => !frisch.has(t.date)), ...tagesreihe].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  } catch (e) {
    console.error("Ablage nicht lesbar:", e);
  }

  return (
    <>
      <header className="pt-6 md:pt-8">
        {/* Statt "195 cm": die Körpergröße ändert sich nie und beantwortet
            keine Frage. Wie alt der angezeigte Wert ist, entscheidet dagegen,
            ob man ihm überhaupt glauben darf. */}
        <Eyebrow>
          Body weight
          {gewicht.aktuell ? ` · measured ${alterLabel(gewicht.aktuell.date, heuteIso)}` : ""}
        </Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em] md:text-[33px]">
          {gewicht.aktuell ? `${de(gewicht.aktuell.kg, 1)} kg` : "—"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-dim">
          {zielSatz(gewicht.aktuell?.kg ?? null, heuteIso)}
        </p>
      </header>

      {data.abgelaufen && <AbgelaufenHinweis lage={data.abgelaufen} className="mt-5" />}

      <div className="mt-7 grid items-start gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow>Weight trend</Eyebrow>
            {/* "30 Tage" stand hier fest, auch wenn nur sechs Messungen aus
                acht Tagen vorlagen — der Titel behauptete einen Zeitraum, den
                die Kurve nie gezeigt hat. */}
            <span className="text-[11px] text-fg-faint">
              {jahrGewicht.length === 0
                ? "no measurement"
                : `${jahrGewicht.length} measurements since ${langDatum(jahrGewicht[0].date)}`}
            </span>
          </div>
          {/* Die Soll-Linie hier nur über das gemessene Fenster plus vier
              Wochen: der ganze Plan reicht bis November 2027, und über diese
              Achse gelegt schrumpfte der Monat mit echten Messungen zu einem
              Strich am linken Rand. Die Frage an dieser Karte lautet "liege
              ich gerade richtig", nicht "wo endet das". Letzteres beantwortet
              die Zielkurven-Karte darunter. */}
          <ReihenChart
            reihe={jahrGewicht.map((r) => ({ datum: r.date, wert: r.kg }))}
            soll={sollAusschnitt(jahrGewicht[0]?.date ?? heuteIso, 4)}
            sollBezeichnung="Plan"
            bezeichnung="Weight trend"
            zeitraeume={[30, 90, 365]}
            leer="No measurement yet. Log your morning weight in Google Health — from two measurements on, a curve appears here."
            einzeln="Only one measurement so far. A curve appears from the second one."
          />
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card>
            <Eyebrow>Trend</Eyebrow>
            {gewicht.trend.usable ? (
              <p className="num mt-2 text-[27px]">
                {gewicht.trend.kgPerWeek > 0 ? "+" : ""}
                {de(gewicht.trend.kgPerWeek, 2)}
                <span className="ml-1 text-xs font-medium text-fg-faint">kg / week</span>
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
              <Eyebrow>Your baselines</Eyebrow>
              <div className="mt-3 flex flex-col gap-2.5">
                <Metric label="Sleep" value={minToHm(baseline.sleepMin)} />
                <Metric label="Deep sleep" value={`${Math.round(baseline.deepMin)} min`} />
                <Metric label="Resting HR" value={`${de(baseline.restingHr)} bpm`} />
                <Metric label="HRV" value={`${de(baseline.hrv)} ms`} />
              </div>
              <p className="mt-3.5 text-xs leading-relaxed text-fg-faint">
                From the better half of {tagesreihe.length} nights each — not the average,
                otherwise one outlier week would drag the baseline along.
                {/* unvollstaendig wurde bisher berechnet und weggeworfen. Ohne
                    diese Zeile wirkt es, als hätte die Uhr nur so wenige Nächte
                    aufgezeichnet — tatsächlich fehlt bei den anderen nur ein
                    einzelner Wert. */}
                {unvollstaendig.length > 0 && (
                  <>
                    {" "}
                    {unvollstaendig.length}{" "}
                    {unvollstaendig.length === 1 ? "more night" : "more nights"} without
                    resting HR or HRV — those don't count.
                  </>
                )}
              </p>
            </Card>
          ) : (
            <Card>
              <Eyebrow>Your baselines</Eyebrow>
              <p className="mt-2 text-sm leading-relaxed text-fg-dim">
                No baseline yet. Kadenz needs five nights with sleep, resting HR and HRV
                all recorded — so far there are{" "}
                {tagesreihe.length}.
              </p>
            </Card>
          )}
        </div>
      </div>

      <NaechteChart naechte={jahrNaechte} />

      {/* Ab dem Anker des Plans: ein Jahr Messungen davor hätte die Achse
          bis Herbst 2025 gestreckt und den Plan auf zwei Drittel gestaucht. */}
      <Zielkurve
        reihe={jahrGewicht
          .filter((r) => r.date >= START.datum)
          .map((r) => ({ datum: r.date, wert: r.kg }))}
        heuteIso={heuteIso}
      />
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
        <Eyebrow>Target curve · to {ENDZIEL_KG} kg</Eyebrow>
        <span className="text-[11px] text-fg-faint">
          Phase {jetzt.nummer} of {laeufe.length} · {jetzt.phase.label}
        </span>
      </div>

      <ReihenChart
        reihe={reihe}
        soll={sollKurve().map((p) => ({ datum: p.datum, wert: p.kg }))}
        sollBezeichnung="Plan"
        bezeichnung="Weight plan"
        lueckeTage={9999}
        leer="No measurement yet."
        einzeln="Only one measurement so far."
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
                  {kurzDatum(lauf.vonIso)} to {kurzDatum(lauf.bisIso)} ·{" "}
                  {lauf.phase.rateProWoche > 0 ? "+" : ""}
                  {de(lauf.phase.rateProWoche, 3).replace(/0$/, "")} kg/week · {lauf.phase.zweck}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-[11px] leading-relaxed text-fg-faint">
        The curve is anchored at 82.5 kg on {kurzDatum("2026-08-25")} and doesn't move along —
        that's the only way to see a deviation at all. It can be changed in one place:
        GEWICHTSPLAN in src/lib/gewichtsplan.ts. The calorie coach reads the corridor from
        the same list, which is why it suggests cuts instead of increases during the mini-cut.
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
  const marke = `${jetzt.phase.label} to ${de(jetzt.bisKg, 1)} kg (${kurzDatum(jetzt.bisIso)})`;

  if (aktuellKg === null) return `${marke} · no measurement yet.`;

  if (soll === null) return `${marke} · you're at ${de(aktuellKg, 1)} kg.`;

  const abweichung = aktuellKg - soll;
  const lage =
    Math.abs(abweichung) < 0.5
      ? "that's on plan"
      : abweichung > 0
        ? `that's ${de(abweichung, 1)} kg over plan`
        : `that's ${de(-abweichung, 1)} kg under plan`;

  const fehlend = jetzt.bisKg - aktuellKg;
  const rest =
    fehlend <= 0
      ? " This phase's mark is reached."
      : ` ${de(fehlend, 1)} kg to go to the mark.`;

  return `${marke} · today's plan is ${de(soll, 1)} kg, ${lage}.${rest}`;
}

