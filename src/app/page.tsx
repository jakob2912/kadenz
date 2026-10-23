import { Suspense } from "react";
import { connection } from "next/server";
import { loadDashboard } from "@/lib/health-service";
import { aktuellePhase } from "@/lib/gewichtsplan";
import { SCHULSTART, briefing, phaseFor, type Briefing } from "@/lib/coach";
import { rotationMitPlan } from "@/lib/wochenplan";
import { heutigeEinheit, laufendesTraining } from "@/lib/training-lesen";
import { SESSIONS, type Rotation } from "@/lib/plan";
import Link from "next/link";
import { wienerStunde } from "@/lib/datum";
import { GewichtEingabe } from "@/components/gewicht-eingabe";
import { InstallHinweis } from "@/components/pwa";
import { AbgelaufenHinweis, EinstellungenLink } from "@/components/ui";
import {
  Card,
  Eyebrow,
  Gauge,
  Metric,
  Skelett,
  Tag,
  alterLabel,
  de,
  heuteWien,
  minToHm,
} from "@/components/ui";


/**
 * Die Startseite streamt vollständig.
 *
 * Sie hängt an Google Health (Schlaf, Ruhepuls, HRV, Gewicht) und zusätzlich
 * an der Uhrzeit — der Gruß, der Kalendertag und die Frage, ob heute Training
 * ansteht, folgen alle aus `new Date()`. Beides ist Request-Zeit, also gibt
 * es hier nichts, was sich sinnvoll vorrendern ließe außer dem Gerüst. Genau
 * das steht jetzt sofort, statt dass der vorige Tab stehen bleibt, bis Google
 * geantwortet hat.
 */
