import { loadDashboard } from "@/lib/health-service";
import { SCHULSTART, briefing, phaseFor, type Briefing } from "@/lib/coach";
import { rotationFor } from "@/lib/plan";
import { wienerStunde } from "@/lib/datum";
import { GewichtEingabe } from "@/components/gewicht-eingabe";
import {
  Card,
  Eyebrow,
  Gauge,
  Metric,
  NichtVerbunden,
  Tag,
  alterLabel,
  de,
  heuteWien,
  kurzDatum,
  minToHm,
} from "@/components/ui";

// Gesundheitsdaten ändern sich täglich und hängen am Cookie — nie cachen.
export const dynamic = "force-dynamic";

export default async function Heute() {
  const data = await loadDashboard(30);

  if (!data.verbunden) {
    return <NichtVerbunden titel="Erst mit Google Health verbinden" grund={data.grund} />;
  }

  const { heute, baseline, gewicht } = data;
  const heuteIso = heuteWien();

  // timeZone ausdrücklich gesetzt: ohne sie nimmt toLocaleDateString die
  // Serverzeit, und auf Vercel (UTC) steht ab 22:00 Wiener Zeit der Vortag da.
  const heuteDatum = new Date().toLocaleDateString("de-AT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Vienna",
  });

  // Aus SCHULSTART abgeleitet statt hartkodiert: "Ferien bis 7. September"
  // stand bisher als fester Text da und wäre ab dem 7. September schlicht
  // falsch gewesen, ohne dass es jemandem auffällt.
  const phasenText =
    phaseFor(heuteIso) === "ferien"
      ? `Ferien bis ${new Date(`${SCHULSTART}T12:00:00Z`).toLocaleDateString("de-AT", {
          day: "numeric",
          month: "long",
          timeZone: "Europe/Vienna",
        })}`
      : "Schulzeit";

  // Nächte tragen den Aufwachtag als Datum. Ist der nicht von heute, hat die
  // Uhr nicht synchronisiert — dann stehen oben ältere Werte, und ohne diesen
  // Abgleich liest man sie als die von heute Nacht.
  const tageAlt =
    heute === null
      ? 0
      : Math.round(
          (Date.parse(`${heuteIso}T00:00:00Z`) - Date.parse(`${heute.date}T00:00:00Z`)) /
            864e5
        );
  const veraltet = tageAlt >= 1;

  return (
    <>
      <header className="pt-10 md:pt-14">
        <Eyebrow>
          {heuteDatum} · {phasenText}
        </Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold leading-tight tracking-[-0.025em] md:text-[33px]">
          {gruss()}, Jakob
        </h1>
      </header>

      <div className="mt-7 grid items-start gap-4 md:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col gap-3.5">
          {heute && baseline ? (
            <Card tone={veraltet ? "warnung" : "normal"}>
              <div className="flex items-center justify-between gap-3">
                <Eyebrow>
                  Regeneration · Nacht auf {alterLabel(heute.date, heuteIso)}
                </Eyebrow>
                <Tag tone={bandTon(heute.regeneration.band)}>
                  {bandWort(heute.regeneration.band)}
                </Tag>
              </div>

              <div className="mt-3.5 flex items-center gap-5">
                <Gauge score={heute.regeneration.score} band={heute.regeneration.band} />
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  {/* Alle vier Zeilen nach demselben Schema eingefärbt. Vorher
                      war Schlaf unter Referenz amber, Tiefschlaf/Puls/HRV rot —
                      zwei Farben für dieselbe Aussage in einer Liste zwingen
                      dazu, die Skala pro Zeile neu zu lesen. */}
                  <Metric
                    label="Schlaf"
                    value={minToHm(heute.sleepMin)}
                    delta={deltaLabel(heute.sleepMin - baseline.sleepMin, "min")}
                    tone={heute.sleepMin >= baseline.sleepMin ? "gut" : "schlecht"}
                  />
                  <Metric
                    label="Tiefschlaf"
                    value={`${heute.deepMin} min`}
                    delta={deltaLabel(heute.deepMin - baseline.deepMin, "min")}
                    tone={heute.deepMin >= baseline.deepMin ? "gut" : "schlecht"}
                  />
                  <Metric
                    label="Ruhepuls"
                    value={`${heute.restingHr} bpm`}
                    delta={deltaLabel(heute.restingHr - baseline.restingHr, "")}
                    tone={heute.restingHr <= baseline.restingHr ? "gut" : "schlecht"}
                  />
                  <Metric
                    label="HRV"
                    value={`${de(heute.hrv)} ms`}
                    delta={deltaLabel(heute.hrv - baseline.hrv, "")}
                    tone={heute.hrv >= baseline.hrv ? "gut" : "schlecht"}
                  />
                </div>
              </div>

              {veraltet && (
                <p className="mt-3.5 rounded-md border border-caution/30 bg-caution/10 px-3.5 py-2.5 text-xs leading-relaxed text-caution">
                  Die letzte vollständige Nacht ist die auf {kurzDatum(heute.date)} — das
                  sind {tageAlt === 1 ? "ein Tag" : `${tageAlt} Tage`}. Was hier steht, ist
                  nicht dein heutiger Zustand. Uhr synchronisieren lassen.
                </p>
              )}

              {/* Der grüne Punkt, der hier stand, war immer grün — er hat den
                  Zustand nie gemeldet, nur behauptet. An seiner Stelle steht
                  jetzt, worauf die Referenz beruht. */}
              <p className="mt-3.5 text-[11px] leading-relaxed text-fg-faint">
                Fitbit Air · Referenz aus {data.tagesreihe.length} ausgewerteten Nächten
              </p>
            </Card>
          ) : (
            <Card>
              <Eyebrow>Regeneration</Eyebrow>
              <p className="mt-2 text-sm leading-relaxed text-fg-dim">
                Noch keine vollständige Nacht mit Ruhepuls und HRV. Sobald die Uhr eine
                Nacht mit allen drei Werten geliefert hat, steht hier ein Wert; für die
                persönliche Referenz braucht es fünf solche Nächte.
              </p>
            </Card>
          )}

          {heute && baseline && (
            <Card tone={heute.regeneration.band === "gut" ? "normal" : "warnung"}>
              <div className="flex items-start gap-3.5">
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br
                             from-accent to-accent-deep text-xs font-extrabold text-on-accent"
                  aria-hidden
                >
                  K
                </div>
                <div className="min-w-0 flex-1 text-sm leading-relaxed text-fg-dim">
                  <Tagesbriefing
                    briefing={briefing({
                      heute,
                      baseline,
                      urteil: heute.regeneration,
                      nachtDatum: heute.date,
                      heuteIso,
                      trainingHeute: rotationFor(new Date()).art === "training",
                      stunde: wienerStunde(),
                    })}
                  />
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <GewichtEingabe
            aktuell={gewicht.aktuell?.kg ?? null}
            /* Das Alter wird am Server berechnet und fertig übergeben. Würde
               die Client-Komponente selbst auf die Uhr sehen, könnte sie um
               Mitternacht ein anderes Ergebnis bekommen als der Server und
               die Hydrierung bräche. */
            datumLabel={
              gewicht.aktuell ? alterLabel(gewicht.aktuell.date, heuteIso) : null
            }
            schnitt7={gewicht.schnitt7}
          />

          <Card>
            <Eyebrow>Trend</Eyebrow>
            {gewicht.trend.usable ? (
              <>
                <p className="num mt-2 text-[27px]">
                  {gewicht.trend.kgPerWeek > 0 ? "+" : ""}
                  {de(gewicht.trend.kgPerWeek, 2)}
                  <span className="ml-1 text-xs font-medium text-fg-faint">kg / Woche</span>
                </p>
                {/* Vorher stand hier nur der Korridor daneben und der Vergleich
                    blieb dem Leser überlassen. Die Zahl allein sagt nicht, ob
                    sie gut ist. */}
                <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
                  {korridorUrteil(gewicht.trend.kgPerWeek)}
                </p>
              </>
            ) : (
              <>
                <p className="num mt-2 text-[27px] text-fg-faint">—</p>
                <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
                  {gewicht.trend.detail}
                </p>
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/**
 * Tageszeitabhängiger Gruß.
 *
 * Die Stunde wird ausdrücklich in Wiener Zeit bestimmt, nicht aus der
 * Serverzeit: auf Vercel laufen die Server in UTC, und dort stünde um
 * 8 Uhr früh sonst "Gute Nacht".
 *
 * Ausgelesen wird über formatToParts, nicht über Number(...format(...)):
 * de-AT formatiert eine Stunde als "18 Uhr", nicht als "18". Number("18 Uhr")
 * ist NaN, und jeder Vergleich gegen NaN ist falsch — damit fiel die Funktion
 * rund um die Uhr auf den letzten Zweig durch und grüßte auch um 14 Uhr mit
 * "Gute Nacht". formatToParts liefert die Stunde als eigenen Teil, ohne die
 * Beschriftung der Sprache.
 *
 * hourCycle: "h23" statt hour12: false, damit Mitternacht 0 ergibt und nicht
 * 24 — h24 wäre kein Treffer in den Bereichen unten.
 */
function gruss(): string {
  const stunde = wienerStunde();

  if (stunde >= 5 && stunde < 11) return "Guten Morgen";
  if (stunde >= 11 && stunde < 18) return "Guten Tag";
  if (stunde >= 18 && stunde < 22) return "Guten Abend";
  return "Gute Nacht";
}

/** Der Zustand steht im Wort, nicht nur in der Farbe. */
function bandWort(band: "gut" | "mittel" | "schlecht"): string {
  if (band === "gut") return "erholt";
  if (band === "mittel") return "erholt sich";
  return "unerholt";
}

function bandTon(band: "gut" | "mittel" | "schlecht"): "gut" | "warnung" | "schlecht" {
  if (band === "gut") return "gut";
  if (band === "mittel") return "warnung";
  return "schlecht";
}

/** Einordnung statt bloßer Zahl — der Korridor allein beantwortet nichts. */
function korridorUrteil(kgProWoche: number): string {
  if (kgProWoche <= 0) {
    return "Du nimmst gerade nicht zu. Im Aufbau fehlt damit die Grundlage — Zielkorridor sind 0,25 bis 0,50 kg pro Woche.";
  }
  if (kgProWoche < 0.25) {
    return "Unter dem Zielkorridor von 0,25 bis 0,50 kg pro Woche. Etwas mehr essen.";
  }
  if (kgProWoche <= 0.5) {
    return "Im Zielkorridor von 0,25 bis 0,50 kg pro Woche. So weiterlaufen lassen.";
  }
  return "Über dem Zielkorridor von 0,25 bis 0,50 kg pro Woche — der Überschuss geht ab hier vor allem ins Fett.";
}

function deltaLabel(diff: number, unit: string): string {
  const rounded = Math.round(diff * 10) / 10;
  if (Math.abs(rounded) < 0.05) return "±0";
  const sign = rounded > 0 ? "+" : "−";
  const digits = Math.abs(rounded) < 10 ? 1 : 0;
  return `${sign}${de(Math.abs(rounded), digits)}${unit ? " " + unit : ""}`;
}

/**
 * Das Briefing als Karte.
 *
 * Vorher standen hier zwei Absätze über die Freigabe. Was fehlte, war das
 * Naheliegende: wie die Nacht war und was man heute anders machen kann. Die
 * Vorschlagsliste steht ausdrücklich nur da, wenn es einen gemessenen Grund
 * gibt — eine Liste, die immer drei Punkte hat, wird nach einer Woche
 * überblättert.
 */
function Tagesbriefing({ briefing }: { briefing: Briefing }) {
  return (
    <>
      <p>
        <b className="font-semibold text-fg">{briefing.befund}</b> {briefing.schlaf}
      </p>

      {briefing.vorschlaege.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2.5">
          {briefing.vorschlaege.map((v) => (
            <li key={v.text} className="border-l-2 border-accent/40 pl-3">
              <b className="block font-semibold text-fg">{v.text}</b>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-fg-faint">
                {v.grund}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2.5 text-[13px] leading-relaxed text-fg-faint">
          Nichts zu verbessern — kein Wert liegt weit genug daneben, um daraus einen Rat zu
          machen. Weiter wie gestern.
        </p>
      )}
    </>
  );
}
