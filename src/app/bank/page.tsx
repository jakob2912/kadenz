import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { bankuebersicht, type Bankeinheit, type Wochenvorschau } from "@/lib/bankuebersicht";
import { behauptetesMaximum, type Trainingsmax } from "@/lib/bank";
import { PRESSVARIANTEN, PRESS_NAMEN, type Pressvariante } from "@/lib/kraft";
import { ZIEL_DATUM, ZIEL_KG, ZIEL_TM_KG, zielSatz, type Zielstand } from "@/lib/bankziel";
import { BankTrainingsmax } from "@/components/bank-trainingsmax";
import { ReihenChart } from "@/components/reihen-chart";
import { Card, Eyebrow, Skelett, Tag, anzahl, de, kurzDatum, langDatum } from "@/components/ui";

/**
 * Der Bankdrücken-Tab.
 *
 * Getrennt vom Verlauf, obwohl es dort längst eine Seite je Übung gibt
 * (/verlauf/[uebung]). Der Unterschied ist nicht die Übung, sondern die Frage:
 * /verlauf beantwortet "wie läuft diese Übung", hier steht ein Programm mit
 * Zyklus, Woche, Trainingsmax und einem Ziel mit Datum. Drei Varianten gehören
 * zusammen gelesen, und eine Vorschau auf die nächste Programmwoche hat auf
 * einer generischen Verlaufsseite nichts verloren.
 *
 * Die Hülle ist vorgerendert, alles Datengebundene strömt nach — dasselbe
 * Muster wie auf den übrigen Seiten.
 */
export default function Bank() {
  return (
    <div className="mx-auto max-w-[520px] md:max-w-[1180px]">
      <header className="pt-10 md:pt-14">
        <Eyebrow>Bankdrücken</Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold tracking-[-0.025em] md:text-[33px]">
          5/3/1 und die Varianten
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
          Die Bankdaten sind gerade nicht lesbar. Versuch es gleich noch einmal — geloggt
          ist trotzdem alles, was du geloggt hast.
        </p>
      </Card>
    );
  }

  if (daten.tm === null) {
    return (
      <>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-fg-dim">
          Das Programm läuft noch nicht. Langhantel-Bankdrücken hat in Kadenz keine
          Historie, aus der sich ein Trainingsmax schätzen ließe — er ist die Grundlage
          sämtlicher Prozente und wird einmalig eingetragen.
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
        />
        <Vorschau wochen={daten.vorschau} standTag={daten.standTag} />
        <TmHistorie historie={daten.historie} />
      </div>

      <div className="flex flex-col gap-3.5">
        {daten.ziel && <Ziel stand={daten.ziel} />}
        <Varianten heute={daten.heute} gewicht={daten.arbeitsgewicht} />
        <Verlauf einheiten={daten.einheiten} />
      </div>
    </div>
  );
}

/** Wo der Zyklus steht. */
function Stand({ tm, zyklus, woche }: { tm: Trainingsmax; zyklus: number; woche: number }) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Aktueller Stand</Eyebrow>
        <span className="text-[11px] tabular-nums text-fg-faint">
          Zyklus {zyklus} · Woche {woche} von 4
        </span>
      </div>

      <p className="mt-2 text-[27px] font-bold leading-none tracking-[-0.03em]">
        {de(tm.tmKg, 1)} kg
      </p>
      <p className="mt-1.5 text-[13px] text-fg-dim">
        Trainingsmax — entspricht einem Maximum von rund{" "}
        <b className="font-semibold text-fg">{de(behauptetesMaximum(tm.tmKg), 1)} kg</b>.
      </p>

      {/* Vier Balken, einer je Programmwoche. Die Deload-Woche ist auch dann
          eingefärbt, wenn sie nicht die laufende ist: dass sie leicht ist, ist
          ihr Zweck und keine Lücke im Plan. */}
      <div className="mt-3.5 flex gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((w) => (
          <div
            key={w}
            className={`h-1.5 flex-1 rounded-full ${
              w === woche ? "bg-accent" : w === 4 ? "bg-caution/30" : "bg-surface-3"
            }`}
          />
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
        Gültig seit {kurzDatum(tm.gueltigAb)}. {tm.begruendung}
      </p>
    </Card>
  );
}

