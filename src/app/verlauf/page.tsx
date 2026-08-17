import { loadDashboard } from "@/lib/health-service";
import {
  Card,
  Eyebrow,
  Metric,
  NichtVerbunden,
  alterLabel,
  de,
  heuteWien,
  kurzDatum,
  minToHm,
} from "@/components/ui";
import { weeksToGoal } from "@/lib/coach";

export const dynamic = "force-dynamic";

const ZIEL_KG = 97;

/** Angenommenes Tempo, solange der gemessene Trend nicht verwertbar ist. */
const ANNAHME_KG_WOCHE = 0.5;

export default async function Verlauf() {
  const data = await loadDashboard(30);

  if (!data.verbunden) {
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
          {zielSatz(gewicht.aktuell?.kg ?? null, gewicht.trend)}
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
          <GewichtsChart reihe={gewicht.reihe} />
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
    </>
  );
}

/**
 * Hochrechnung aufs Zielgewicht.
 *
 * Vorher rechnete diese Zeile immer mit 0,5 kg pro Woche — auch dann, wenn
 * der gemessene Trend längst bei 0,2 lag. Das Zieldatum war damit ein Wunsch
 * im Gewand einer Berechnung. Gemessen schlägt angenommen; ist nichts
 * Verwertbares da, steht die Annahme ausdrücklich dabei.
 */
function zielSatz(
  aktuellKg: number | null,
  trend: { usable: true; kgPerWeek: number } | { usable: false; detail: string }
): string {
  if (aktuellKg === null) return `Ziel ${ZIEL_KG} kg · noch keine Messung.`;
  if (aktuellKg >= ZIEL_KG) return `Ziel ${ZIEL_KG} kg erreicht.`;

  const fehlend = de(ZIEL_KG - aktuellKg, 1);

  if (trend.usable && trend.kgPerWeek > 0) {
    const wochen = weeksToGoal(aktuellKg, ZIEL_KG, trend.kgPerWeek);
    return wochen === null
      ? `Ziel ${ZIEL_KG} kg · noch ${fehlend} kg.`
      : `Ziel ${ZIEL_KG} kg · noch ${fehlend} kg, bei deinem gemessenen Tempo in ${wochen} Wochen (${monat(wochen)}).`;
  }

  if (trend.usable) {
    return `Ziel ${ZIEL_KG} kg · noch ${fehlend} kg. Beim aktuell gemessenen Tempo kommst du dort nicht an — du nimmst gerade nicht zu.`;
  }

  const wochen = weeksToGoal(aktuellKg, ZIEL_KG, ANNAHME_KG_WOCHE);
  return `Ziel ${ZIEL_KG} kg · noch ${fehlend} kg. Gemessenes Tempo steht noch aus; angenommen mit ${de(
    ANNAHME_KG_WOCHE,
    2
  )} kg pro Woche wären das ${wochen} Wochen.`;
}

function monat(inWochen: number): string {
  return new Date(Date.now() + inWochen * 7 * 864e5).toLocaleDateString("de-AT", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Vienna",
  });
}

/** Schlichter Linienchart. Messlücken werden nicht überbrückt, sondern gezeigt. */
function GewichtsChart({ reihe }: { reihe: { date: string; kg: number }[] }) {
  if (reihe.length < 2) {
    return (
      <p className="mt-4 text-sm leading-relaxed text-fg-dim">
        {reihe.length === 0
          ? "Noch keine Messung. Trag dein Morgengewicht auf der Startseite ein — ab zwei Messungen steht hier eine Kurve."
          : "Erst eine Messung. Ab der zweiten steht hier eine Kurve."}
      </p>
    );
  }

  const VW = 340;
  const VH = 170;
  const P = 32;
  const kgs = reihe.map((r) => r.kg);
  const lo = Math.floor(Math.min(...kgs) - 1);
  const hi = Math.ceil(Math.max(...kgs) + 1);

  const t0 = Date.parse(reihe[0].date);
  const t1 = Date.parse(reihe[reihe.length - 1].date);
  const x = (d: string) => P + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (VW - P - 14);
  const y = (kg: number) => VH - 24 - ((kg - lo) / (hi - lo)) * (VH - 46);

  // Segmente an Messlücken über drei Tage trennen
  const segmente: { date: string; kg: number }[][] = [[]];
  reihe.forEach((p, i) => {
    if (i > 0 && Date.parse(p.date) - Date.parse(reihe[i - 1].date) > 3 * 864e5) {
      segmente.push([]);
    }
    segmente[segmente.length - 1].push(p);
  });

  const erste = reihe[0];
  const letzte = reihe[reihe.length - 1];

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="mt-4 block h-[170px] w-full"
      role="img"
      aria-label={`Gewichtsverlauf von ${de(erste.kg, 1)} Kilogramm am ${kurzDatum(
        erste.date
      )} auf ${de(letzte.kg, 1)} Kilogramm am ${kurzDatum(letzte.date)}`}
    >
      {[lo, (lo + hi) / 2, hi].map((g) => (
        <g key={g}>
          <line x1={P} y1={y(g)} x2={VW - 14} y2={y(g)} stroke="var(--color-hair-soft)" />
          <text x="0" y={y(g) + 3.5} className="fill-fg-faint text-[10px] font-semibold">
            {de(g, 0)}
          </text>
        </g>
      ))}

      {reihe.map((p) => (
        <circle
          key={p.date}
          cx={x(p.date)}
          cy={y(p.kg)}
          r="1.9"
          className="fill-fg-faint opacity-50"
        />
      ))}

      {segmente
        .filter((s) => s.length > 1)
        .map((seg, i) => (
          <path
            key={i}
            d={`M ${seg.map((p) => `${x(p.date)} ${y(p.kg)}`).join(" L ")}`}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

      <circle
        cx={x(letzte.date)}
        cy={y(letzte.kg)}
        r="4.5"
        fill="var(--color-accent)"
        stroke="var(--color-ground)"
        strokeWidth="3"
      />

      {/* Die Kurve hatte keine Zeitachse: dass links April und rechts August
          steht, war ihr nicht anzusehen, und eine Messlücke sah aus wie ein
          gleichmäßiger Abstand. */}
      <text x={P} y={VH - 4} className="fill-fg-faint text-[10px] font-semibold">
        {kurzDatum(erste.date)}
      </text>
      <text
        x={VW - 14}
        y={VH - 4}
        textAnchor="end"
        className="fill-fg-faint text-[10px] font-semibold"
      >
        {kurzDatum(letzte.date)}
      </text>
    </svg>
  );
}
