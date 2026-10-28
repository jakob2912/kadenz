import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import {
  bankuebersicht,
  type Bankeinheit,
  type EchterPr,
  type Wochenvorschau,
} from "@/lib/bankuebersicht";
import { behauptetesMaximum, type Trainingsmax } from "@/lib/bank";
import {
  SINGLE_PROZENT,
  TEST_ALLE_ZYKLEN,
  DELOAD_AB_TM_KG,
  ZUSATZ_PROZENT,
  bankZusatzPlan,
} from "@/lib/kraft";
import { ZIEL_DATUM, ZIEL_KG, ZIEL_TM_KG, zielSatz, type Zielstand } from "@/lib/bankziel";
import type { Bankcoach, Prognose } from "@/lib/bankcoach";
import { BankTrainingsmax } from "@/components/bank-trainingsmax";
import { ReihenChart } from "@/components/reihen-chart";
import { VerlaufUmschalter } from "@/components/verlauf-umschalter";
import { Card, Eyebrow, Skelett, Tag, anzahl, de, kurzDatum, langDatum } from "@/components/ui";

/**
 * Bankdrücken, seit der Vier-Tab-Leiste die zweite Ansicht unter Verlauf.
 *
 * Getrennt vom Verlauf, obwohl es dort längst eine Seite je Übung gibt
 * (/verlauf/[uebung]). Der Unterschied ist nicht die Übung, sondern die Frage:
 * /verlauf beantwortet "wie läuft diese Übung", hier steht ein Programm mit
 * Zyklus, Woche, Trainingsmax und einem Ziel mit Datum. Eine Vorschau auf die
 * nächste Programmwoche hat auf einer generischen Verlaufsseite nichts
 * verloren.
 *
 * Die Hülle ist vorgerendert, alles Datengebundene strömt nach — dasselbe
 * Muster wie auf den übrigen Seiten.
 */
export default function Bank() {
  return (
    <div className="mx-auto max-w-[520px] md:max-w-[1180px]">
      <VerlaufUmschalter aktiv="bank" />
      <header className="pt-6 md:pt-8">
        <Eyebrow>Bench press</Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em] md:text-[33px]">
          5/3/1 with a light day
        </h1>
      </header>

      <Suspense
        fallback={
          <div className="mt-7 flex flex-col gap-3.5">
            <Skelett hoehe={150} />
            <Skelett hoehe={210} />
            <Skelett hoehe={260} />
          </div>
        }
      >
        <Inhalt />
      </Suspense>
    </div>
  );
}

async function Inhalt() {
  /* Welcher Push-Tag als nächstes kommt, folgt aus dem heutigen Kalendertag.
     Beim Bauen steht der nicht fest — dieselbe Grenze wie auf /training. */
  await connection();

  let daten;
  try {
    daten = await bankuebersicht();
  } catch (e) {
    console.error("Bankübersicht nicht lesbar:", e);
    return (
      <Card className="mt-7">
        <p className="text-sm leading-relaxed text-fg-dim">
          The bench data can’t be read right now. Try again in a moment — everything you
          logged is still saved.
        </p>
      </Card>
    );
  }

  if (daten.tm === null) {
    return (
      <>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-fg-dim">
          The program isn’t running yet. Barbell bench press has no history in Kadenz
          to estimate a training max from — it is the basis of every percentage and is
          entered once.
        </p>
        <BankTrainingsmax aktuellerTm={null} zyklus={1} />
      </>
    );
  }

  return (
    <div className="mt-7 grid items-start gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-3.5">
        <Stand
          tm={daten.tm}
          zyklus={daten.stand?.position.zyklus ?? daten.tm.zyklus}
          woche={daten.stand?.position.woche ?? 1}
          wochen={daten.stand?.position.wochen ?? 4}
        />
        <Vorschau wochen={daten.vorschau} standTag={daten.standTag} />
        <TmHistorie historie={daten.historie} />
      </div>

      <div className="flex flex-col gap-3.5">
        <Pr pr={daten.pr} naechsterTest={daten.naechsterTest} schaetzung={daten.schaetzung} />
        {daten.coach && <Coach coach={daten.coach} prognose={daten.prognose} />}
        {daten.ziel && <Ziel stand={daten.ziel} />}
        <Ablauf tmKg={daten.tm.tmKg} />
        <Verlauf einheiten={daten.einheiten} />
      </div>
    </div>
  );
}

