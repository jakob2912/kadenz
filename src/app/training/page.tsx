import type { ReactNode } from "react";
import { einheitFuerTag } from "@/lib/uebungen";
import { laufendesTraining } from "@/lib/workouts";
import { heutigeSaetze, type Einheitskopf } from "@/lib/plan";
import { behauptetesMaximum, type Bankstand } from "@/lib/bank";
import { TrainingLogger, TrainingStart } from "@/components/training-logger";
import { BankTrainingsmax } from "@/components/bank-trainingsmax";
import { Card, Eyebrow, de, kurzDatum, uebungsVorschau } from "@/components/ui";

// Die Startgewichte hängen an der Trainingshistorie und ändern sich nach
// jedem Satz — hier darf nichts zwischengespeichert werden. Seit dem
// Übungskatalog kommt auch die Übungsliste selbst aus der Datenbank.
export const dynamic = "force-dynamic";

export default async function Training() {
  const heute = await einheitFuerTag(new Date());

  if (heute.art === "pause") {
    const naechste = heute.naechste;
    return (
      <div className="mx-auto max-w-[520px] pt-10 md:pt-14">
        <Eyebrow>Heute</Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em]">Rest Day</h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-dim">
          Deine Rotation ist Push – Pull – Rest Day. Nach einem Rest Day folgt immer Push,
          morgen also <b className="font-semibold text-fg">{naechste.fokus}</b>.
        </p>

        {/* Vorher endete die Seite hier. Wer am Rest Day auf "Training" tippt,
            will wissen, was ansteht — nicht nur, dass heute nichts ansteht. */}
        <Card className="mt-5">
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow>Morgen</Eyebrow>
            <span className="text-[11px] text-fg-faint">
              {naechste.uebungen.length} Übungen ·{" "}
              {naechste.uebungen.reduce((n, e) => n + heutigeSaetze(e).length, 0)} Sätze
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
            Gewichte aus der letzten Ausführung. Das tatsächliche Zielgewicht rechnet
            Kadenz morgen aus deinen Wiederholungen.
          </p>
        </Card>

        {naechste.bank && <BankHinweis bank={naechste.bank} morgen />}
      </div>
    );
  }

  const kopf: Einheitskopf = { key: heute.einheit, title: heute.titel, focus: heute.fokus };

  // Ist die Datenbank kurz nicht erreichbar, soll man trotzdem loggen können:
  // dann gilt "jetzt" als Beginn, statt die Seite mit einem Fehler abzuräumen.
  let laufend = null;
  try {
    laufend = await laufendesTraining(heute.einheit);
  } catch (e) {
    console.error("Trainingsstatus nicht lesbar:", e);
    return (
      <TrainingLogger uebungen={heute.uebungen} session={kopf} startedAtMs={Date.now()} />
    );
  }

  if (laufend === null) {
    return (
      <TrainingStart
        session={kopf}
        uebungen={heute.uebungen}
        bankKarte={heute.bank ? <BankHinweis bank={heute.bank} /> : null}
      />
    );
  }

  return (
    <TrainingLogger
      uebungen={heute.uebungen}
      session={kopf}
      startedAtMs={laufend.startedAtMs}
    />
  );
}

/**
 * Wo das Bankdrücken gerade steht.
 *
 * Drei Zustände, und alle drei sind eine Auskunft wert: kein Trainingsmax
 * (dann steht hier die Eingabe), heute kein Bank-Tag (dann wann der nächste
 * ist), oder Bank-Tag mit Zyklus und Woche. Die Karte wegzulassen, weil
 * heute nichts ansteht, hieße jedes Mal neu nachzurechnen, wann wieder.
 */
function BankHinweis({ bank, morgen = false }: { bank: Bankstand; morgen?: boolean }): ReactNode {
  const wann = morgen ? "Morgen" : "Heute";

  if (bank.tm === null) {
    return <BankTrainingsmax aktuellerTm={null} zyklus={bank.position.zyklus} />;
  }

  if (!bank.position.istBankTag) {
    return (
      <Card className="mt-3.5">
        <Eyebrow>Bankdrücken · 5/3/1</Eyebrow>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
          {wann} kein Bank-Tag. Schwer gebankt wird jede zweite Push-Einheit, also alle sechs
          Tage — dazwischen wäre die Erholung für schwere Sätze zu knapp.
          {bank.naechsterBankTag && (
            <> Der nächste ist am {kurzDatum(bank.naechsterBankTag)}.</>
          )}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
          Trainingsmax {de(bank.tm.tmKg, 1)} kg · Zyklus {bank.position.zyklus}, Woche{" "}
          {bank.position.woche}
        </p>
      </Card>
    );
  }

  const wochenText =
    bank.position.woche === 4
      ? "Deload — bewusst leicht. Die Woche ist nicht zum Ausreizen da."
      : `Der letzte Satz geht auf Maximalwiederholungen. Aus ihm rechnet Kadenz den Trainingsmax für Zyklus ${bank.position.zyklus + 1}.`;

  return (
    <Card className="mt-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Bankdrücken · 5/3/1</Eyebrow>
        <span className="text-[11px] text-fg-faint">
          Zyklus {bank.position.zyklus} · Woche {bank.position.woche}
        </span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">{wochenText}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
        Trainingsmax {de(bank.tm.tmKg, 1)} kg — das entspricht einem Maximum von rund{" "}
        {de(behauptetesMaximum(bank.tm.tmKg), 1)} kg. {bank.tm.begruendung}
      </p>
    </Card>
  );
}
