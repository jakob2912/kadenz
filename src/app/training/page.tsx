import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { einheitFuerTag, trainingsplanAls } from "@/lib/uebungen";
import {
  bekannteUebungen,
  bestwerteFuer,
  heutigeEinheit,
  laufendesTraining,
} from "@/lib/training-lesen";
import type { Bestwert } from "@/lib/bestwerte";
import {
  heutigeSaetze,
  offenePlaetze,
  rotationFor,
  type Einheitskopf,
} from "@/lib/plan";
import { kalenderLesen, wochenstand, type Kalender } from "@/lib/wochenplan";
import { WochenplanSchalter } from "@/components/wochenplan-schalter";
import { behauptetesMaximum, type Bankstand } from "@/lib/bank";
import { vorTest } from "@/lib/kraft";
import { TrainingLogger, TrainingStart } from "@/components/training-logger";
import { BankTrainingsmax } from "@/components/bank-trainingsmax";
import { Card, Eyebrow, Skelett, anzahl, de, kurzDatum, uebungsVorschau } from "@/components/ui";
import { wienerDatum } from "@/lib/datum";

// Die Startgewichte hängen an der Trainingshistorie und ändern sich nach
// jedem Satz — hier darf nichts zwischengespeichert werden. Seit dem

type Art = "push" | "pull";

const NAME: Record<Art, string> = { push: "Push", pull: "Pull" };

type Suchparameter = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * Gerüst sofort, Einheit danach.
 *
 * Welche Einheit ansteht, folgt aus dem heutigen Kalendertag — die Seite kann
 * also gar nicht vorgerendert werden, `new Date()` steht beim Bauen noch
 * nicht fest. Vorher hieß das: gar nichts erscheint, bis Katalog, Historie
 * und Bankstand aus der Datenbank da sind. Jetzt steht die Hülle sofort und
 * die Einheit strömt nach.
 */
export default function Training({ searchParams }: { searchParams: Suchparameter }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[520px] pt-10 md:pt-14">
          <Skelett hoehe={16} className="w-32" />
          <Skelett hoehe={36} className="mt-3 w-64" />
          <Skelett hoehe={22} className="mt-4 w-48" />
          <div className="mt-6 flex flex-col gap-3.5">
            <Skelett hoehe={150} />
            <Skelett hoehe={150} />
            <Skelett hoehe={150} />
          </div>
        </div>
      }
    >
      <Einheit searchParams={searchParams} />
    </Suspense>
  );
}

async function Einheit({ searchParams }: { searchParams: Suchparameter }) {
  /* Welche Einheit ansteht, hängt am heutigen Kalendertag. Beim Bauen steht
     der noch nicht fest, und Next lehnt ein `new Date()` im Vorrendern
     ausdrücklich ab — zu Recht: die Seite wäre auf den Build-Tag eingefroren
     und zeigte morgen noch die Einheit von heute. connection() sagt "ab hier
     erst bei einer echten Anfrage" und beendet damit das Vorrendern genau an
     der richtigen Stelle: die Hülle darüber bleibt statisch. */
  await connection();

  const { einheit: gewuenscht } = await searchParams;
  const kalender = await kalenderLesen();
  const rotation = rotationFor(new Date(), kalender.wahlen, kalender.eintraege);
  const lautPlan: Art | null = rotation.art === "training" ? rotation.einheit : null;

  /* Der Kalender schlägt vor, er schreibt nicht vor. Welche Einheit auf dem
     Schirm steht, in dieser Reihenfolge: die ausdrücklich gewählte, sonst die,
     die heute schon läuft oder gelaufen ist — wer "trotzdem Pull" gestartet
     hat und die Seite später über die Navigation öffnet, soll seinen Logger
     sehen —, sonst die laut Kalender. Bleibt nichts übrig, ist Rest Day. */
  let art: Art | null = gewuenscht === "push" || gewuenscht === "pull" ? gewuenscht : null;
  if (art === null) {
    try {
      art = await heutigeEinheit();
    } catch (e) {
      console.error("Trainingsstatus nicht lesbar:", e);
    }
  }
  art ??= lautPlan;

  if (art === null) return <RestDay kalender={kalender} />;

  const plan = await trainingsplanAls(new Date(), art, kalender);
  const kopf: Einheitskopf = { key: plan.einheit, title: plan.titel, focus: plan.fokus };
  const wechsel = (
    <>
      <EinheitWechsel art={art} lautPlan={lautPlan} />
      <WochenplanSchalter stand={await wochenstand()} />
    </>
  );

  /* Der Schlüssel an Start und Logger ist nötig: beim Wechsel über den Link
     bleibt die Seite dieselbe, und ohne ihn behielte React den Zustand der
     vorigen Einheit — die Haken vom Push stünden plötzlich im Pull. */

  // Ist die Datenbank kurz nicht erreichbar, soll man trotzdem loggen können:
  // dann setzt der Logger den Beginn selbst, statt die Seite mit einem Fehler
  // abzuräumen.
  let laufend = null;
  try {
    laufend = await laufendesTraining(art);
  } catch (e) {
    console.error("Trainingsstatus nicht lesbar:", e);
    return (
      <TrainingLogger
        key={art}
        uebungen={plan.uebungen}
        session={kopf}
        startedAtMs={null}
        wechsel={wechsel}
      />
    );
  }

  if (laufend === null) {
    return (
      <TrainingStart
        key={art}
        session={kopf}
        uebungen={plan.uebungen}
        bankKarte={plan.bank ? <BankHinweis bank={plan.bank} /> : null}
        wechsel={wechsel}
      />
    );
  }

  /* Bestwerte sind Beiwerk: fehlen sie, loggt es sich wie bisher, nur ohne
     Markierung. */
  let bestwerte: Record<string, Bestwert> = {};
  try {
    bestwerte = await bestwerteFuer(plan.uebungen.map((u) => u.name));
  } catch (e) {
    console.error("Bestwerte nicht lesbar:", e);
  }

  /* Vorschläge fürs Tauschen — ebenfalls Beiwerk. */
  let bekannte: string[] = [];
  try {
    bekannte = await bekannteUebungen(
      plan.uebungen.flatMap((u) => (u.planName ? [u.name, u.planName] : [u.name]))
    );
  } catch (e) {
    console.error("Übungsnamen nicht lesbar:", e);
  }

  /* Abschluss und bereits geloggte Sätze kommen ausdrücklich mit. Ohne sie
     begann der Logger nach jedem Aufruf wieder bei null Haken, und weil der
     Abschluss allein an diesen Haken hing, lief die Laufzeit weiter, obwohl
     die Einheit längst vorbei war. */
  return (
    <TrainingLogger
      key={art}
      uebungen={plan.uebungen}
      session={kopf}
      startedAtMs={laufend.startedAtMs}
      finishedAtMs={laufend.finishedAtMs}
      geloggt={laufend.geloggt}
      bestwerte={bestwerte}
      notiz={laufend.notiz}
      tag={laufend.tag}
      bekannte={bekannte}
      wechsel={wechsel}
    />
  );
}