/** Was das Programm als nächstes vorgibt. */
function Vorschau({ wochen, standTag }: { wochen: Wochenvorschau[]; standTag: string }) {
  if (wochen.length === 0) return null;

  return (
    <Card>
      <Eyebrow>Programmiert</Eyebrow>
      <div className="mt-3 flex flex-col gap-4">
        {wochen.map((w, i) => (
          <div key={`${w.zyklus}-${w.woche}`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-semibold tracking-[-0.015em]">
                {i === 0 && w.datum === standTag ? "Nächste Einheit" : kurzDatum(w.datum)}
                <span className="ml-2 font-normal text-fg-faint">
                  Zyklus {w.zyklus} · Woche {w.woche}
                </span>
              </p>
              {w.deload && <Tag tone="warnung">Deload</Tag>}
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
              {w.deload
                ? "Bewusst leicht, kein Satz auf Maximalwiederholungen. Die Woche ist zum Zurücknehmen da."
                : "Der letzte Satz geht auf Maximalwiederholungen — aus ihm rechnet Kadenz den nächsten Trainingsmax."}
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
      <Eyebrow>Trainingsmax-Historie</Eyebrow>
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
                Zyklus {h.zyklus}
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
          von {de(ZIEL_TM_KG, 1)} kg Trainingsmax
        </span>
      </p>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className="h-full rounded-full bg-accent" style={{ width: `${anteil}%` }} />
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-fg-dim">{zielSatz(stand)}</p>

      <div className="mt-4">
        <ReihenChart
          reihe={stand.kurve.map((p) => ({ datum: p.datum, wert: p.tmKg }))}
          bezeichnung="Erwartete Trainingsmax-Kurve"
          einheit="kg"
          /* Großzügig, weil zwischen zwei Punkten 24 Tage liegen — das ist der
             Zyklus und keine Messlücke. Beim Vorgabewert von drei Tagen
             zerfiele die Treppe in lauter Einzelpunkte. */
          lueckeTage={40}
          leer="Noch kein Trainingsmax."
          einzeln="Das Ziel ist erreicht."
        />
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">
        Die Stufen sind der Bestfall: jeder Zyklus gelingt, keiner bleibt stehen. Verfehlt
        ein Satz auf Maximalwiederholungen sein Soll, setzt das Programm den Trainingsmax
        zurück — das ist eingeplant und schiebt die Kurve nach rechts.
      </p>
    </Card>
  );
}

/**
 * Die drei Varianten: was sie sind, wie sie ausgeführt werden, was sie steuert.
 *
 * Steht auf diesem Tab und nicht als Notiz an der Übung im Trainings-Logger.
 * Im Gym liest niemand drei Absätze, dort zählt die Zahl im Feld — die Notiz
 * dort ist deshalb eine Zeile lang. Nachschlagen, wie eine Spoto Press
 * eigentlich geht, tut man dazwischen, und dazwischen ist man hier.
 *
 * Die heute anstehende Variante steht oben und ist hervorgehoben: die Frage
 * "was mache ich heute und wie" ist die häufigste, mit der man das aufschlägt.
 */
function Varianten({
  heute,
  gewicht,
}: {
  heute: Pressvariante | null;
  gewicht: Partial<Record<Pressvariante, number>>;
}) {
  const sortiert = [...PRESS_NAMEN].sort((a, b) =>
    a === heute ? -1 : b === heute ? 1 : 0
  );

  return (
    <Card>
      <Eyebrow>Die drei Varianten</Eyebrow>

      <div className="mt-3 flex flex-col gap-4">
        {sortiert.map((name) => {
          const v = PRESSVARIANTEN[name];
          const aktiv = name === heute;

          return (
            <div
              key={name}
              className="border-t border-hair-soft pt-3.5 first:border-0 first:pt-0"
            >
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="text-[15px] font-semibold tracking-[-0.015em]">{v.lang}</span>
                <Tag tone={v.schwer ? "akzent" : "gut"}>{v.kurz}</Tag>
                {aktiv && <Tag tone="warnung">heute</Tag>}
              </div>

              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-[11px] uppercase tracking-[0.11em] text-fg-faint">
                  {v.wann}
                </p>
                {/* Beim schweren Bankdrücken steht das Gewicht satzweise in
                    der Vorschau — hier eine einzelne Zahl danebenzustellen
                    wäre eine zweite Meinung darüber, was aufliegt. */}
                <p className="text-[13px] font-semibold tabular-nums">
                  {v.schwer ? (
                    <span className="text-[11px] font-normal text-fg-faint">
                      Gewicht aus dem Trainingsmax
                    </span>
                  ) : gewicht[name] !== undefined ? (
                    <>
                      {de(gewicht[name]!, 1)} kg
                      <span className="ml-1.5 text-[11px] font-normal text-fg-faint">
                        aktuell
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] font-normal text-fg-faint">
                      noch keine Ausführung geloggt
                    </span>
                  )}
                </p>
              </div>

              <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">{v.ausfuehrung}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-fg-faint">{v.steuerung}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Alle drei Varianten chronologisch. */
function Verlauf({ einheiten }: { einheiten: Bankeinheit[] }) {
  if (einheiten.length === 0) {
    return (
      <Card>
        <Eyebrow>Verlauf</Eyebrow>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-dim">
          Noch keine Bankeinheit geloggt. Sobald der erste Satz steht, läuft hier die
          Zeitleiste — schwer, Paused und Spoto nebeneinander.
        </p>
      </Card>
    );
  }

  const unsauberDabei = einheiten.some((e) => e.unsauber);

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>Verlauf</Eyebrow>
        <span className="text-[11px] text-fg-faint">
          {anzahl(einheiten.length, "Einheit", "Einheiten")}
        </span>
      </div>

      <ol className="mt-3 flex flex-col gap-3">
        {einheiten.map((e) => (
          <li
            key={`${e.datum}-${e.uebung}`}
            className="border-t border-hair-soft pt-3 first:border-0 first:pt-0"
          >
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="text-[13px] font-semibold tracking-[-0.015em]">
                {kurzDatum(e.datum)}
              </span>
              <Tag tone={e.schwer ? "akzent" : "gut"}>{e.kurz}</Tag>
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
          Ein Stern markiert einen Satz, dessen Form nicht gestanden hat. Solche Sätze
          bleiben sichtbar, zählen aber weder für das geschätzte Maximum noch für die
          Fortschreibung des Trainingsmax.
        </p>
      )}

      <Link
        href="/verlauf/Bankdr%C3%BCcken"
        className="mt-3.5 inline-flex min-h-[36px] items-center text-[13px] font-semibold text-accent md:hover:underline"
      >
        Kraftverlauf des schweren Bankdrückens →
      </Link>
    </Card>
  );
}
