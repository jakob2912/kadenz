"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trainingsmaxEintragen } from "@/lib/bank-actions";
import { Card, Eyebrow, de } from "@/components/ui";

/**
 * Der einmalige Einstieg ins 5/3/1.
 *
 * Kadenz schätzt den Trainingsmax nicht: Langhantel-Bankdrücken stand nie in
 * Jakobs Split, es gibt keinen einzigen geloggten Satz. Ein geratener Wert
 * wäre die Grundlage sämtlicher Prozente des Programms — und ein zu hoher
 * fällt erst in Woche 3 auf, unter der Hantel.
 *
 * Eingegeben wird das Maximum, nicht der Trainingsmax: "was schaffst du
 * einmal" ist eine Frage, die man beantworten kann. Die 90 % rechnet die
 * Komponente daraus und zeigt beide Zahlen, damit nachvollziehbar bleibt,
 * womit das Programm arbeitet.
 */
export function BankTrainingsmax({
  aktuellerTm,
  zyklus,
}: {
  aktuellerTm: number | null;
  zyklus: number;
}) {
  const router = useRouter();
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  const [laeuft, starte] = useTransition();

  const maximum = Number(eingabe.replace(",", "."));
  const gueltig = Number.isFinite(maximum) && maximum > 0;
  const tm = gueltig ? Math.round((maximum * 0.9) / 2.5) * 2.5 : null;

  function speichern() {
    if (tm === null) {
      setFehler("Trag ein, was du beim Bankdrücken einmal sicher schaffst.");
      return;
    }
    setFehler(null);
    starte(async () => {
      const r = await trainingsmaxEintragen(
        tm,
        `Aus einem Maximum von ${de(maximum, 1)} kg, von Jakob eingetragen.`
      );
      if (r.ok) {
        setGespeichert(true);
        router.refresh();
      } else {
        setFehler(r.fehler);
      }
    });
  }

  return (
    <Card className="mt-3.5">
      <Eyebrow>Bankdrücken · 5/3/1</Eyebrow>

      {aktuellerTm === null ? (
        <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
          Bevor das Programm rechnen kann, braucht es einen Trainingsmax. Der ist nicht dein
          Tagesrekord, sondern 90 % davon — mit dem Puffer bleiben auch die schweren Wochen
          machbar.
        </p>
      ) : (
        <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
          Aktuell {de(aktuellerTm, 1)} kg in Zyklus {zyklus}. Korrigier ihn hier, wenn er
          nicht mehr passt.
        </p>
      )}

      <label className="mt-3.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
        Was schaffst du einmal?
        <div className="mt-2 flex gap-2">
          <input
            inputMode="decimal"
            value={eingabe}
            onChange={(e) => {
              setEingabe(e.target.value);
              setFehler(null);
              setGespeichert(false);
            }}
            placeholder="z. B. 100"
            aria-label="Maximum beim Bankdrücken in Kilogramm"
            className="num min-h-[48px] w-full rounded-sm border border-hair bg-surface-2 px-3
                       text-base text-fg outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={speichern}
            disabled={laeuft || !gueltig}
            className="min-h-[48px] shrink-0 rounded-sm bg-accent px-4 text-sm font-semibold
                       text-on-accent transition active:scale-[0.98] disabled:opacity-50"
          >
            {laeuft ? "…" : "Übernehmen"}
          </button>
        </div>
      </label>

      {tm !== null && (
        <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
          Trainingsmax daraus: <b className="font-semibold text-fg-dim">{de(tm, 1)} kg</b>. Mit
          dem rechnet das Programm alle Prozente.
        </p>
      )}

      {fehler && (
        <p className="mt-2 text-[11px] leading-relaxed text-strain" role="alert">
          {fehler}
        </p>
      )}

      {gespeichert && !fehler && (
        <p className="mt-2 text-[11px] leading-relaxed text-fg-faint" role="status">
          Gespeichert. Die Sätze stehen gleich darüber.
        </p>
      )}
    </Card>
  );
}
