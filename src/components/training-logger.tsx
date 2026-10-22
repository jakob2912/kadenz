"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useOffline } from "next/offline";
import { heutigeSaetze, type Einheitskopf, type PlannedExercise } from "@/lib/plan";
import { useRouter } from "next/navigation";
import {
  notizSpeichern,
  satzSpeichern,
  trainingBeenden,
  trainingStarten,
  type GeloggterSatz,
} from "@/lib/workouts";
import { Card, Eyebrow, Tag, anzahl, de, uebungsVorschau } from "@/components/ui";
import { geraetLesen, pauseVorbeiSignal, tonVorbereiten } from "@/lib/geraet";
import { satzpauseAnkuendigen } from "@/lib/push-actions";
import {
  ausgangAblegen,
  ausgangErledigt,
  ausgangOffen,
  pauseLesen,
  pauseSchreiben,
  type OffenerSatz,
} from "@/lib/ablage";
import { wienerDatum } from "@/lib/datum";
import { e1rm } from "@/lib/kraft";
import { aufwaermen, beladung, beladungText } from "@/lib/hantel";

const PAUSE_SEKUNDEN = 180;

/** Wie lange "Pause vorbei" in der Kopfleiste stehen bleibt. */
const VORBEI_SEKUNDEN = 12;

/**
 * Ein Ende, das länger als das hier zurückliegt, meldet sich nicht mehr mit
 * Ton: wer nach zehn Minuten zurückkommt, braucht kein Piepen, das sagt,
 * dass die Pause vor sieben Minuten vorbei war.
 */
const SIGNAL_NACHLAUF_MS = 5000;

/**
 * Date.now() hinter einem Namen. abhaken() läuft ausschließlich im Tipp-
 * Handler, der React-Compiler kann das aber nicht sehen, weil die Funktion
 * als Prop an SatzZeile weitergereicht wird — und meldet einen unreinen
 * Aufruf beim Rendern, den es nicht gibt.
 */
const uhr = () => Date.now();

/**
 * Einen Satz zum Server schicken — über den Ausgang im localStorage.
 *
 * Erst ablegen, dann senden, und erst nach dem Ja des Servers austragen.
 * Dazwischen hält Next die Anfrage ohne Netz zurück (useOffline) — aber nur
 * im Speicher. Beendet iOS die App in dieser Zeit, liegt der Satz noch im
 * Ausgang und geht beim nächsten Öffnen raus. Doppelt senden schadet nicht,
 * satzSpeichern ist ein Upsert.
 */
function senden(satz: OffenerSatz, melden: (fehler: string | null) => void) {
  ausgangAblegen(satz);
  void satzSpeichern(satz).then((r) => {
    if (r.ok) ausgangErledigt(satz);
    melden(r.ok ? null : r.fehler);
  });
}

/** Der Zustand eines abgehakten Satzes im Logger. */
type Logged = { kg: number; reps: number };

/**
 * Die geloggten Sätze auf die Schlüssel des Loggers abbilden.
 *
 * Der Logger adressiert einen Satz über die Position in der heutigen
 * Übungsliste (`${uebungIndex}-${satzIndex}`), die Datenbank über den
 * Übungsnamen. Übersetzt wird hier, und zwar in diese Richtung: Sätze, deren
 * Übung heute gar nicht ansteht — getauschtes Gerät, nachträglich entfernte
 * Übung —, fallen dabei still weg. Sie bleiben in der Datenbank und im
 * Kraftverlauf, sie haben nur keine Zeile auf diesem Bildschirm.
 */
function ausDatenbank(
  geloggt: GeloggterSatz[],
  uebungen: PlannedExercise[]
): Record<string, Logged> {
  const platz = new Map(uebungen.map((ex, i) => [ex.name, i]));
  const stand: Record<string, Logged> = {};

  for (const satz of geloggt) {
    const i = platz.get(satz.exercise);
    if (i === undefined) continue;
    stand[`${i}-${satz.setIndex}`] = { kg: satz.kg, reps: satz.reps };
  }

  return stand;
}

