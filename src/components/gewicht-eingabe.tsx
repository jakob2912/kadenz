"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { gewichtEintragen } from "@/lib/gewicht-actions";
import { Card, Eyebrow, de } from "@/components/ui";

/**
 * Morgengewicht eintragen. Wird nüchtern direkt nach dem Wiegen bedient,
 * also mit einer Hand und halb wachen Augen — daher große Tasten und ein
 * Startwert, der schon nah am Ergebnis liegt.
 */

/** Grob für Wasserschwankungen, fein für die tatsächliche Waagen-Nachkommastelle. */
const SCHRITTE = [-0.5, -0.1, -0.05, 0.05, 0.1, 0.5];

const MIN_KG = 30;
const MAX_KG = 250;

/** Nur relevant, solange Google Health noch keinen einzigen Wert geliefert hat. */
const ERSATZ_START = 80;

type Status =
  | { art: "ruhe" }
  | { art: "erfolg"; kg: number }
  | { art: "fehler"; text: string };

export function GewichtEingabe({
  aktuell,
  datum,
  schnitt7,
}: {
  aktuell: number | null;
  datum: string | null;
  schnitt7: number | null;
}) {
  const [wert, setWert] = useState(() => de(aktuell ?? ERSATZ_START, 2));
  const [status, setStatus] = useState<Status>({ art: "ruhe" });
  const [laeuft, starte] = useTransition();
  const reduce = useReducedMotion();

  const zahl = zuZahl(wert);
  const gueltig = zahl !== null && zahl >= MIN_KG && zahl <= MAX_KG;

  function schritt(delta: number) {
    setWert(de(begrenze((zahl ?? aktuell ?? ERSATZ_START) + delta), 2));
    // Eine geänderte Zahl macht die letzte Rückmeldung ungültig.
    setStatus({ art: "ruhe" });
  }

  function eintragen() {
    if (!gueltig) {
      setStatus({
        art: "fehler",
        text: `Bitte einen Wert zwischen ${MIN_KG} und ${MAX_KG} kg eintragen.`,
      });
      return;
    }

    // Innerhalb einer Transition, weil die Action revalidiert: die neu
    // gerenderte Seite kommt in derselben Antwort zurück und wird so sauber
    // übernommen, statt zu flackern.
    starte(async () => {
      const r = await gewichtEintragen(zahl);
      // Der eingegebene Wert bleibt in jedem Fall stehen. Schlägt die
      // Übertragung fehl, soll Jakob nur nochmal tippen müssen, nicht die
      // Waage nochmal suchen.
      setStatus(r.ok ? { art: "erfolg", kg: r.kg } : { art: "fehler", text: r.fehler });
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Morgengewicht · nüchtern</Eyebrow>
        <span className="text-[11px] text-fg-faint">{datum ?? "kein Wert"}</span>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <input
          type="text"
          inputMode="decimal"
          aria-label="Gewicht in Kilogramm"
          value={wert}
          onChange={(e) => {
            // Nur Ziffern, Komma und Punkt — sonst kommen über die
            // Zehnertastatur des iPhone Zeichen rein, die niemand auswerten kann.
            setWert(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 6));
            setStatus({ art: "ruhe" });
          }}
          className="num w-[3.6em] bg-transparent text-[44px] text-fg caret-accent outline-none"
        />
        <em className="text-[17px] font-semibold not-italic text-fg-faint">kg</em>
      </div>

      {aktuell === null && (
        // Ohne diesen Hinweis sieht der Ersatzwert aus wie ein Messwert.
        <p className="mt-1.5 text-[11px] text-fg-faint">
          Noch kein Wert aus Google Health — Startwert selbst setzen.
        </p>
      )}

      {/* Zwei Reihen à drei statt einer Reihe à sechs: bei sechs Spalten bleiben
          auf einem 360px-Handy nur ~42px Tastenbreite übrig, so sind es ~90px. */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {SCHRITTE.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => schritt(s)}
            aria-label={`${s > 0 ? "Plus" : "Minus"} ${schrittLabel(s)} Kilogramm`}
            className="min-h-[46px] rounded-xl border border-hair-soft bg-surface-3 text-[13px]
                       font-semibold tabular-nums text-fg-dim transition
                       hover:border-accent/35 hover:text-accent active:scale-95"
          >
            {s > 0 ? "+" : "−"}
            {schrittLabel(s)}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={eintragen}
        disabled={laeuft}
        className="mt-3 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-accent
                   font-semibold text-on-accent transition active:scale-[0.98]
                   disabled:opacity-55"
      >
        {laeuft ? "Wird übertragen…" : "Eintragen"}
      </button>

      <p className="mt-3 text-[13px] text-fg-dim">
        7-Tage-Schnitt{" "}
        <b className="font-semibold text-fg">{schnitt7 ? `${de(schnitt7, 2)} kg` : "—"}</b>
      </p>

      {/* Die Live-Region bleibt dauerhaft im Baum. Würde sie erst mit der
          Meldung eingehängt, lesen Screenreader sie oft gar nicht vor. */}
      <div role="status" aria-live="polite">
        <AnimatePresence mode="wait">
          {status.art !== "ruhe" && (
            <motion.p
              key={status.art}
              initial={reduce ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              /* Bestätigung in Eisblau, nicht in Grün: Grün steht in dieser App
                 neben einer Zahl immer für Regeneration und würde hier als
                 Bewertung des Gewichts missverstanden. */
              className={`mt-3 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${
                status.art === "erfolg"
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-strain/30 bg-strain/10 text-strain"
              }`}
            >
              {status.art === "erfolg"
                ? `${de(status.kg, 2)} kg an Google Health übertragen.`
                : `Nicht übertragen: ${status.text} Der Wert steht noch da — nochmal versuchen.`}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

/** 0,5 und 0,1 einstellig, 0,05 zweistellig — sonst steht auf der Taste "0,50". */
function schrittLabel(s: number): string {
  const betrag = Math.abs(s);
  return de(betrag, betrag < 0.1 ? 2 : 1);
}

function zuZahl(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function begrenze(n: number): number {
  return Math.min(MAX_KG, Math.max(MIN_KG, n));
}