/** Wo der Zyklus steht. */
function Stand({
  tm,
  zyklus,
  woche,
  wochen,
}: {
  tm: Trainingsmax;
  zyklus: number;
  woche: number;
  wochen: number;
}) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Current status</Eyebrow>
        <span className="text-[11px] tabular-nums text-fg-faint">
          Cycle {zyklus} · Week {woche} of {wochen}
        </span>
      </div>

      <p className="mt-2 text-[27px] font-bold leading-none tracking-[-0.03em]">
        {de(tm.tmKg, 1)} kg
      </p>
      <p className="mt-1.5 text-[13px] text-fg-dim">
        Training max — that means a max of about{" "}
        <b className="font-semibold text-fg">{de(behauptetesMaximum(tm.tmKg), 1)} kg</b>.
      </p>

      {/* Ein Balken je Programmwoche — drei, solange der Zyklus ohne Deload
          läuft. Die Deload-Woche ist auch dann eingefärbt, wenn sie nicht die
          laufende ist: dass sie leicht ist, ist ihr Zweck und keine Lücke im
          Plan. */}
      <div className="mt-3.5 flex gap-1.5" aria-hidden>
        {Array.from({ length: wochen }, (_, i) => i + 1).map((w) => (
          <div
            key={w}
            className={`h-1.5 flex-1 rounded-full ${
              w === woche ? "bg-accent" : w === 4 ? "bg-caution/30" : "bg-surface-3"
            }`}
          />
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
        {/* kurzDatum endet auf "Okt." — ein weiterer Punkt dahinter wäre doppelt. */}
        Valid since {kurzDatum(tm.gueltigAb)}. {tm.begruendung}
      </p>
    </Card>
  );
}

/** Was das Programm als nächstes vorgibt. */
function Vorschau({ wochen, standTag }: { wochen: Wochenvorschau[]; standTag: string }) {
  if (wochen.length === 0) return null;

  return (
    <Card>
      <Eyebrow>Scheduled</Eyebrow>
      <div className="mt-3 flex flex-col gap-4">
        {wochen.map((w, i) => (
          <div key={`${w.zyklus}-${w.woche}`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-semibold tracking-[-0.015em]">
                {i === 0 && w.datum === standTag ? "Next session" : kurzDatum(w.datum)}
                <span className="ml-2 font-normal text-fg-faint">
                  Cycle {w.zyklus} · Week {w.woche}
                </span>
              </p>
              {w.deload && <Tag tone="warnung">Deload</Tag>}
              {w.test && <Tag tone="akzent">Testtag</Tag>}
            </div>

            <ol className="mt-2 flex flex-col gap-1">
              {w.saetze.map((s, si) => (
                <li
                  key={si}
                  className="flex items-center gap-3 text-[13px] tabular-nums text-fg-dim"
                >
                  <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-sm bg-surface-3 text-[11px] font-bold text-fg-faint">
                    {si + 1}
                  </span>
                  <span className="font-semibold text-fg">{de(s.kg, 1)} kg</span>
                  <span>
                    × {s.wdh}
                    {s.amrap && "+"}
                    {w.test && si >= w.saetze.length - 3 && (
                      <span className="ml-1.5 text-fg-faint">Versuch {si - w.saetze.length + 4}</span>
                    )}
                  </span>
                  <span className="ml-auto text-[11px] text-fg-faint">
                    {de(s.prozent, 0)} %
                  </span>
                </li>
              ))}
            </ol>

            {/* Ohne diesen Hinweis ist das "+" hinter der Zahl bloß ein
                Zeichen. Der AMRAP-Satz ist das Messinstrument des Programms. */}
            <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
              {w.test
                ? "Warm up, then singles. Only take the next attempt if the previous one moved cleanly — stop at the first grinder."
                : w.deload
                  ? "Deliberately light, no max-rep set. This week is for backing off."
                  : "The last set is for max reps — Kadenz uses it to set the next training max."}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Wie der Trainingsmax dahin gekommen ist, wo er steht. */
function TmHistorie({ historie }: { historie: Trainingsmax[] }) {
  if (historie.length <= 1) return null;

  return (
    <Card>
      <Eyebrow>Training max history</Eyebrow>
      <ol className="mt-3 flex flex-col gap-2.5">
        {historie.map((h, i) => {
          /* Die Liste läuft absteigend, der Vorgänger steht also EINEN Platz
             weiter hinten. Das Delta gegen die Zeile davor zu rechnen wäre der
             Zuwachs des nächsten Zyklus, nicht dieses. */
          const vorher = historie[i + 1];
          const delta = vorher ? h.tmKg - vorher.tmKg : null;

          return (
            <li key={h.zyklus} className="flex items-baseline gap-3">
              <span className="w-[54px] shrink-0 text-[11px] text-fg-faint">
                Cycle {h.zyklus}
              </span>
              <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                {de(h.tmKg, 1)} kg
              </span>
              {delta !== null && delta !== 0 && (
                <span
                  className={`shrink-0 text-[11px] tabular-nums ${
                    delta > 0 ? "text-ready" : "text-strain"
                  }`}
                >
                  {delta > 0 ? "+" : "−"}
                  {de(Math.abs(delta), 1)}
                </span>
              )}
              <span className="ml-auto shrink-0 text-[11px] text-fg-faint">
                {kurzDatum(h.gueltigAb)}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/**
 * Der echte Bestwert: der schwerste saubere Single — oder, wenn höher, der
 * von Jakob eingetragene PR (echterPrAus() in bankuebersicht.ts). Kein
 * geschätztes Maximum.
 * Daneben, wann wieder getestet wird.
 */
function Pr({
  pr,
  naechsterTest,
  schaetzung,
}: {
  pr: EchterPr | null;
  naechsterTest: string | null;
  schaetzung: number | null;
}) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>True PR</Eyebrow>
        {naechsterTest && (
          <span className="text-[11px] text-fg-faint">
            Next test {kurzDatum(naechsterTest)}
          </span>
        )}
      </div>

      {pr ? (
        <>
          <p className="mt-2 text-[27px] font-bold leading-none tracking-[-0.03em]">
            {de(pr.kg, 1)} kg
          </p>
          <p className="mt-1.5 text-[13px] text-fg-dim">
            {pr.quelle === "geloggt"
              ? `Heaviest clean single, on ${kurzDatum(pr.datum)}.`
              : `Best from ${kurzDatum(pr.datum)} · entered by you. A heavier logged single replaces it.`}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
          No clean single logged yet.
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
        Tested every {TEST_ALLE_ZYKLEN} cycles, on the TM day of the deload week.
        {schaetzung !== null && (
          <>
            {" "}
            Estimated max from recent weeks: {de(schaetzung, 1)} kg — that’s where the first
            attempt starts.
          </>
        )}
      </p>
    </Card>
  );
}

const LAGE_TEXT: Record<
  Bankcoach["lage"],
  { label: string; tone: "akzent" | "warnung" | "gut" | "schlecht" }
> = {
  laeuft: { label: "Rising", tone: "gut" },
  steht: { label: "Stalling", tone: "warnung" },
  faellt: { label: "Going down", tone: "schlecht" },
  unklar: { label: "Too little data", tone: "akzent" },
};

/**
 * Läuft es an den schweren Tagen — und was tun, wenn nicht. Darunter die
 * Hochrechnung auf 140 kg aus dem gemessenen Tempo, als Gegenstück zur
 * Treppe in der Zielkarte, die den Bestfall zeigt.
 */
function Coach({ coach, prognose }: { coach: Bankcoach; prognose: Prognose | null }) {
  const lage = LAGE_TEXT[coach.lage];
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Coach · heavy days</Eyebrow>
        <Tag tone={lage.tone}>{lage.label}</Tag>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">{coach.vorschlag.text}</p>
      {prognose && (
        <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
          {prognose.verwertbar ? prognose.text : prognose.grund}
        </p>
      )}
    </Card>
  );
}

/**
 * Der Weg zu 140 kg — als Treppe, nicht als Gerade.
 *
 * Gezeichnet wird der Trainingsmax, nicht das gemessene Maximum. Der
 * Trainingsmax ist die Zahl, an der das Programm tatsächlich dreht, und nur
 * er bewegt sich in den 2,5-kg-Stufen, um die es hier geht. Die gemessenen
 * Werte stehen im Verlauf darunter.
 */
function Ziel({ stand }: { stand: Zielstand }) {
  const anteil = Math.min(100, Math.round((stand.tmKg / ZIEL_TM_KG) * 100));

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Ziel · {ZIEL_KG} kg sauber</Eyebrow>
        {/* langDatum und nicht kurzDatum: "bis Fr., 31. Dez." stand ohne
            Jahreszahl da und las sich wie dieses Jahr. Gemeint ist Ende 2027. */}
        <span className="text-[11px] text-fg-faint">bis {langDatum(ZIEL_DATUM)}</span>
      </div>

      <p className="mt-2 text-[27px] font-bold leading-none tracking-[-0.03em]">
        {de(stand.tmKg, 1)}{" "}
        <span className="text-[15px] font-semibold text-fg-faint">
          of {de(ZIEL_TM_KG, 1)} kg training max
        </span>
      </p>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className="h-full rounded-full bg-accent" style={{ width: `${anteil}%` }} />
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-fg-dim">{zielSatz(stand)}</p>

      <div className="mt-4">
        <ReihenChart
          reihe={stand.kurve.map((p) => ({ datum: p.datum, wert: p.tmKg }))}
          bezeichnung="Expected training max curve"
          einheit="kg"
          /* Großzügig, weil zwischen zwei Punkten 24 Tage liegen — das ist der
             Zyklus und keine Messlücke. Beim Vorgabewert von drei Tagen
             zerfiele die Treppe in lauter Einzelpunkte. */
          lueckeTage={40}
          leer="No training max yet."
          einzeln="Goal reached."
        />
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
        The steps are the best case: every cycle succeeds, none stalls. If a max-rep set
        misses its target, the program resets the training max — that is planned for and
        shifts the curve to the right.
      </p>
    </Card>
  );
}

/**
 * Wie sich die Bankeinheiten abwechseln — mit den Gewichten des leichten
 * Tags. Die des TM-Tags stehen satzweise in der Vorschau.
 */
function Ablauf({ tmKg }: { tmKg: number }) {
  const leicht = bankZusatzPlan(tmKg);
  const fuenfer = leicht[0];
  const single = leicht[leicht.length - 1];

  return (
    <Card>
      <Eyebrow>How it alternates</Eyebrow>

      <div className="mt-3 flex flex-col gap-3.5">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[15px] font-semibold tracking-[-0.015em]">TM-Tag</span>
            <Tag tone="akzent">AMRAP</Tag>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-dim">
            Every second push session. Three sets following the wave, the last one for
            max reps — only that set in week 3 moves the training max.
          </p>
        </div>

        <div className="border-t border-hair-soft pt-3.5">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[15px] font-semibold tracking-[-0.015em]">Light day</span>
            <Tag tone="gut">+ Single</Tag>
          </div>
          <p className="mt-1.5 text-[13px] tabular-nums text-fg">
            3 × {fuenfer.wdh} at {de(fuenfer.kg, 1)} kg
            <span className="text-fg-faint"> · {de(ZUSATZ_PROZENT, 1)} %</span>, dann 1 ×{" "}
            {de(single.kg, 1)} kg
            <span className="text-fg-faint"> · {de(SINGLE_PROZENT, 0)} %</span>
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-dim">
            The push session in between. The single is one clean, fast rep — no grinder
            and no second one. Doesn’t count toward the training max. The day is skipped in
            deload week — deload only exists from {DELOAD_AB_TM_KG} kg training max;
            below that a cycle lasts three weeks.
          </p>
        </div>

        <div className="border-t border-hair-soft pt-3.5">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[15px] font-semibold tracking-[-0.015em]">Test day</span>
            <Tag tone="warnung">1RM</Tag>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-dim">
            Every {TEST_ALLE_ZYKLEN} cycles the TM day of the deload week becomes a max attempt.
            The light day before it runs without a single. Doesn’t move the training max.
          </p>
        </div>

        <p className="border-t border-hair-soft pt-3.5 text-[11px] leading-relaxed text-fg-faint">
          No bench on pull days.
        </p>
      </div>
    </Card>
  );
}

/** Alle Bankeinheiten chronologisch. */
function Verlauf({ einheiten }: { einheiten: Bankeinheit[] }) {
  if (einheiten.length === 0) {
    return (
      <Card>
        <Eyebrow>History</Eyebrow>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
          No bench session logged yet. As soon as the first set is in, the timeline
          starts here.
        </p>
      </Card>
    );
  }

  const unsauberDabei = einheiten.some((e) => e.unsauber);

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>History</Eyebrow>
        <span className="text-[11px] text-fg-faint">
          {anzahl(einheiten.length, "session", "sessions")}
        </span>
      </div>

      <ol className="mt-3 flex flex-col gap-3">
        {einheiten.map((e) => (
          <li
            key={e.datum}
            className="border-t border-hair-soft pt-3 first:border-0 first:pt-0"
          >
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="text-[13px] font-semibold tracking-[-0.015em]">
                {kurzDatum(e.datum)}
              </span>
              {e.unsauber && <Tag tone="schlecht">nicht sauber</Tag>}
              {e.e1rm !== null && (
                <span className="ml-auto text-[11px] tabular-nums text-fg-faint">
                  e1RM {de(e.e1rm, 1)} kg
                </span>
              )}
            </div>

            <p className="mt-1.5 text-[13px] tabular-nums text-fg-dim">
              {e.saetze
                .map((s) => `${de(s.kg, 1)} × ${s.reps}${s.sauber === false ? "*" : ""}`)
                .join("   ")}
            </p>
          </li>
        ))}
      </ol>

      {/* Die Fußnote nur, wenn es tatsächlich einen Stern gibt — sonst erklärt
          sie ein Zeichen, das nirgends steht. */}
      {unsauberDabei && (
        <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
          An asterisk marks a set whose form didn’t hold. Those sets stay visible but
          count neither toward the estimated max nor toward the training max
          progression.
        </p>
      )}

      <Link
        href="/verlauf/Bankdr%C3%BCcken"
        className="mt-3.5 inline-flex min-h-[36px] items-center text-[13px] font-semibold text-accent md:hover:underline"
      >
        Bench press strength trend →
      </Link>
    </Card>
  );
}