/**
 * Der interaktive Teil des Trainings. Bekommt den fertigen Plan als Prop —
 * geladen wird er serverseitig aus der Datenbank, damit die Startgewichte
 * auf der echten Historie beruhen und nicht auf hinterlegten Startwerten.
 */
export function TrainingLogger({
  uebungen,
  session,
  startedAtMs,
  finishedAtMs = null,
  geloggt = [],
  bestwerte = {},
  notiz = null,
  wechsel,
}: {
  uebungen: PlannedExercise[];
  session: Einheitskopf;
  /**
   * Bisher bestes geschätztes Maximum je Übung, ohne heute — siehe
   * bestwerteFuer() in workouts.ts. Fehlt eine Übung, gibt es für sie keinen
   * Bestwert: der erste Satz einer neuen Übung ist kein Rekord, sondern der
   * Anfang.
   */
  bestwerte?: Record<string, number>;
  /** Die Notiz zur Einheit, falls heute schon eine geschrieben wurde. */
  notiz?: string | null;
  /**
   * Beginn der Einheit aus der Datenbank — nicht der Zeitpunkt des
   * Seitenaufrufs. `null`, wenn die Datenbank ihn gerade nicht hergibt: dann
   * zählt die Zeit ab dem Moment, in dem der Logger auf dem Schirm steht.
   */
  startedAtMs: number | null;
  /** Zeitpunkt des Abschlusses aus der Datenbank. Null, solange sie läuft. */
  finishedAtMs?: number | null;
  /** Was heute schon in der Datenbank steht. */
  geloggt?: GeloggterSatz[];
  /** Der Weg zur anderen Einheit, fertig gerendert von der Seite. */
  wechsel?: ReactNode;
}) {
  /* Der Anfangszustand kommt aus der Datenbank, nicht aus dem Nichts. Vorher
     stand hier {}, und damit fing eine Einheit nach jedem Neuladen wieder bei
     null an — die Haken waren weg, der Zähler stand auf 0, und die Karte
     "Einheit abgeschlossen" verschwand, obwohl alle Sätze gespeichert waren. */
  const [logged, setLogged] = useState<Record<string, Logged>>(() =>
    ausDatenbank(geloggt, uebungen)
  );
  const [fertigSeit, setFertigSeit] = useState<number | null>(finishedAtMs);
  const [zuletzt, setZuletzt] = useState<string | null>(null);
  const [speicherFehler, setSpeicherFehler] = useState<string | null>(null);
  /* Die Pause ist ein Zeitpunkt, kein Zähler. Vorher zählte ein setTimeout
     jede Sekunde eins herunter — und iOS hält Zeitgeber einer Seite an,
     sobald der Bildschirm aus ist. Wer das Handy in der Pause weglegte, fand
     beim Aufnehmen noch 2:40 vor, obwohl drei Minuten vorbei waren. Jetzt
     steht das Ende fest, und angezeigt wird der Abstand dazu. */
  const [pauseEnde, setPauseEnde] = useState<number | null>(null);
  /* Die ganze Länge der laufenden Pause, samt "+30 s". Der Ring zeigt den
     Anteil daran — gegen die festen drei Minuten gerechnet stand er nach
     einem "+30 s" eine halbe Minute lang voll, als liefe nichts. */
  const [pauseDauer, setPauseDauer] = useState(PAUSE_SEKUNDEN * 1000);
  const [jetzt, setJetzt] = useState(0);
  const [pauseVorbei, setPauseVorbei] = useState(false);
  const [ansage, setAnsage] = useState("");
  const [laufzeit, setLaufzeit] = useState(0);
  const start = useRef(startedAtMs);
  const reduce = useReducedMotion();
  const offline = useOffline();

  useBildschirmAn(fertigSeit === null);

  useEffect(() => {
    /* Der Rückfall auf "jetzt" steht hier und nicht im Server-Render: Date.now()
       während des Renderns ist unrein, und der Wert wäre ohnehin der Zeitpunkt
       der Anfrage gewesen, nicht der, an dem der Logger vor dir liegt. */
    start.current ??= Date.now();

    /* Steht das Ende schon fest, ist die Dauer eine feste Zahl und kein
       laufender Zähler. Vorher lief das Intervall bedingungslos weiter: eine
       um elf Uhr beendete Einheit zeigte am Abend sieben Stunden Laufzeit. */
    if (fertigSeit !== null) {
      setLaufzeit(Math.max(0, Math.floor((fertigSeit - (start.current ?? fertigSeit)) / 1000)));
      return;
    }

    const id = setInterval(
      () => setLaufzeit(Math.floor((Date.now() - (start.current ?? Date.now())) / 1000)),
      1000
    );
    return () => clearInterval(id);
  }, [fertigSeit]);

  /* Nach einem Neuladen wieder aufnehmen, was nur im Browser lag: die
     laufende Satzpause und Sätze, die ohne Netz abgehakt wurden und nie beim
     Server ankamen (lib/ablage.ts). Gesetzt wird im Timeout statt direkt im
     Effekt — localStorage gibt es erst im Browser, und ein setState mitten
     im Effekt rendert sofort ein zweites Mal. */
  useEffect(() => {
    const id = setTimeout(() => {
      const t = Date.now();

      const gespeichert = pauseLesen(session.key);
      if (gespeichert && gespeichert.ende > t) {
        setJetzt(t);
        setPauseDauer(gespeichert.dauer);
        setPauseEnde(gespeichert.ende);
      } else if (gespeichert) {
        pauseSchreiben(null);
        // Während des Neuladens abgelaufen: das ist trotzdem eine Auskunft.
        if (t - gespeichert.ende < 60_000) setPauseVorbei(true);
      }

      const offen = ausgangOffen(t);
      const heute = wienerDatum(new Date(t));
      const platz = new Map(uebungen.map((ex, i) => [ex.name, i]));
      const zurueck: Record<string, Logged> = {};
      for (const satz of offen) {
        const i = platz.get(satz.exercise);
        if (satz.kind === session.key && i !== undefined && wienerDatum(new Date(satz.erfasstAm)) === heute) {
          zurueck[`${i}-${satz.setIndex}`] = { kg: satz.kg, reps: satz.reps };
        }
        senden(satz, setSpeicherFehler);
      }
      if (Object.keys(zurueck).length > 0) setLogged((prev) => ({ ...prev, ...zurueck }));
    }, 0);
    return () => clearTimeout(id);
    // uebungen ist absichtlich nicht dabei: der Ausgang soll genau einmal beim
    // Laden geleert werden, nicht bei jedem neuen Plan-Objekt vom Server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.key]);

  useEffect(() => {
    if (pauseEnde === null) return;

    function ticken() {
      const t = Date.now();
      if (t >= pauseEnde!) {
        // Abgelaufen, nicht abgebrochen: nur dann ist die Meldung fällig.
        pauseSchreiben(null);
        setPauseEnde(null);
        setPauseVorbei(true);
        setAnsage("Satzpause vorbei.");
        if (t - pauseEnde! < SIGNAL_NACHLAUF_MS) pauseVorbeiSignal();
        return;
      }
      setJetzt(t);
    }

    /* Viertelsekunde statt Sekunde: bei einem Intervall von genau 1000 ms
       springt die Anzeige je nach Phase zur vollen Sekunde gelegentlich
       zwei Sekunden auf einmal. */
    const id = setInterval(ticken, 250);
    /* Beim Zurückkommen aus dem Hintergrund sofort nachrechnen, statt bis
       zum nächsten Intervall die alte Zahl stehen zu lassen. */
    const sichtbar = () => {
      if (document.visibilityState === "visible") ticken();
    };
    document.addEventListener("visibilitychange", sichtbar);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", sichtbar);
    };
  }, [pauseEnde]);

  const pause =
    pauseEnde === null ? null : Math.max(0, Math.ceil((pauseEnde - jetzt) / 1000));

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

  /* Bestwerte von heute, aus den abgehakten Sätzen abgeleitet statt als
     eigener State: korrigiert man einen Satz nach unten, verschwindet die
     Markierung von selbst wieder. */
  const rekorde = new Map<string, number>();
  uebungen.forEach((ex, i) => {
    const bisher = bestwerte[ex.name];
    if (bisher === undefined) return;
    heutigeSaetze(ex).forEach((_, si) => {
      const satz = logged[`${i}-${si}`];
      const wert = satz ? e1rm(satz) : null;
      if (wert !== null && wert > bisher + 0.01) rekorde.set(`${i}-${si}`, wert);
    });
  });
  const rekordUebungen = uebungen
    .map((ex, i) => {
      let max = 0;
      rekorde.forEach((wert, key) => {
        if (key.startsWith(`${i}-`)) max = Math.max(max, wert);
      });
      return max > 0 ? { name: ex.name, wert: max, vorher: bestwerte[ex.name] } : null;
    })
    .filter((r) => r !== null);

  /* Der Abschluss gehört in die Datenbank, nicht nur in diesen State. Sonst
     ist die Einheit nach dem nächsten Seitenaufruf wieder offen, und die
     Laufzeit zählt weiter — genau das war der Fall, in dem Trainings nie
     aufhörten. Wirkt nur beim Übergang von "nicht fertig" auf "fertig":
     trainingBeenden() verschiebt einen bereits gesetzten Zeitstempel nicht,
     eine Korrektur am nächsten Tag verlängert die Einheit also nicht
     rückwirkend. */
  useEffect(() => {
    if (!alleSaetzeFertig || fertigSeit !== null) return;

    let abgebrochen = false;
    void trainingBeenden(session.key, undefined, Date.now()).then((r) => {
      if (!abgebrochen && r.ok) setFertigSeit(r.finishedAtMs);
    });

    return () => {
      abgebrochen = true;
    };
  }, [alleSaetzeFertig, fertigSeit, session.key]);

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
    setLogged((prev) =>
      prev[key] ? prev : { ...prev, [key]: { kg, reps } }
    );
    setZuletzt(key);
    setPauseVorbei(false);
    const t = uhr();
    setJetzt(t);
    setPauseEnde(t + PAUSE_SEKUNDEN * 1000);
    setPauseDauer(PAUSE_SEKUNDEN * 1000);
    pauseSchreiben({ ende: t + PAUSE_SEKUNDEN * 1000, dauer: PAUSE_SEKUNDEN * 1000, einheit: session.key });
    tonVorbereiten();
    // Für den gesperrten Bildschirm: der Server schickt am Ende eine
    // Push-Nachricht, falls sie eingeschaltet ist. Scheitert das, läuft der
    // Timer hier trotzdem — die Nachricht ist Zugabe, nicht Grundlage.
    void satzpauseAnkuendigen(t + PAUSE_SEKUNDEN * 1000);
    // Der Text enthält Übung und Satznummer, damit er sich zwischen zwei
    // Sätzen unterscheidet — gleicher Text wird von Screenreadern nicht
    // erneut vorgelesen.
    const wert = e1rm({ kg, reps });
    const bisher = bestwerte[exercise];
    const rekord = wert !== null && bisher !== undefined && wert > bisher + 0.01;
    setAnsage(
      `${exercise}, Satz ${setIndex + 1} gespeichert.${rekord ? " Neuer Bestwert!" : ""} Satzpause drei Minuten.`
    );

    senden({ kind: session.key, exercise, setIndex, kg, reps, erfasstAm: t }, setSpeicherFehler);
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
    /* Jede Berührung hält den Tonkanal offen. Nach einem Neuladen oder nach
       dem Entsperren ist er sonst zu, und eine wiederhergestellte Pause
       endete ohne Ton, bis der nächste Satz abgehakt wird. */
    <div className="mx-auto max-w-[520px] md:max-w-none" onPointerDown={tonVorbereiten}>
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
          fortschritt={
            kopfTon === "pause"
              ? Math.min(1, (pause! * 1000) / pauseDauer)
              : kopfTon === "vorbei"
                ? 1
                : 0
          }
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
              <Klein
                onClick={() => {
                  const neu = (pauseEnde ?? uhr()) + 30_000;
                  setPauseEnde(neu);
                  setPauseDauer(pauseDauer + 30_000);
                  pauseSchreiben({ ende: neu, dauer: pauseDauer + 30_000, einheit: session.key });
                  void satzpauseAnkuendigen(neu);
                }}
              >
                +30 s
              </Klein>
              <Klein
                beschriftung="Satzpause beenden und weitermachen"
                onClick={() => {
                  setPauseEnde(null);
                  setPauseVorbei(false);
                  pauseSchreiben(null);
                  void satzpauseAnkuendigen(null);
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
        {offline && (
          <p
            role="status"
            className="mt-4 rounded-sm border border-caution/30 bg-caution/10 px-3.5 py-2.5 text-xs leading-relaxed text-caution"
          >
            Kein Netz. Abgehakte Sätze bleiben auf dem Handy und gehen raus, sobald wieder
            Empfang da ist — auch wenn die App zwischendurch geschlossen wird.
          </p>
        )}
        {speicherFehler && (
          <p className="mt-4 rounded-sm border border-strain/30 bg-strain/10 px-3.5 py-2.5 text-xs leading-relaxed text-strain">
            Satz konnte nicht gespeichert werden: {speicherFehler} — er bleibt auf dem Handy
            und wird beim nächsten Öffnen der Trainingsseite erneut gesendet.
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

              {langhantel(ex) && saetze.length > 0 && (
                <Aufwaermen arbeitsKg={saetze[0].kg} />
              )}

              {saetze.map((satz, si) => (
                <SatzZeile
                  key={si}
                  langhantel={langhantel(ex)}
                  rekord={rekorde.has(`${i}-${si}`)}
                  nummer={si + 1}
                  prev={ex.prev[si]}
                  zielKg={satz.kg}
                  zielReps={satz.wdh}
                  amrap={satz.amrap}
                  vorgegeben={ex.programmSaetze.length > 0}
                  logged={logged[`${i}-${si}`]}
                  hervorgehoben={zuletzt === `${i}-${si}`}
                  onLog={(kg, reps) => abhaken(`${i}-${si}`, ex.name, si, kg, reps)}
                  onKorrigieren={() => korrigieren(`${i}-${si}`)}
                />
              ))}

              {/* Ohne Trainingsmax steht der Bank-Slot ohne Zahlen da. Die
                  Karte bleibt trotzdem, statt die Übung zu verstecken: dass
                  hier etwas fehlt, ist die Information.

                  Der Text steht auch dann, wenn kein Programm dahintersteckt.
                  Vorher hing er allein an programmHinweis, und eine Übung mit
                  null Sätzen aus anderem Grund — der Adductor kam so aus dem
                  MCP-Server — zeigte eine Tabellenkopfzeile mit nichts
                  darunter. Eine leere Tabelle sieht aus wie ein Ladefehler,
                  nicht wie eine Auskunft. */}
              {saetze.length === 0 && (
                <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
                  {ex.programmHinweis ??
                    "Für diese Übung sind heute keine Sätze hinterlegt. Setz die Satzanzahl im Katalog, dann steht sie beim nächsten Training hier."}
                </p>
              )}
            </Card>
          );
        })}

        {/* Vorher endete die Einheit damit, dass nichts mehr passierte. Ein
            Abschluss beantwortet die einzige Frage, die man am Ende hat: war
            das jetzt alles, und ist es angekommen. */}
        {/* Die Datenbank hat das letzte Wort. Hängt die Karte allein an den
            Haken, verschwindet sie, sobald sich der Plan nachträglich ändert —
            eine abgeschlossene Einheit sähe dann wieder offen aus, obwohl sie
            längst beendet wurde. */}
        {(alleSaetzeFertig || fertigSeit !== null) && (
          <Card className="border-ready/30">
            <Eyebrow>Einheit abgeschlossen</Eyebrow>
            <p className="mt-2 text-[15px] font-semibold tracking-[-0.015em]">
              {alleSaetzeFertig
                ? `Alle ${anzahl(saetzeGesamt, "Satz", "Sätze")} abgehakt`
                : `${anzahl(saetzeFertig, "Satz", "Sätze")} von ${saetzeGesamt} abgehakt`}
            </p>
            <div className="mt-3.5 flex gap-6">
              <Kennzahl
                label="Volumen"
                wert={Math.round(volumen).toLocaleString("de-AT")}
                einheit=" kg"
              />
              <Kennzahl label="Dauer" wert={mmss(laufzeit)} />
              {rekordUebungen.length > 0 && (
                <Kennzahl label="Bestwerte" wert={String(rekordUebungen.length)} />
              )}
            </div>
            {rekordUebungen.length > 0 && (
              <ul className="mt-3.5 flex flex-col gap-1.5">
                {rekordUebungen.map((r) => (
                  <li key={r.name} className="text-[13px] leading-relaxed text-fg-dim">
                    <b className="font-semibold text-accent">{r.name}</b> — geschätztes Maximum{" "}
                    {de(r.wert, 1)} kg, bisher {de(r.vorher, 1)} kg
                  </li>
                ))}
              </ul>
            )}
            <Notiz einheit={session.key} anfang={notiz} />
            <p className="mt-3.5 text-[11px] leading-relaxed text-fg-faint">
              Jeder Satz ist einzeln gespeichert, sobald du ihn abgehakt hast. Korrigieren
              geht weiterhin: Tipp auf den Haken oder ins Feld.
              {fertigSeit !== null && (
                <>
                  {" "}
                  Die Einheit ist um {uhrzeit(fertigSeit)} abgeschlossen worden — die Dauer
                  steht ab jetzt fest und läuft nicht weiter.
                </>
              )}
            </p>
          </Card>
        )}
      </div>

      {wechsel}
    </div>
  );
}