/**
 * Die andere Einheit, jederzeit einen Tipp entfernt.
 *
 * Wer am Push-Tag lieber Pull macht — Bank belegt, Brust zieht noch —, soll
 * nicht erst einen Rest Day abwarten müssen. Übungen und Gewichte folgen
 * dabei denselben Regeln wie am planmäßigen Tag, siehe trainingAls().
 */
function EinheitWechsel({ art, lautPlan }: { art: Art; lautPlan: Art | null }) {
  const andere: Art = art === "push" ? "pull" : "push";

  return (
    <p className="mt-6 text-center text-[13px] leading-relaxed text-fg-faint">
      {art !== lautPlan && <>Planned today: {lautPlan ? NAME[lautPlan] : "Rest Day"}. </>}
      <Link
        href={`/training?einheit=${andere}`}
        className="font-semibold text-accent underline underline-offset-2"
      >
        Train {NAME[andere]} instead
      </Link>
    </p>
  );
}

async function RestDay({ kalender }: { kalender: Kalender }) {
  const heute = await einheitFuerTag(new Date(), kalender);
  const offen = offenePlaetze(heuteIso(), kalender.wahlen, kalender.eintraege);
  if (heute.art !== "pause") return null;

  const naechste = heute.naechste;

  /* Die nächste Einheit ist nicht zwingend morgen — zwischen Mi und Fr oder
     Sa liegen Pausentage. Der Text muss das sagen, sonst
     sucht man morgen früh eine Einheit, die erst übermorgen ansteht. */
  const istMorgen = heute.naechsterTag === naechsterKalendertag();

  return (
    <div className="mx-auto max-w-[520px] pt-10 md:pt-14">
      <Eyebrow>Today</Eyebrow>
      <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em]">Rest Day</h1>
      <p className="mt-3 text-sm leading-relaxed text-fg-dim">
        {offen.length > 0
          ? `Still open this week: ${offen
              .map((p) => `${NAME[p.einheit]} ${kurzDatum(p.datum)}`)
              .join(", ")}. `
          : "Nothing left open this week. "}
        {istMorgen ? (
          <>
            Next up tomorrow:{" "}
            <b className="font-semibold text-fg">{naechste.fokus}</b>.
          </>
        ) : (
          <>
            Next up on{" "}
            <b className="font-semibold text-fg">{kurzDatum(heute.naechsterTag)}</b>:{" "}
            <b className="font-semibold text-fg">{naechste.fokus}</b>.
          </>
        )}
      </p>

      {/* Der Rest Day ist ein Vorschlag. Wer heute trotzdem ins Gym geht,
          wählt hier die Einheit statt einen Tag zu warten. */}
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {(["push", "pull"] as const).map((e) => (
          <Link
            key={e}
            href={`/training?einheit=${e}`}
            className="flex min-h-[48px] items-center justify-center rounded-md bg-surface-2
                       text-sm font-semibold text-fg transition active:scale-[0.98] md:hover:bg-surface-3"
          >
            {NAME[e]} anyway
          </Link>
        ))}
      </div>

      {/* Vorher endete die Seite hier. Wer am Rest Day auf "Training" tippt,
          will wissen, was ansteht — nicht nur, dass heute nichts ansteht. */}
      <Card className="mt-5">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow>{istMorgen ? "Tomorrow" : kurzDatum(heute.naechsterTag)}</Eyebrow>
          <span className="text-[11px] text-fg-faint">
            {anzahl(naechste.uebungen.length, "exercise", "exercises")} ·{" "}
            {anzahl(
              naechste.uebungen.reduce((n, e) => n + heutigeSaetze(e).length, 0),
              "set",
              "sets"
            )}
          </span>
        </div>
        <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.015em]">
          {naechste.titel}
        </p>
        <ol className="mt-3.5 flex flex-col gap-2">
          {naechste.uebungen.map((ex, i) => (
            <li key={ex.name} className="flex items-center gap-3">
              <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-sm bg-surface-3 text-[11px] font-bold text-fg-dim">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg-dim">
                {ex.name}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-fg-faint">
                {uebungsVorschau(ex)}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3.5 text-[11px] leading-relaxed text-fg-faint">
          Weights from the last session. Kadenz works out the actual target weight on
          the day from your reps.
        </p>
      </Card>

      {naechste.bank && (
        <BankHinweis
          bank={naechste.bank}
          wann={istMorgen ? "Tomorrow" : kurzDatum(heute.naechsterTag)}
        />
      )}

      <WochenplanSchalter stand={await wochenstand()} />
    </div>
  );
}

/**
 * Wo das Bankdrücken gerade steht.
 *
 * Fünf Zustände, und alle sind eine Auskunft wert: Testtag, kein Trainingsmax
 * (dann steht hier die Eingabe), leichter Tag (mit schwerem Single, ohne Wirkung
 * auf den Trainingsmax), gar keine Bankeinheit (Deload-Zwischentag), oder der
 * TM-Tag mit Zyklus und Woche. Die Karte wegzulassen, weil heute nichts
 * ansteht, hieße jedes Mal neu nachzurechnen, wann wieder.
 */
function BankHinweis({ bank, wann = "Today" }: { bank: Bankstand; wann?: string }): ReactNode {

  if (bank.tm === null) {
    return <BankTrainingsmax aktuellerTm={null} zyklus={bank.position.zyklus} />;
  }

  if (bank.position.art === "test") {
    return (
      <Card className="mt-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow>Bench press · Test day</Eyebrow>
          <span className="text-[11px] text-fg-faint">Cycle {bank.position.zyklus}</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
          {wann}: real test. Warm up, then singles up to the first grinder. Only take the
          next attempt if the previous one moved cleanly. Hips stay on the bench.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
          The test replaces the deload wave and doesn’t move the training max (
          {de(bank.tm.tmKg, 1)} kg, implying about {de(behauptetesMaximum(bank.tm.tmKg), 1)} kg).
          If your best single is clearly lower, reset the training max.
        </p>
      </Card>
    );
  }

  if (bank.position.art !== "tm") {
    const zusatz = bank.position.art === "zusatz";
    return (
      <Card className="mt-3.5">
        <Eyebrow>Bench press · {zusatz ? "Light day" : "5/3/1"}</Eyebrow>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
          {zusatz ? (
            <>
              {wann}: no TM day. Bench runs light — three sets of five with reps in reserve
              {vorTest(bank.position) ? (
                <>, no single: the next bench day is a test.</>
              ) : (
                <>
                  , then one <b className="font-semibold text-fg">heavy single</b>. It doesn’t
                  affect the training max and isn’t evaluated.
                </>
              )}
            </>
          ) : (
            <>
              {wann}: no bench. The light day is skipped in deload week — the week is for
              backing off.
            </>
          )}
          {bank.naechsterBankTag && (
            <> Next TM day: {kurzDatum(bank.naechsterBankTag)}.</>
          )}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
          Training max {de(bank.tm.tmKg, 1)} kg · Cycle {bank.position.zyklus}, week{" "}
          {bank.position.woche}
        </p>
      </Card>
    );
  }

  const wochenText =
    bank.position.woche === 4
      ? "Deload — deliberately light. This week is not for pushing limits."
      : `The last set is for max reps. Kadenz uses it to set the training max for cycle ${bank.position.zyklus + 1}.`;

  return (
    <Card className="mt-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Bench press · 5/3/1</Eyebrow>
        <span className="text-[11px] text-fg-faint">
          Cycle {bank.position.zyklus} · Week {bank.position.woche}
        </span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">{wochenText}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
        Training max {de(bank.tm.tmKg, 1)} kg — that means a max of about{" "}
        {de(behauptetesMaximum(bank.tm.tmKg), 1)} kg. {bank.tm.begruendung}
      </p>
    </Card>
  );
}

function heuteIso(): string {
  return wienerDatum(new Date());
}

/** Der morgige Kalendertag in Wiener Zeit, ISO. */
function naechsterKalendertag(): string {
  const heute = Date.parse(`${wienerDatum(new Date())}T00:00:00Z`);
  return new Date(heute + 864e5).toISOString().slice(0, 10);
}