export default function Heute() {
  return (
    <Suspense
      fallback={
        <>
          <div className="pt-10 md:pt-14">
            <Skelett hoehe={16} className="w-44" />
            <Skelett hoehe={38} className="mt-3 w-60" />
          </div>
          {/* Dieselbe Gestalt wie die fertige Seite: erst die Heute-Karte,
              darunter Coach und Gewicht — sonst springt alles beim Laden. */}
          <Skelett hoehe={230} className="mt-6" />
          <div className="mt-4 grid items-start gap-4 md:grid-cols-[1.05fr_0.95fr]">
            <Skelett hoehe={170} />
            <div className="flex flex-col gap-3.5">
              <Skelett hoehe={150} />
              <Skelett hoehe={130} />
            </div>
          </div>
        </>
      }
    >
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  /* Gruß, Datum und Rotation lesen alle die aktuelle Uhrzeit. Beim Bauen
     steht die nicht fest, und ein vorgerendertes "Guten Morgen" wäre abends
     falsch. */
  await connection();

  const data = await loadDashboard(30);
  const rotation = await rotationMitPlan(new Date());
  /* Ob heute schon eine Einheit läuft oder lief — dann sagt die Karte das,
     statt zu einer Einheit aufzufordern, die längst erledigt ist. Beiwerk:
     ist die Datenbank kurz weg, steht die Karte eben ohne diesen Zusatz. */
  let schonHeute: { art: "push" | "pull"; beendet: boolean } | null = null;
  try {
    const art = await heutigeEinheit();
    if (art) schonHeute = { art, beendet: (await laufendesTraining(art))?.beendet ?? false };
  } catch (e) {
    console.error("Trainingsstatus nicht lesbar:", e);
  }
  /* Jede Einheit lässt sich an jedem Tag starten. Wer am Rest Day trotzdem
     trainiert, soll darunter keinen Rest-Day-Befund lesen. */
  const trainingHeute = rotation.art === "training" || schonHeute !== null;

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

  const kopf = (
    <header className="flex items-start justify-between gap-4 pt-10 md:pt-14">
      <div className="min-w-0">
        <Eyebrow>
          {heuteDatum} · {phasenText}
        </Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold leading-tight tracking-[-0.025em] md:text-[33px]">
          {gruss()}, Jakob
        </h1>
      </div>
      <EinstellungenLink />
    </header>
  );

  if (!data.verbunden) {
    /* Training hängt nicht an Google — die Karte bleibt auch dann, wenn die
       Verbindung abgelaufen ist. Sonst stünde morgens nach dem wöchentlichen
       Ablauf gar nichts mehr darüber da, was heute ansteht. */
    return (
      <>
        {kopf}
        <div className="mx-auto max-w-[520px]">
          <HeuteKarte
            rotation={rotation}
            schonHeute={schonHeute}
            regeneration={null}
            befund={null}
            veraltet={false}
            heuteIso={heuteIso}
          />
          <VerbindenKarte grund={data.grund} />
        </div>
      </>
    );
  }

  const { heute, baseline, gewicht } = data;

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

  const tagesBriefing =
    heute && baseline
      ? briefing({
          heute,
          baseline,
          urteil: heute.regeneration,
          nachtDatum: heute.date,
          heuteIso,
          trainingHeute,
          stunde: wienerStunde(),
          ausAblage: data.abgelaufen !== undefined,
        })
      : null;

  return (
    <>
      {kopf}

      <InstallHinweis className="mt-6" />
      {data.abgelaufen && <AbgelaufenHinweis lage={data.abgelaufen} className="mt-6" />}

      {/* Die eine Karte, die morgens zählt: wie erholt, was heute ansteht,
          und der Knopf dorthin. Vorher verteilte sich das auf drei Karten
          in zwei Spalten — Regeneration links, Training rechts, das Urteil
          darunter —, und die Frage "was mache ich heute" beantwortete erst
          die dritte. */}
      <HeuteKarte
        rotation={rotation}
        schonHeute={schonHeute}
        regeneration={heute && baseline ? { ...heute.regeneration, datum: heute.date } : null}
        befund={schonHeute?.beendet ? null : (tagesBriefing?.befund ?? null)}
        veraltet={veraltet}
        heuteIso={heuteIso}
      />

      <div className="mt-4 grid items-start gap-4 md:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col gap-3.5">
          {heute && baseline && tagesBriefing ? (
            <Card tone={veraltet ? "warnung" : "normal"}>
              <div className="flex items-start gap-3.5">
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br
                             from-accent to-accent-deep text-xs font-extrabold text-on-accent"
                  aria-hidden
                >
                  K
                </div>
                <div className="min-w-0 flex-1 text-sm leading-relaxed text-fg-dim">
                  <Tagesbriefing briefing={tagesBriefing} />
                </div>
              </div>


              {/* Die vier Werte der Nacht eingeklappt: das Urteil darüber sagt,
                  was sie bedeuten. Wer nachrechnen will, klappt auf. */}
              <details className="group mt-3.5 border-t border-hair-soft pt-1">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between text-[13px] font-semibold text-fg-dim">
                  Werte der Nacht auf {alterLabel(heute.date, heuteIso)}
                  <span aria-hidden className="text-fg-faint transition group-open:rotate-90">›</span>
                </summary>
                {/* Alle vier Zeilen nach demselben Schema eingefärbt: über der
                    Referenz gut, darunter schlecht. */}
                <div className="flex flex-col gap-2.5 pb-1 pt-1">
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
                  <p className="text-[11px] leading-relaxed text-fg-faint">
                    Referenz aus {data.tagesreihe.length} Nächten der Fitbit.
                  </p>
                </div>
              </details>
            </Card>
          ) : (
            <Card>
              <Eyebrow>Regeneration</Eyebrow>
              <p className="mt-2 text-sm leading-relaxed text-fg-dim">
                Noch keine vollständige Nacht mit Ruhepuls und HRV — für die Referenz
                braucht es fünf.
              </p>
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
                <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
                  {korridorUrteil(gewicht.trend.kgPerWeek, heuteIso)}
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

/**
 * Einordnung statt bloßer Zahl — der Korridor allein beantwortet nichts.
 *
 * Die Grenzen standen hier viermal als Text: 0,25 bis 0,50, also immer
 * Zunahme. Seit dem Phasenplan gilt das nur im Aufbau — im Mini-Cut soll das
 * Gewicht fallen, und dieselben Sätze hätten dort das Gegenteil dessen
 * verlangt, was geplant ist. Die Grenzen kommen jetzt aus der laufenden
 * Phase.
 */
function korridorUrteil(kgProWoche: number, heuteIso: string): string {
  const phase = aktuellePhase(heuteIso);
  const { unten, oben } = phase.phase.korridor;
  const spanne = `${de(unten, 2)} bis ${de(oben, 2)} kg pro Woche`;

  if (kgProWoche < unten) {
    return oben > 0
      ? `Unter dem Zielkorridor von ${spanne}. Etwas mehr essen.`
      : `Du nimmst schneller ab als geplant — Zielkorridor im ${phase.phase.label} ist ${spanne}. Etwas mehr essen, sonst geht es an die Muskulatur.`;
  }

  if (kgProWoche > oben) {
    return oben > 0
      ? `Über dem Zielkorridor von ${spanne} — der Überschuss geht ab hier vor allem ins Fett.`
      : `Über dem Zielkorridor von ${spanne}. Im ${phase.phase.label} soll das Gewicht fallen; etwas weniger essen.`;
  }

  return `Im Zielkorridor von ${spanne}. So weiterlaufen lassen.`;
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
      {/* Der Befund steht schon groß in der Heute-Karte; hier folgt, was die
          Nacht dazu sagt. */}
      <p>{briefing.schlaf}</p>

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
          Kein Wert liegt weit daneben. Weiter wie gestern.
        </p>
      )}
    </>
  );
}

/**
 * Die Karte oben auf der Startseite: wie erholt, was heute ansteht, und der
 * Knopf dorthin.
 *
 * Die Freigabe steht als ein Satz unter der Einheit (der "Befund" aus dem
 * Briefing) — das ist die Antwort auf "soll ich heute schwer trainieren",
 * und die gehört neben die Einheit, nicht zwei Karten weiter. Ohne Google
 * steht die Karte trotzdem, nur ohne Ring: Training hängt nicht an der Uhr.
 */
function HeuteKarte({
  rotation,
  schonHeute,
  regeneration,
  befund,
  veraltet,
  heuteIso,
}: {
  rotation: Rotation;
  schonHeute: { art: "push" | "pull"; beendet: boolean } | null;
  regeneration: { score: number; band: "gut" | "mittel" | "schlecht"; datum: string } | null;
  befund: string | null;
  veraltet: boolean;
  heuteIso: string;
}) {
  const name = (e: "push" | "pull") => SESSIONS[e].focus.split(" · ")[0];

  let titel: string;
  let text: string;
  let knopf: string;

  if (schonHeute) {
    titel = schonHeute.beendet ? `${name(schonHeute.art)} erledigt` : `${name(schonHeute.art)} läuft`;
    text = SESSIONS[schonHeute.art].title;
    knopf = schonHeute.beendet ? "Einheit ansehen" : "Weiterloggen";
  } else if (rotation.art === "training") {
    // "Heute" steht schon als Überschrift darüber.
    titel = name(rotation.einheit);
    text = SESSIONS[rotation.einheit].title;
    knopf = "Training öffnen";
  } else {
    titel = "Rest Day";
    text = `Als Nächstes ${name(rotation.naechste)} — ${SESSIONS[rotation.naechste].title}.`;
    knopf = "Plan ansehen";
  }

  return (
    <section className="mt-6 rounded-lg border border-hair bg-gradient-to-b from-surface-2 to-surface p-5">
      <div className="flex items-center gap-5">
        {regeneration && <Gauge score={regeneration.score} band={regeneration.band} />}
        <div className="min-w-0 flex-1">
          <Eyebrow>Heute</Eyebrow>
          <p className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.02em]">{titel}</p>
          <p className="mt-1 text-[13px] leading-snug text-fg-dim">{text}</p>
          {regeneration && (
            <div className="mt-2.5">
              <Tag tone={veraltet ? "warnung" : bandTon(regeneration.band)}>
                {veraltet ? `Nacht auf ${alterLabel(regeneration.datum, heuteIso)}` : bandWort(regeneration.band)}
              </Tag>
            </div>
          )}
        </div>
      </div>

      {befund && <p className="mt-4 text-sm font-medium leading-relaxed text-fg">{befund}</p>}

      <Link
        href="/training"
        className="mt-4 flex min-h-[52px] items-center justify-center rounded-md bg-accent text-base
                   font-semibold text-on-accent transition active:scale-[0.98]"
      >
        {knopf}
      </Link>
    </section>
  );
}

/**
 * Google fehlt oder ist abgelaufen, und es gibt noch nichts in der eigenen
 * Ablage. Eine Karte unter der Heute-Karte statt eines zweiten Seitenkopfs:
 * das Training darüber ist die Hauptsache, und das Zahnrad steht schon oben.
 */
function VerbindenKarte({ grund }: { grund: string }) {
  return (
    <Card className="mt-4">
      <Eyebrow>Google Health</Eyebrow>
      <p className="mt-2 text-sm leading-relaxed text-fg-dim">{grund}</p>
      {/* <a> statt <Link>: der OAuth-Start braucht einen echten Seitenwechsel
          (siehe NichtVerbunden in ui.tsx). */}
      <a
        href="/api/auth/google"
        className="mt-4 flex min-h-[48px] items-center justify-center rounded-md border border-hair
                   text-sm font-semibold text-fg transition active:scale-[0.98]"
      >
        Mit Google verbinden
      </a>
    </Card>
  );
}