function SatzZeile({
  nummer,
  prev,
  zielKg,
  zielReps,
  amrap = false,
  vorgegeben = false,
  logged,
  hervorgehoben,
  langhantel = false,
  rekord = false,
  onLog,
  onKorrigieren,
}: {
  nummer: number;
  /** Langhantelübung: dann steht unter dem Satz, welche Scheiben drauf gehören. */
  langhantel?: boolean;
  /** Schwerer als alles bisher (geschätztes Maximum) — siehe rekorde im Logger. */
  rekord?: boolean;
  prev?: string;
  zielKg: number;
  zielReps: number;
  /** Satz auf Maximalwiederholungen: zielReps ist die Untergrenze, nicht das Ziel. */
  amrap?: boolean;
  /**
   * Ein Programm gibt den Satz vor — beim 5/3/1 rechnet sich das Gewicht aus
   * dem Trainingsmax und ist für jeden Satz ein anderes. Dann stehen die Werte
   * im Feld statt bloß als Platzhalter dahinter.
   */
  vorgegeben?: boolean;
  logged?: Logged;
  hervorgehoben: boolean;
  onLog: (kg: number, reps: number) => void;
  onKorrigieren: () => void;
}) {
  /* Bei einer vorgegebenen Übung stehen Gewicht und Wiederholungen schon im
     Feld: beim Bankdrücken hat jeder der drei Sätze ein eigenes Gewicht
     (65/75/85 % des Trainingsmax), und das im Gym aus einem Platzhalter
     abzutippen ist genau das Rechnen, das das Programm abnehmen soll.

     Der AMRAP-Satz ist die Ausnahme. Seine Wiederholungen sind kein Ziel,
     sondern die Messung, aus der der nächste Trainingsmax folgt. Stünde dort
     die Untergrenze schon drin, wäre ein Satz mit acht Wiederholungen mit
     einem Tipp als Fünfer gespeichert — der Trainingsmax bliebe stehen, und
     niemand sähe, warum. Das Gewicht steht auch dort im Feld, nur die Zahl
     der Wiederholungen bleibt leer. */
  const [kg, setKg] = useState(vorgegeben ? String(zielKg).replace(".", ",") : "");
  const [reps, setReps] = useState(vorgegeben && !amrap ? String(zielReps) : "");
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

      {(langhantel || rekord) && (
        <ScheibenZeile
          kg={fertig ? logged!.kg : Number((kg || String(zielKg)).replace(",", ".")) || 0}
          langhantel={langhantel}
          rekord={rekord}
        />
      )}

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

/**
 * Ist das eine Langhantelübung? Beim 5/3/1-Bankdrücken immer, sonst wenn die
 * Notiz im Katalog es sagt ("Langhantel, Flachbank"). Maschinen und Kurzhanteln
 * brauchen keinen Scheibenrechner.
 */
function langhantel(ex: PlannedExercise): boolean {
  return ex.programmSaetze.length > 0 || /langhantel/i.test(ex.note ?? "");
}

/**
 * Die Zeile unter einem Satz: Scheiben je Seite, und ob es ein Bestwert ist.
 *
 * Steht unter dem Satz statt in einem eigenen Rechner: das Gewicht kommt
 * beim 5/3/1 aus dem Programm und ist für jeden Satz ein anderes. Ein Rechner,
 * in den man es erst eintippt, wäre wieder die Kopfrechnung, die er
 * abnehmen soll.
 */
function ScheibenZeile({
  kg,
  langhantel,
  rekord,
}: {
  kg: number;
  langhantel: boolean;
  rekord: boolean;
}) {
  const b = langhantel ? beladung(kg) : null;
  return (
    <p className="col-span-5 -mt-0.5 flex items-center justify-between gap-2 pb-1 pl-[34px] text-[11px] leading-relaxed text-fg-faint">
      <span>
        {b && (
          <>
            je Seite <b className="font-semibold text-fg-dim">{beladungText(b)}</b>
            {b.rest > 0 && <> (+{de(b.rest, 2)} kg gehen nicht auf)</>}
          </>
        )}
      </span>
      {rekord && <Tag tone="akzent">Bestwert</Tag>}
    </p>
  );
}

/**
 * Die Aufwärmtreppe vor dem ersten Arbeitssatz, eingeklappt.
 *
 * Nicht abhakbar und nicht gespeichert: Aufwärmsätze sind keine Messung, und
 * sie mitzuloggen hieße, dass sie in Volumen und Kraftverlauf auftauchen.
 */
function Aufwaermen({ arbeitsKg }: { arbeitsKg: number }) {
  const saetze = aufwaermen(arbeitsKg);
  if (saetze.length === 0) return null;
  return (
    <details className="group mt-3 rounded-sm bg-surface-2/60 px-3 py-2">
      <summary className="flex min-h-[32px] cursor-pointer list-none items-center justify-between text-[12px] font-semibold text-fg-dim">
        Aufwärmen bis {de(arbeitsKg, 1)} kg
        <span aria-hidden className="text-fg-faint transition group-open:rotate-90">›</span>
      </summary>
      <ol className="mt-1.5 flex flex-col gap-1 pb-1">
        {saetze.map((s, i) => {
          const b = beladung(s.kg);
          return (
            <li key={i} className="flex items-baseline justify-between gap-3 text-[12px] tabular-nums">
              <span className="text-fg">
                {de(s.kg, 1)} kg × {s.wdh}
              </span>
              <span className="text-fg-faint">{b ? beladungText(b) : ""}</span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

/**
 * Freitext zur Einheit, gespeichert beim Verlassen des Felds.
 *
 * Kein Speichern-Knopf: nach dem letzten Satz tippt man zwei Worte und
 * steckt das Handy weg. Ein Knopf, den man dabei vergisst, wäre eine Notiz,
 * die es nie gab.
 */
function Notiz({ einheit, anfang }: { einheit: "push" | "pull"; anfang: string | null }) {
  const [text, setText] = useState(anfang ?? "");
  const [gespeichert, setGespeichert] = useState(anfang ?? "");
  const [stand, setStand] = useState<"ruhe" | "speichert" | "fehler">("ruhe");

  async function sichern() {
    if (text.trim() === gespeichert.trim()) return;
    setStand("speichert");
    const r = await notizSpeichern(einheit, text);
    if (r.ok) {
      setGespeichert(text);
      setStand("ruhe");
    } else {
      setStand("fehler");
    }
  }

  return (
    <div className="mt-3.5">
      <label htmlFor="einheit-notiz" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
        Notiz
      </label>
      <textarea
        id="einheit-notiz"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={sichern}
        rows={2}
        maxLength={1000}
        placeholder="Wie lief's? Etwa: Schulter zwickt, Bank war belegt"
        className="mt-1.5 w-full resize-none rounded-sm border border-transparent bg-surface-3 px-3 py-2.5 text-base leading-snug outline-none placeholder:text-fg-faint focus:border-accent"
      />
      <p className="mt-1 h-4 text-[11px] text-fg-faint" role="status">
        {stand === "speichert"
          ? "Speichert…"
          : stand === "fehler"
            ? "Nicht gespeichert — beim nächsten Verlassen des Felds erneut."
            : text.trim() !== "" && text.trim() === gespeichert.trim()
              ? "Gespeichert."
              : ""}
      </p>
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

/** Uhrzeit in Wiener Zeit — der Server läuft auf Vercel in UTC. */
function uhrzeit(ms: number): string {
  return new Date(ms).toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Vienna",
  });
}

/**
 * Dauer als m:ss, ab einer Stunde als h:mm:ss.
 *
 * Die Stundenstufe fehlte. Eine Einheit von knapp zwei Stunden stand damit als
 * "116:00" da — richtig gerechnet und trotzdem nicht lesbar; man zählt im Kopf
 * durch 60. Vorher fiel es kaum auf, weil eine Einheit ohne Abschluss ohnehin
 * bis in absurde Zahlen weiterlief.
 *
 * Die Satzpause benutzt dieselbe Funktion und bleibt unverändert: drei Minuten
 * erreichen die Stundenstufe nie.
 */
function mmss(s: number): string {
  const min = Math.floor(s / 60);
  const sek = String(s % 60).padStart(2, "0");
  if (min < 60) return `${min}:${sek}`;
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}:${sek}`;
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
  wechsel,
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
  /** Der Weg zur anderen Einheit, fertig gerendert von der Seite. */
  wechsel?: ReactNode;
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
        {anzahl(uebungen.length, "Übung", "Übungen")} · {anzahl(saetze, "Satz", "Sätze")} ·
        Satzpause 3 Minuten
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

      {wechsel}

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

/**
 * Hält den Bildschirm an, solange die Einheit läuft — wenn es in den
 * Einstellungen so gewählt ist.
 *
 * Standard ist aus: ein Bildschirm, der eine Stunde lang leuchtet, kostet
 * spürbar Akku, und mit der Push-Nachricht am Pausenende braucht es ihn
 * nicht. Wer lieber auf die Uhr schaut als auf eine Nachricht, schaltet es
 * ein. Safari hebt die Sperre auf, sobald die App in den Hintergrund geht,
 * daher wird sie beim Zurückkommen neu angefordert.
 */
function useBildschirmAn(laeuft: boolean) {
  useEffect(() => {
    if (!laeuft || !geraetLesen("wachhalten") || !("wakeLock" in navigator)) return;

    let sperre: WakeLockSentinel | null = null;
    let aus = false;

    async function anfordern() {
      // Hält die Sperre noch, keine zweite anfordern — die erste liefe sonst
      // ungesehen weiter und würde beim Aufräumen nicht freigegeben.
      if (sperre && !sperre.released) return;
      try {
        const neu = await navigator.wakeLock.request("screen");
        if (aus) void neu.release();
        else sperre = neu;
      } catch {
        // Akku-Sparmodus oder nicht sichtbar — dann eben nicht.
      }
    }

    const sichtbar = () => {
      if (document.visibilityState === "visible") void anfordern();
    };

    void anfordern();
    document.addEventListener("visibilitychange", sichtbar);
    return () => {
      aus = true;
      document.removeEventListener("visibilitychange", sichtbar);
      void sperre?.release();
    };
  }, [laeuft]);
}
