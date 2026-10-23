"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useOffline } from "next/offline";
import { heutigeSaetze, type Einheitskopf, type PlannedExercise } from "@/lib/plan";
import { useRouter } from "next/navigation";
import {
  notizSpeichern,
  satzSpeichern,
  trainingBeenden,
  trainingStarten,
} from "@/lib/workouts";
import type { GeloggterSatz } from "@/lib/training-lesen";
import {
  BESTWERT_TEXT,
  bestwertArt,
  staerke,
  wdhFuerBestwert,
  type Bestwert,
  type BestwertArt,
} from "@/lib/bestwerte";
import { Card, Eyebrow, Tag, anzahl, de, uebungsVorschau } from "@/components/ui";
import { eigenesPushAbo, geraetLesen, pauseVorbeiSignal, tonVorbereiten } from "@/lib/geraet";
import { satzpauseAnkuendigen } from "@/lib/push-actions";
import { uebungNotizSetzen } from "@/lib/uebung-actions";
import {
  ausgangAblegen,
  ausgangErledigt,
  ausgangOffen,
  pauseLesen,
  pauseSchreiben,
  type OffenerSatz,
} from "@/lib/ablage";
import { wienerDatum } from "@/lib/datum";
import { aufwaermen } from "@/lib/hantel";

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
  satzSpeichern(satz)
    .then((r) => {
      if (r.ok) ausgangErledigt(satz);
      melden(r.ok ? null : r.fehler);
    })
    // Abgelaufene Anmeldung (401 vom Proxy) oder ein Wurf der Aktion: der
    // Satz bleibt im Ausgang, und die Meldung sagt es, statt still zu bleiben.
    .catch((e: unknown) => melden(e instanceof Error ? e.message : "Server nicht erreichbar"));
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
  tag = null,
  wechsel,
}: {
  uebungen: PlannedExercise[];
  session: Einheitskopf;
  /**
   * Bisherige Bestwerte je Übung, ohne heute — siehe bestwerteFuer() in
   * training-lesen.ts. Fehlt eine Übung, gibt es für sie keinen Bestwert: der
   * erste Satz einer neuen Übung ist kein Rekord, sondern der Anfang.
   */
  bestwerte?: Record<string, Bestwert>;
  /** Die Notiz zur Einheit, falls heute schon eine geschrieben wurde. */
  notiz?: string | null;
  /** Kalendertag der Einheit aus der Datenbank; null, wenn sie nicht lesbar war. */
  tag?: string | null;
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
  /* Das Push-Abo dieses Geräts — die Satzpause-Nachricht geht nur hierhin.
     Als Ref, weil es nur beim Abhaken gelesen wird und nichts rendert. */
  const pushAbo = useRef<string | null>(null);
  useEffect(() => {
    void eigenesPushAbo().then((e) => {
      pushAbo.current = e;
    });
  }, []);

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
     Markierung von selbst wieder.

     Je Übung höchstens eine Markierung, am stärksten Rekord-Satz des Tages.
     Sonst trügen bei einem guten Tag beide Sätze das Abzeichen, obwohl der
     zweite den ersten gar nicht übertroffen hat. */
  const rekorde = new Map<string, BestwertArt>();
  const rekordUebungen: { name: string; art: BestwertArt; satz: Logged }[] = [];
  uebungen.forEach((ex, i) => {
    let bester: { key: string; art: BestwertArt; satz: Logged } | null = null;
    heutigeSaetze(ex).forEach((_, si) => {
      const key = `${i}-${si}`;
      const satz = logged[key];
      const art = satz ? bestwertArt(satz, bestwerte[ex.name]) : null;
      if (satz && art && (!bester || staerke(satz) > staerke(bester.satz))) {
        bester = { key, art, satz };
      }
    });
    if (bester) {
      const { key, art, satz } = bester;
      rekorde.set(key, art);
      rekordUebungen.push({ name: ex.name, art, satz });
    }
  });

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
    void trainingBeenden(session.key, undefined, Date.now(), tag ?? undefined).then((r) => {
      if (!abgebrochen && r.ok) setFertigSeit(r.finishedAtMs);
    });

    return () => {
      abgebrochen = true;
    };
  }, [alleSaetzeFertig, fertigSeit, session.key, tag]);

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
    const t = uhr();
    /* Ist die Einheit schon beendet, ist das ein Nachtrag, kein Satz im Gym:
       keine Satzpause und keine Pausen-Nachricht drei Minuten später. */
    const nachtrag = fertigSeit !== null;
    if (!nachtrag) {
      setPauseVorbei(false);
      setJetzt(t);
      setPauseEnde(t + PAUSE_SEKUNDEN * 1000);
      setPauseDauer(PAUSE_SEKUNDEN * 1000);
      pauseSchreiben({ ende: t + PAUSE_SEKUNDEN * 1000, dauer: PAUSE_SEKUNDEN * 1000, einheit: session.key });
      tonVorbereiten();
    }
    // Der Text enthält Übung und Satznummer, damit er sich zwischen zwei
    // Sätzen unterscheidet — gleicher Text wird von Screenreadern nicht
    // erneut vorgelesen.
    const rekord = bestwertArt({ kg, reps }, bestwerte[exercise]);
    setAnsage(
      `${exercise}, Satz ${setIndex + 1} gespeichert.${
        rekord ? ` Bestwert: ${BESTWERT_TEXT[rekord]}.` : ""
      }${nachtrag ? "" : " Satzpause drei Minuten."}`
    );

    // Erst der Satz, dann die Ankündigung: Next arbeitet Server Actions
    // nacheinander ab, und der Satz soll nicht auf die Pausen-Nachricht warten.
    senden({ kind: session.key, exercise, setIndex, kg, reps, erfasstAm: t }, setSpeicherFehler);
    // Für den gesperrten Bildschirm: der Server schickt am Ende eine
    // Push-Nachricht, falls sie eingeschaltet ist. Scheitert das, läuft der
    // Timer hier trotzdem — die Nachricht ist Zugabe, nicht Grundlage.
    if (!nachtrag) {
      satzpauseAnkuendigen(t + PAUSE_SEKUNDEN * 1000, pushAbo.current).catch(() => {});
    }
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
                  satzpauseAnkuendigen(neu, pushAbo.current).catch(() => {});
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
                  satzpauseAnkuendigen(null).catch(() => {});
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
                  {/* Begründung der Progression und Notiz stehen getrennt.
                      Vorher verdrängte die eine die andere — an jedem Tag mit
                      Gewichtsänderung war die Notiz ("Sitz Stufe 4") weg,
                      genau dann, wenn man neu einstellt. */}
                  {ex.grund && (
                    <span className="mt-0.5 block text-xs text-fg-faint">{ex.grund}</span>
                  )}
                  <UebungsNotiz einheit={session.key} name={ex.name} anfang={ex.note ?? null} />
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

              {/* Aufwärmen nur, wo ein Programm die Sätze vorgibt (Bankdrücken
                  5/3/1): dort beginnt die Einheit direkt mit 65–85 % des
                  Trainingsmax, und die Treppe davor rechnet man sonst im Kopf. */}
              {ex.programmSaetze.length > 0 && saetze.length > 0 && (
                <Aufwaermen arbeitsKg={saetze[0].kg} />
              )}

              {saetze.map((satz, si) => (
                <SatzZeile
                  key={si}
                  bestwert={satz.amrap ? bestwerte[ex.name] : undefined}
                  rekord={rekorde.get(`${i}-${si}`) ?? null}
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
        {/* Die Notiz steht immer da, nicht erst nach dem letzten Haken: gerade
            wenn eine Übung ausfällt (Gerät belegt), will man das festhalten —
            und dann kommt der letzte Haken nie. */}
        {tag && (
          <Card>
            <Notiz einheit={session.key} tag={tag} anfang={notiz} />
          </Card>
        )}

        {!alleSaetzeFertig && fertigSeit === null && saetzeFertig > 0 && (
          <EinheitBeenden
            offen={saetzeGesamt - saetzeFertig}
            onBeenden={async () => {
              const r = await trainingBeenden(session.key, undefined, Date.now(), tag ?? undefined);
              if (r.ok) {
                setFertigSeit(r.finishedAtMs);
                setPauseEnde(null);
                pauseSchreiben(null);
                satzpauseAnkuendigen(null).catch(() => {});
              }
              return r.ok ? null : r.fehler;
            }}
          />
        )}

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
                    <b className="font-semibold text-accent">{r.name}</b> —{" "}
                    {de(r.satz.kg, r.satz.kg % 1 === 0 ? 0 : 1)} kg × {r.satz.reps},{" "}
                    {BESTWERT_TEXT[r.art]}
                  </li>
                ))}
              </ul>
            )}
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
  bestwert,
  rekord = null,
  onLog,
  onKorrigieren,
}: {
  nummer: number;
  /**
   * Beim AMRAP-Satz: so viele Wiederholungen wären ein Bestwert. Das ist beim
   * 5/3/1 der eigentliche Antrieb des letzten Satzes — Wendler nennt genau
   * diese Zahl als Ziel, über das Minimum hinaus.
   */
  bestwert?: Bestwert;
  /** Bestwert-Art dieses Satzes, falls es der Rekord-Satz des Tages ist. */
  rekord?: BestwertArt | null;
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
  /* Aus dem Gewicht, das im Feld steht, nicht aus dem geplanten: wer die
     Stange leichter oder schwerer belädt, braucht eine andere Zahl. Nur
     solange der Satz offen ist — danach sagt das Abzeichen, ob es gereicht hat. */
  const bestwertZiel =
    bestwert && !logged
      ? wdhFuerBestwert(Number((kg || String(zielKg)).replace(",", ".")) || 0, bestwert)
      : null;
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

      {(rekord !== null || bestwertZiel !== null) && (
        <SatzHinweis rekord={rekord} ziel={bestwertZiel} minimum={zielReps} />
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
 * Die Zeile unter einem Satz: Bestwert erreicht, oder beim offenen
 * AMRAP-Satz, wie viele Wiederholungen dafür nötig wären.
 */
function SatzHinweis({
  rekord,
  ziel,
  minimum,
}: {
  rekord: BestwertArt | null;
  ziel: number | null;
  minimum: number;
}) {
  return (
    <p className="col-span-5 -mt-0.5 flex items-center justify-between gap-2 pb-1.5 pl-[34px] text-[13px] leading-relaxed text-fg-dim">
      <span>
        {ziel !== null &&
          (ziel <= minimum ? (
            <>
              Bestwert <b className="font-semibold text-accent">schon mit {minimum} Wdh</b>
            </>
          ) : (
            <>
              Bestwert ab <b className="font-semibold text-accent">{ziel} Wdh</b>
            </>
          ))}
      </span>
      {rekord && (
        <span className="flex flex-col items-end gap-0.5">
          <Tag tone="akzent">Bestwert</Tag>
          <span className="text-[11px] text-fg-faint">{BESTWERT_TEXT[rekord]}</span>
        </span>
      )}
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
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between text-[13px] font-semibold text-fg-dim">
        Aufwärmen bis {de(arbeitsKg, 1)} kg
        <span aria-hidden className="text-fg-faint transition group-open:rotate-90">›</span>
      </summary>
      <ol className="mt-1.5 flex flex-col gap-1 pb-1">
        {saetze.map((s, i) => (
          <li key={i} className="text-[14px] tabular-nums text-fg">
            {de(s.kg, 1)} kg × {s.wdh}
          </li>
        ))}
      </ol>
    </details>
  );
}

/**
 * Freitext zur Einheit, gespeichert während man tippt.
 *
 * Kein Speichern-Knopf und nicht nur beim Verlassen des Felds: auf dem iPhone
 * kommt das Verlassen nicht zuverlässig an, wenn man den Bildschirm sperrt
 * oder die App wechselt — genau das, was man nach zwei getippten Worten tut.
 * Deshalb speichert die Notiz kurz nach der letzten Eingabe, sofort beim
 * Wegwechseln, und liegt bis zum Ja des Servers als Entwurf im localStorage.
 * Beendet iOS die App ohne Netz, geht der Entwurf beim nächsten Öffnen raus.
 */
function Notiz({
  einheit,
  tag,
  anfang,
}: {
  einheit: "push" | "pull";
  tag: string;
  anfang: string | null;
}) {
  const id = useId();
  const ablage = `kadenz_notiz_${tag}_${einheit}`;
  const [text, setText] = useState(anfang ?? "");
  const [stand, setStand] = useState<"ruhe" | "speichert" | "gespeichert" | "fehler">("ruhe");
  const gespeichert = useRef(anfang ?? "");
  const aktuell = useRef(text);

  async function sichern() {
    const inhalt = aktuell.current;
    if (inhalt.trim() === gespeichert.current.trim()) return;
    setStand("speichert");
    try {
      const r = await notizSpeichern(einheit, tag, inhalt);
      if (!r.ok && r.fehler.startsWith("Zu diesem Tag gibt es keine Einheit")) {
        // Kommt nie mehr an — den Entwurf nicht bei jedem Laden neu schicken.
        try {
          localStorage.removeItem(ablage);
        } catch {}
      }
      if (!r.ok) throw new Error(r.fehler);
      gespeichert.current = inhalt;
      try {
        if (localStorage.getItem(ablage) === inhalt) localStorage.removeItem(ablage);
      } catch {}
      setStand("gespeichert");
    } catch {
      setStand("fehler");
    }
  }

  /* Ein Entwurf vom letzten Mal, der nie beim Server ankam, hat Vorrang vor
     dem Stand der Datenbank — er ist jünger. */
  useEffect(() => {
    let entwurf: string | null = null;
    try {
      entwurf = localStorage.getItem(ablage);
    } catch {}
    if (entwurf === null || entwurf === gespeichert.current) return;
    const t = setTimeout(() => {
      aktuell.current = entwurf;
      setText(entwurf);
      void sichern();
    }, 0);
    return () => clearTimeout(t);
    // Einmal beim Laden — sichern() liest ohnehin über Refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ablage]);

  // Kurz nach der letzten Eingabe speichern.
  useEffect(() => {
    if (text.trim() === gespeichert.current.trim()) return;
    const t = setTimeout(() => void sichern(), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Beim Wegwechseln sofort — der Timer oben läuft im Hintergrund nicht mehr.
  useEffect(() => {
    const weg = () => {
      if (document.visibilityState === "hidden") void sichern();
    };
    document.addEventListener("visibilitychange", weg);
    window.addEventListener("pagehide", weg);
    return () => {
      document.removeEventListener("visibilitychange", weg);
      window.removeEventListener("pagehide", weg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint">
        Notiz zur Einheit
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => {
          aktuell.current = e.target.value;
          setText(e.target.value);
          setStand("ruhe");
          try {
            localStorage.setItem(ablage, e.target.value);
          } catch {}
        }}
        onBlur={() => void sichern()}
        rows={2}
        maxLength={1000}
        placeholder="Wie lief's? Etwa: Schulter zwickt, Bank war belegt"
        className="mt-1.5 w-full resize-none rounded-sm border border-transparent bg-surface-3 px-3 py-2.5 text-base leading-snug outline-none placeholder:text-fg-faint focus:border-accent"
      />
      {/* Nur Ergebnis und Fehler werden angesagt, nicht jedes "Speichert…" —
          sonst redet ein Screenreader nach jeder Tipp-Pause dazwischen. */}
      <p className="mt-1 min-h-4 text-[12px] text-fg-faint" aria-live={stand === "speichert" ? "off" : "polite"}>
        {stand === "speichert"
          ? "Speichert…"
          : stand === "fehler"
            ? "Noch nicht gespeichert — bleibt auf dem Handy und geht beim nächsten Versuch raus."
            : stand === "gespeichert"
              ? "Gespeichert."
              : ""}
      </p>
    </div>
  );
}

/**
 * Die Einheit beenden, obwohl nicht alles abgehakt ist.
 *
 * Bisher endete eine Einheit nur über den letzten Haken. War ein Gerät
 * belegt und die Übung fiel aus, kam der nie: die Laufzeit lief bis in den
 * Abend weiter, die Dauer im Verlauf war Unsinn, und die Einheit sah am
 * nächsten Morgen noch offen aus.
 *
 * Zwei Tipps statt einem, weil der Knopf unter dem letzten Satz liegt — ein
 * versehentlicher Tipp beim Scrollen soll keine Einheit beenden, in der noch
 * drei Übungen anstehen.
 */
function EinheitBeenden({
  offen,
  onBeenden,
}: {
  offen: number;
  onBeenden: () => Promise<string | null>;
}) {
  const [fragen, setFragen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  if (!fragen) {
    return (
      <button
        type="button"
        onClick={() => setFragen(true)}
        className="flex min-h-[48px] items-center justify-center rounded-md border border-hair text-sm font-semibold text-fg-dim transition active:scale-[0.98] md:hover:text-fg"
      >
        Einheit beenden
      </button>
    );
  }

  return (
    <div className="rounded-md border border-hair p-3.5">
      <p className="text-[13px] leading-relaxed text-fg-dim">
        {anzahl(offen, "Satz ist", "Sätze sind")} noch offen. Trotzdem beenden? Die offenen
        Sätze fallen dann weg; beim nächsten Mal plant Kadenz wieder alle.
      </p>
      <div className="mt-3 flex gap-2.5">
        <button
          type="button"
          disabled={laeuft}
          onClick={async () => {
            setLaeuft(true);
            try {
              setFehler(await onBeenden());
            } catch (e) {
              // Abgelaufene Anmeldung oder kein Netz — der Knopf darf nicht
              // für immer auf "Wird beendet…" stehen bleiben.
              setFehler(e instanceof Error ? e.message : "Server nicht erreichbar");
            } finally {
              setLaeuft(false);
            }
          }}
          className="flex min-h-[48px] flex-1 items-center justify-center rounded-md bg-accent text-sm font-semibold text-on-accent transition active:scale-[0.98] disabled:opacity-60"
        >
          {laeuft ? "Wird beendet…" : "Ja, beenden"}
        </button>
        <button
          type="button"
          onClick={() => setFragen(false)}
          className="flex min-h-[48px] flex-1 items-center justify-center rounded-md bg-surface-2 text-sm font-semibold text-fg transition active:scale-[0.98]"
        >
          Weitertrainieren
        </button>
      </div>
      {fehler && <p className="mt-2 text-xs text-strain">Nicht beendet: {fehler}</p>}
    </div>
  );
}

/**
 * Die Notiz einer Übung, im Logger änderbar.
 *
 * Gehört zur Übung, nicht zur Einheit — sie steht beim nächsten Training
 * wieder da. Ein Tipp öffnet das Feld; gespeichert wird mit "Fertig" oder
 * Enter. Hier mit Knopf statt automatisch wie bei der Einheitsnotiz: die
 * Zeile ist kurz, und ein halb getipptes "Sitz Stu" soll nicht schon beim
 * nächsten Training dastehen.
 */
function UebungsNotiz({
  einheit,
  name,
  anfang,
}: {
  einheit: "push" | "pull";
  name: string;
  anfang: string | null;
}) {
  const [notiz, setNotiz] = useState(anfang);
  const [entwurf, setEntwurf] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const id = useId();
  const knopf = useRef<HTMLButtonElement>(null);

  /* Nach dem Schließen den Fokus zurück auf den Stift — sonst landet ein
     Screenreader nach dem Speichern irgendwo am Seitenanfang. */
  function schliessen() {
    setEntwurf(null);
    setFehler(null);
    setTimeout(() => knopf.current?.focus(), 0);
  }

  async function sichern() {
    if (entwurf === null || speichert) return;
    // Nichts geändert (etwa nur versehentlich geöffnet): schließen, ohne zu
    // schreiben.
    if (entwurf.trim() === (notiz ?? "")) {
      schliessen();
      return;
    }
    setSpeichert(true);
    const r = await uebungNotizSetzen(einheit, name, entwurf).catch(
      (e: unknown) => ({ ok: false as const, fehler: e instanceof Error ? e.message : "Server nicht erreichbar" })
    );
    setSpeichert(false);
    if (r.ok) {
      setNotiz(r.notiz);
      schliessen();
    } else {
      setFehler(r.fehler);
    }
  }

  if (entwurf !== null) {
    return (
      <span className="mt-1.5 flex flex-col gap-1.5">
        <label htmlFor={id} className="sr-only">
          Notiz zu {name}
        </label>
        <span className="flex gap-2">
          <input
            id={id}
            value={entwurf}
            onChange={(e) => setEntwurf(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void sichern();
              if (e.key === "Escape") schliessen();
            }}
            maxLength={300}
            enterKeyHint="done"
            autoFocus
            placeholder="z. B. Sitz Stufe 4, Griff eng"
            className="min-h-[44px] min-w-0 flex-1 rounded-sm border border-transparent bg-surface-3 px-2.5 text-base outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => void sichern()}
            disabled={speichert}
            className="min-h-[44px] shrink-0 rounded-sm bg-accent px-3 text-[13px] font-semibold text-on-accent disabled:opacity-60"
          >
            Fertig
          </button>
        </span>
        {/* Die iPhone-Tastatur hat kein Escape — ohne diesen Knopf käme man
            aus einem versehentlich geöffneten Feld nur über "Fertig" heraus. */}
        <button
          type="button"
          onClick={schliessen}
          className="-ml-1 min-h-[44px] self-start px-1 text-[13px] font-semibold text-fg-faint active:text-fg"
        >
          Abbrechen
        </button>
        {fehler && <span className="text-[11px] text-strain">{fehler}</span>}
      </span>
    );
  }

  return (
    <button
      ref={knopf}
      type="button"
      onClick={() => setEntwurf(notiz ?? "")}
      className="-my-1.5 -ml-1 mt-0 flex min-h-[44px] items-center gap-1.5 rounded-sm px-1 text-left text-xs text-fg-faint active:bg-surface-2"
      aria-label={notiz ? `Notiz zu ${name} ändern: ${notiz}` : `Notiz zu ${name} hinzufügen`}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </svg>
      <span className={notiz ? "text-fg-dim" : ""}>{notiz ?? "Notiz"}</span>
    </button>
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
