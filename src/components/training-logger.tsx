"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { heutigeSaetze, type Einheitskopf, type PlannedExercise } from "@/lib/plan";
import { useRouter } from "next/navigation";
import { satzSpeichern, trainingStarten } from "@/lib/workouts";
import { Card, Eyebrow, Tag, de, uebungsVorschau } from "@/components/ui";

const PAUSE_SEKUNDEN = 180;

/** Wie lange "Pause vorbei" in der Kopfleiste stehen bleibt. */
const VORBEI_SEKUNDEN = 12;

type Logged = { kg: number; reps: number };

/**
 * Der interaktive Teil des Trainings. Bekommt den fertigen Plan als Prop —
 * geladen wird er serverseitig aus der Datenbank, damit die Startgewichte
 * auf der echten Historie beruhen und nicht auf hinterlegten Startwerten.
 */
export function TrainingLogger({
  uebungen,
  session,
  startedAtMs,
}: {
  uebungen: PlannedExercise[];
  session: Einheitskopf;
  /** Beginn der Einheit aus der Datenbank — nicht der Zeitpunkt des Seitenaufrufs. */
  startedAtMs: number;
}) {
  const [logged, setLogged] = useState<Record<string, Logged>>({});
  const [zuletzt, setZuletzt] = useState<string | null>(null);
  const [speicherFehler, setSpeicherFehler] = useState<string | null>(null);
  const [pause, setPause] = useState<number | null>(null);
  const [pauseVorbei, setPauseVorbei] = useState(false);
  const [ansage, setAnsage] = useState("");
  const [laufzeit, setLaufzeit] = useState(0);
  const start = useRef(startedAtMs);
  const reduce = useReducedMotion();

  useEffect(() => {
    const id = setInterval(
      () => setLaufzeit(Math.floor((Date.now() - start.current) / 1000)),
      1000
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (pause === null) return;
    if (pause <= 0) {
      // Abgelaufen, nicht abgebrochen: nur dann ist die Meldung fällig.
      setPause(null);
      setPauseVorbei(true);
      setAnsage("Satzpause vorbei.");
      return;
    }
    const id = setTimeout(() => setPause((p) => (p === null ? null : p - 1)), 1000);
    return () => clearTimeout(id);
  }, [pause]);

  /* Ohne diese Meldung ging der Wechsel von Countdown auf Laufzeit still
     vonstatten. Im Gym schaut man während der Pause nicht auf das Display —
     man hat es weggelegt und sieht beim Hinsehen nur eine Zahl, die
     weiterläuft, ohne zu wissen, ob sie hoch- oder runterzählt. */
  useEffect(() => {
    if (!pauseVorbei) return;
    const id = setTimeout(() => setPauseVorbei(false), VORBEI_SEKUNDEN * 1000);
    return () => clearTimeout(id);
  }, [pauseVorbei]);

  const saetzeGesamt = uebungen.reduce((n, e) => n + heutigeSaetze(e).length, 0);
  const saetzeFertig = Object.keys(logged).length;
  const volumen = Object.values(logged).reduce((v, s) => v + s.kg * s.reps, 0);
  const alleSaetzeFertig = saetzeGesamt > 0 && saetzeFertig === saetzeGesamt;

  function abhaken(
    key: string,
    exercise: string,
    setIndex: number,
    kg: number,
    reps: number
  ) {
    // Zuerst die Oberfläche aktualisieren, dann speichern: im Gym soll der
    // Timer sofort laufen und nicht auf das Netz warten. Schlägt das
    // Speichern fehl, bleibt der Satz sichtbar und der Fehler wird angezeigt.
    setLogged((prev) => (prev[key] ? prev : { ...prev, [key]: { kg, reps } }));
    setZuletzt(key);
    setPauseVorbei(false);
    setPause(PAUSE_SEKUNDEN);
    // Der Text enthält Übung und Satznummer, damit er sich zwischen zwei
    // Sätzen unterscheidet — gleicher Text wird von Screenreadern nicht
    // erneut vorgelesen.
    setAnsage(`${exercise}, Satz ${setIndex + 1} gespeichert. Satzpause drei Minuten.`);

    void satzSpeichern({ kind: session.key, exercise, setIndex, kg, reps }).then((r) => {
      setSpeicherFehler(r.ok ? null : r.fehler);
    });
  }

  /**
   * Einen abgehakten Satz wieder zum Bearbeiten öffnen.
   *
   * satzSpeichern() ist ein Upsert — ein zweites Abhaken korrigiert den Wert
   * in der Datenbank. Ohne diesen Weg käme man an einen Vertipper aber nie
   * heran: 105 statt 10,5 wäre im Gym nicht mehr zu retten.
   *
   * Der Datenbankeintrag bleibt dabei stehen. Der Satz hat ja stattgefunden;
   * korrigiert wird er erst beim erneuten Abhaken. Die Satzpause startet
   * bewusst NICHT neu — korrigiert wird meist lange nach dem Satz.
   */
  function korrigieren(key: string) {
    setLogged((prev) => {
      const rest = { ...prev };
      delete rest[key];
      return rest;
    });
    if (zuletzt === key) setZuletzt(null);
  }

  const kopfTon = pause !== null ? "pause" : pauseVorbei ? "vorbei" : "ruhe";

  return (
    <div className="mx-auto max-w-[520px] md:max-w-none">
      {/* Kopfleiste wie in Lift Off: zeigt normalerweise die Laufzeit und
          übernimmt während der Satzpause den Countdown.

          kopfleiste-oben (globals.css) rechnet die iPhone-Statusleiste heraus:
          festgeklebt braucht die Leiste die Höhe selbst, oben auf der Seite
          hat der body sie schon. */}
      <div
        className={`kopfleiste-oben sticky top-0 z-30 -mx-5 flex items-center gap-3.5
                    border-b px-5 pb-3.5 backdrop-blur-xl transition-colors md:top-[62px]
                    ${
                      kopfTon === "pause"
                        ? "border-ready/40 bg-ground/95"
                        : kopfTon === "vorbei"
                          ? "border-accent/50 bg-ground/95"
                          : "border-hair-soft bg-ground/90"
                    }`}
      >
        <Ring
          fortschritt={kopfTon === "pause" ? pause! / PAUSE_SEKUNDEN : kopfTon === "vorbei" ? 1 : 0}
          farbe={kopfTon === "pause" ? "var(--color-ready)" : "var(--color-accent)"}
        />
        <div className="min-w-0 flex-1">
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
              kopfTon === "pause"
                ? "text-ready"
                : kopfTon === "vorbei"
                  ? "text-accent"
                  : "text-fg-faint"
            }`}
          >
            {kopfTon === "pause"
              ? "Satzpause"
              : kopfTon === "vorbei"
                ? "Pause vorbei · nächster Satz"
                : "Laufzeit"}
          </p>
          {/* Die große Zahl wechselt mit: vorher stand der Countdown in
              derselben Farbe wie die Laufzeit, und aus zwei Metern Abstand
              war nicht zu sehen, welcher der beiden Zustände gerade gilt. */}
          <b
            className={`block text-2xl font-bold tracking-[-0.04em] ${
              kopfTon === "pause" ? "text-ready" : "text-fg"
            }`}
          >
            {mmss(pause ?? laufzeit)}
          </b>
        </div>
        <AnimatePresence>
          {pause !== null && (
            <motion.div
              initial={reduce ? false : { opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: 8 }}
              className="flex shrink-0 gap-2"
            >
              <Klein onClick={() => setPause((p) => (p ?? 0) + 30)}>+30 s</Klein>
              <Klein
                beschriftung="Satzpause beenden und weitermachen"
                onClick={() => {
                  setPause(null);
                  setPauseVorbei(false);
                }}
              >
                Weiter
              </Klein>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Eigene Live-Region für Ereignisse. Vorher lag aria-live auf der
          laufenden Uhr — Screenreader lasen dort jede Sekunde die neue Zeit
          vor und übertönten damit alles andere. */}
      <p className="sr-only" role="status" aria-live="polite">
        {ansage}
      </p>

      <header className="pt-7">
        <Eyebrow>{session.focus}</Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em] md:text-[33px]">
          {session.title}
        </h1>
        <div className="mt-5 flex gap-6">
          <Kennzahl
            label="Volumen"
            wert={Math.round(volumen).toLocaleString("de-AT")}
            einheit=" kg"
          />
          <Kennzahl label="Sätze" wert={String(saetzeFertig)} einheit={`/${saetzeGesamt}`} />
          <Kennzahl label="Pause" wert="3:00" />
        </div>
        {speicherFehler && (
          <p className="mt-4 rounded-sm border border-strain/30 bg-strain/10 px-3.5 py-2.5 text-xs leading-relaxed text-strain">
            Satz konnte nicht gespeichert werden: {speicherFehler} — er bleibt hier stehen,
            trag ihn später nach.
          </p>
        )}
      </header>

      <div className="mt-5 flex flex-col gap-3.5">
        {uebungen.map((ex, i) => {
          const saetze = heutigeSaetze(ex);
          const alleFertig =
            saetze.length > 0 && saetze.every((_, si) => logged[`${i}-${si}`]);
          return (
            /* Kein opacity mehr auf der ganzen Karte: 55 % Deckkraft senkt
               jeden Kontrast darin unter die Lesbarkeitsgrenze — ausgerechnet
               bei den Zahlen, die man später nachliest. Erledigt steht jetzt
               am Zähler und als Wort im Tag. */
            <Card key={ex.name}>
              <div className="flex items-center gap-3.5">
                <span
                  className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-sm text-[11px] font-bold
                              ${alleFertig ? "bg-ready/15 text-ready" : "bg-surface-3 text-fg-dim"}`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-semibold tracking-[-0.015em]">{ex.name}</b>
                  {(ex.grund ?? ex.note) && (
                    <span className="mt-0.5 block text-xs text-fg-faint">
                      {ex.grund ?? ex.note}
                    </span>
                  )}
                </span>
                {alleFertig ? (
                  <Tag tone="gut">fertig</Tag>
                ) : (
                  ex.delta !== 0 && (
                    <Tag tone={ex.delta > 0 ? "gut" : "warnung"}>
                      {ex.delta > 0 ? "+" : "−"}
                      {de(Math.abs(ex.delta), 1)} kg
                    </Tag>
                  )
                )}
              </div>

              <div className="mt-3 grid grid-cols-[26px_58px_1fr_1fr_44px] items-center gap-2 border-b border-hair-soft pb-2">
                {["Satz", "Zuletzt", "kg", "Wdh", ""].map((h, hi) => (
                  <span
                    key={hi}
                    className={`text-[10px] font-semibold uppercase tracking-[0.11em] text-fg-faint ${
                      hi === 2 || hi === 3 ? "text-center" : ""
                    }`}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {saetze.map((satz, si) => (
                <SatzZeile
                  key={si}
                  nummer={si + 1}
                  prev={ex.prev[si]}
                  zielKg={satz.kg}
                  zielReps={satz.wdh}
                  amrap={satz.amrap}
                  logged={logged[`${i}-${si}`]}
                  hervorgehoben={zuletzt === `${i}-${si}`}
                  onLog={(kg, reps) => abhaken(`${i}-${si}`, ex.name, si, kg, reps)}
                  onKorrigieren={() => korrigieren(`${i}-${si}`)}
                />
              ))}

              {/* Ohne Trainingsmax steht der Bank-Slot ohne Zahlen da. Die
                  Karte bleibt trotzdem, statt die Übung zu verstecken: dass
                  hier etwas fehlt, ist die Information. */}
              {saetze.length === 0 && ex.programmHinweis && (
                <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                  {ex.programmHinweis}
                </p>
              )}
            </Card>
          );
        })}

        {/* Vorher endete die Einheit damit, dass nichts mehr passierte. Ein
            Abschluss beantwortet die einzige Frage, die man am Ende hat: war
            das jetzt alles, und ist es angekommen. */}
        {alleSaetzeFertig && (
          <Card className="border-ready/30">
            <Eyebrow>Einheit abgeschlossen</Eyebrow>
            <p className="mt-2 text-[15px] font-semibold tracking-[-0.015em]">
              Alle {saetzeGesamt} Sätze abgehakt
            </p>
            <div className="mt-3.5 flex gap-6">
              <Kennzahl
                label="Volumen"
                wert={Math.round(volumen).toLocaleString("de-AT")}
                einheit=" kg"
              />
              <Kennzahl label="Dauer" wert={mmss(laufzeit)} />
            </div>
            <p className="mt-3.5 text-[11px] leading-relaxed text-fg-faint">
              Jeder Satz ist einzeln gespeichert, sobald du ihn abgehakt hast. Korrigieren
              geht weiterhin: Tipp auf den Haken oder ins Feld.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function SatzZeile({
  nummer,
  prev,
  zielKg,
  zielReps,
  amrap = false,
  logged,
  hervorgehoben,
  onLog,
  onKorrigieren,
}: {
  nummer: number;
  prev?: string;
  zielKg: number;
  zielReps: number;
  /** Satz auf Maximalwiederholungen: zielReps ist die Untergrenze, nicht das Ziel. */
  amrap?: boolean;
  logged?: Logged;
  hervorgehoben: boolean;
  onLog: (kg: number, reps: number) => void;
  onKorrigieren: () => void;
}) {
  const [kg, setKg] = useState("");
  const [reps, setReps] = useState("");
  const [repsUngueltig, setRepsUngueltig] = useState(false);
  const fertig = Boolean(logged);

  // Beim Öffnen zum Korrigieren stehen die gespeicherten Werte im Feld,
  // damit man nur die falsche Stelle ändern muss statt alles neu zu tippen.
  function oeffnen() {
    if (!logged) return;
    setKg(String(logged.kg).replace(".", ","));
    setReps(String(logged.reps));
    setRepsUngueltig(false);
    onKorrigieren();
  }

  function loggen() {
    const kgZahl = Number((kg || String(zielKg)).replace(",", ".")) || 0;
    const repsZahl = Number((reps || String(zielReps)).replace(",", "."));

    // Ein Satz mit null Wiederholungen hat nicht stattgefunden. Ohne diese
    // Prüfung landete ein Vertipper wie "o" statt "0" als 0 × 0 in der
    // Datenbank und verdarb die Progression für die nächste Einheit.
    if (!Number.isFinite(repsZahl) || repsZahl <= 0) {
      setRepsUngueltig(true);
      return;
    }

    setRepsUngueltig(false);
    onLog(kgZahl, repsZahl);
  }

  return (
    <div
      className={`grid grid-cols-[26px_58px_1fr_1fr_44px] items-center gap-2 rounded-sm py-1
                  transition-colors duration-500 ${hervorgehoben ? "bg-ready/10" : ""}`}
    >
      <span className="text-center text-xs font-semibold text-fg-faint">{nummer}</span>
      <span className="whitespace-nowrap rounded-sm bg-surface-2 py-1.5 text-center text-xs text-fg-faint">
        {/* Beim Bankdrücken im ersten Zyklus gibt es noch keine letzte
            Ausführung. Ein Gedankenstrich sagt das; ein leeres Feld sähe
            nach einem Ladefehler aus. */}
        {prev ?? "—"}
      </span>
      <Feld
        wert={fertig ? String(logged!.kg).replace(".", ",") : kg}
        setWert={setKg}
        platzhalter={String(zielKg).replace(".", ",")}
        fertig={fertig}
        onOeffnen={oeffnen}
        label={`Gewicht in Kilogramm, Satz ${nummer}`}
      />
      <Feld
        wert={fertig ? String(logged!.reps) : reps}
        setWert={(v) => {
          setReps(v);
          setRepsUngueltig(false);
        }}
        /* Beim AMRAP-Satz steht "5+" im Feld: die Zahl ist die Untergrenze,
           über die hinaus gegangen werden soll. Die Rückfallzahl beim Abhaken
           bleibt zielReps — Number("5+") wäre NaN. */
        platzhalter={amrap ? `${zielReps}+` : String(zielReps)}
        fertig={fertig}
        ungueltig={repsUngueltig}
        // Wiederholungen sind ganze Zahlen: die reine Zifferntastatur spart
        // die Komma-Taste, auf die man sonst danebengreift.
        modus="numeric"
        onOeffnen={oeffnen}
        label={`Wiederholungen, Satz ${nummer}`}
      />
      <button
        type="button"
        aria-label={fertig ? `Satz ${nummer} korrigieren` : `Satz ${nummer} abhaken`}
        onClick={() => (fertig ? oeffnen() : loggen())}
        className={`grid min-h-[44px] w-full place-items-center rounded-sm transition
                    ${fertig ? "bg-ready text-ground" : "bg-surface-3 active:scale-90 md:hover:bg-hair"}`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-[17px] w-[17px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </button>

      {repsUngueltig && (
        // Direkt unter der Zeile statt als Sammelmeldung oben: im Gym sieht
        // man sonst nicht, welcher der 16 Sätze gemeint ist.
        <p className="col-span-5 pb-1 text-right text-[11px] text-strain" role="alert">
          Wiederholungen müssen größer als 0 sein.
        </p>
      )}
    </div>
  );
}

function Feld({
  wert,
  setWert,
  platzhalter,
  fertig,
  ungueltig = false,
  modus = "decimal",
  onOeffnen,
  label,
}: {
  wert: string;
  setWert: (v: string) => void;
  platzhalter: string;
  fertig: boolean;
  ungueltig?: boolean;
  modus?: "decimal" | "numeric";
  onOeffnen: () => void;
  label: string;
}) {
  return (
    <input
      type="text"
      inputMode={modus}
      aria-label={label}
      aria-invalid={ungueltig || undefined}
      value={wert}
      readOnly={fertig}
      // Ein Tipp ins gesperrte Feld öffnet den Satz — das ist die Geste, die
      // man intuitiv macht, wenn man einen Zahlendreher sieht.
      onFocus={fertig ? onOeffnen : undefined}
      onClick={fertig ? onOeffnen : undefined}
      onChange={(e) => setWert(e.target.value)}
      placeholder={platzhalter}
      className={`min-h-[44px] w-full rounded-sm border text-center text-base font-semibold
                  tracking-[-0.02em] outline-none transition placeholder:font-normal placeholder:text-fg-faint
                  ${
                    fertig
                      ? "border-transparent bg-ready/10 text-ready"
                      : ungueltig
                        ? "border-strain bg-surface-3 focus:bg-hair"
                        : "border-transparent bg-surface-3 focus:border-accent focus:bg-hair"
                  }`}
    />
  );
}

function Kennzahl({
  label,
  wert,
  einheit,
}: {
  label: string;
  wert: string;
  einheit?: string;
}) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className="num mt-1 text-[19px]">
        {wert}
        {einheit && <span className="text-xs font-medium text-fg-faint">{einheit}</span>}
      </div>
    </div>
  );
}

/**
 * Kleine Taste in der Kopfleiste. 44 px hoch und breit statt der früheren
 * 38 px: sie wird mitten im Satz mit einer Hand und rutschigen Fingern
 * getroffen, und darunter liegt direkt der Satz, den man nicht anfassen will.
 */
function Klein({
  children,
  beschriftung,
  onClick,
}: {
  children: ReactNode;
  beschriftung?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={beschriftung}
      className="min-h-[44px] min-w-[44px] rounded-sm border border-hair-soft px-3 text-xs font-semibold
                 text-fg-dim transition active:scale-95 active:border-accent/50 active:text-accent
                 md:hover:border-accent/35 md:hover:text-accent"
    >
      {children}
    </button>
  );
}

function Ring({ fortschritt, farbe }: { fortschritt: number; farbe: string }) {
  const C = 2 * Math.PI * 16;
  return (
    <div className="relative h-9 w-9 shrink-0">
      <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="16" fill="none" strokeWidth="3.5" stroke="var(--color-hair)" />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          stroke={farbe}
          strokeDasharray={C}
          strokeDashoffset={C - C * fortschritt}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
    </div>
  );
}

function mmss(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Startbildschirm der Einheit.
 *
 * Erst ein Tipp hier legt die Einheit an und setzt den Beginn — vorher lief
 * die Uhr ab dem Seitenaufruf. Wer mittags nachsieht, was ansteht, und abends
 * trainiert, sah sonst eine Laufzeit von Stunden, die nichts gemessen hat.
 *
 * Der Bildschirm zeigt zugleich, was ansteht: bei acht Übungen will man vor
 * dem ersten Satz wissen, ob heute die schwere Einheit dran ist.
 */
export function TrainingStart({
  session,
  uebungen,
  bankKarte,
}: {
  session: Einheitskopf;
  uebungen: PlannedExercise[];
  /**
   * Der Bank-Slot als fertig gerenderter Serverknoten.
   *
   * Als Prop statt als eigener Abschnitt in der Seite: der Startbildschirm ist
   * eine Client-Komponente und ersetzt die ganze Seite. Was zum 5/3/1 gehört,
   * braucht aber Datenbankzugriff — also rendert die Seite es und reicht es
   * hier durch.
   */
  bankKarte?: ReactNode;
}) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const saetze = uebungen.reduce((n, e) => n + heutigeSaetze(e).length, 0);
  const aenderungen = uebungen.filter((e) => e.delta !== 0);

  async function starten() {
    setLaeuft(true);
    setFehler(null);
    const r = await trainingStarten(session.key);
    if (r.ok) {
      // Die Seite lädt neu und zeigt dann den Logger — der Beginn kommt dabei
      // aus der Datenbank, nicht aus dem Browser.
      router.refresh();
    } else {
      setFehler(r.fehler);
      setLaeuft(false);
    }
  }

  return (
    <div className="mx-auto max-w-[520px] pt-10 md:pt-14">
      <Eyebrow>{session.focus}</Eyebrow>
      <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em] md:text-[33px]">
        {session.title}
      </h1>
      <p className="mt-1.5 text-sm text-fg-dim">
        {uebungen.length} Übungen · {saetze} Sätze · Satzpause 3 Minuten
      </p>

      <button
        type="button"
        onClick={starten}
        disabled={laeuft}
        className="mt-6 flex min-h-[56px] w-full items-center justify-center rounded-md bg-accent
                   text-base font-semibold text-on-accent transition active:scale-[0.98]
                   disabled:opacity-60"
      >
        {laeuft ? "Wird gestartet…" : "Training starten"}
      </button>

      {fehler && (
        <p className="mt-3 rounded-md border border-strain/30 bg-strain/10 px-3.5 py-2.5 text-xs leading-relaxed text-strain">
          Start fehlgeschlagen: {fehler}
        </p>
      )}

      {bankKarte}

      {aenderungen.length > 0 && (
        <Card className="mt-5">
          <Eyebrow>Heute geändert</Eyebrow>
          <ul className="mt-3 flex flex-col gap-2.5">
            {aenderungen.map((ex) => (
              <li key={ex.name} className="flex items-start gap-3">
                <Tag tone={ex.delta > 0 ? "gut" : "warnung"}>
                  {ex.delta > 0 ? "+" : "−"}
                  {de(Math.abs(ex.delta), 1)} kg
                </Tag>
                <span className="min-w-0 flex-1">
                  <b className="block text-[13px] font-semibold">{ex.name}</b>
                  {ex.grund && (
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-fg-faint">
                      {ex.grund}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-3.5">
        <Eyebrow>Übungen</Eyebrow>
        <ol className="mt-3 flex flex-col gap-2">
          {uebungen.map((ex, i) => (
            <li key={ex.name} className="flex items-center gap-3">
              <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-sm bg-surface-3 text-[11px] font-bold text-fg-dim">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg-dim">{ex.name}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-fg-faint">
                {uebungsVorschau(ex)}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
