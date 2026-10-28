import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { loadDashboard } from "@/lib/health-service";
import { sollGewichtAm } from "@/lib/gewichtsplan";
import { briefing } from "@/lib/coach";
import { kalenderLesen } from "@/lib/wochenplan";
import { heutigeEinheit, laufendesTraining } from "@/lib/training-lesen";
import { SESSIONS, montagVon, rotationFor, wochenbilanz, type Rotation } from "@/lib/plan";
import { bankuebersicht } from "@/lib/bankuebersicht";
import { aktuellesZiel } from "@/lib/ernaehrung";
import { ferienAm } from "@/lib/schulferien";
import { lageHeute } from "@/lib/heute-lage";
import { wienerStunde } from "@/lib/datum";
import { InstallHinweis } from "@/components/pwa";
import {
  AbgelaufenHinweis,
  Card,
  EinstellungenLink,
  Eyebrow,
  Gauge,
  Skelett,
  Tag,
  alterLabel,
  anzahl,
  de,
  heuteWien,
  kurzDatum,
} from "@/components/ui";

/**
 * Die Startseite streamt vollständig.
 *
 * Sie hängt an Google Health (Ruhepuls, HRV, Gewicht), der Datenbank und
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
          {/* Dieselbe Gestalt wie die fertige Seite: Heute-Karte, Plan-Zeile,
              drei Kacheln — sonst springt alles beim Laden. */}
          <Skelett hoehe={230} className="mt-6" />
          <Skelett hoehe={84} className="mt-4" />
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <Skelett hoehe={112} />
            <Skelett hoehe={112} />
            <Skelett hoehe={112} className="col-span-2 md:col-span-1" />
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
     steht die nicht fest, und ein vorgerendertes "Good morning" wäre abends
     falsch. */
  await connection();

  const heuteIso = heuteWien();
  const [data, kalender, bank, kalorien] = await Promise.all([
    loadDashboard(30),
    kalenderLesen(),
    /* Bank und Kalorien sind Kacheln: fehlen sie, steht der Rest trotzdem. */
    bankuebersicht().catch((e) => {
      console.error("Bankübersicht nicht lesbar:", e);
      return null;
    }),
    aktuellesZiel().catch((e) => {
      console.error("Kalorienziel nicht lesbar:", e);
      return null;
    }),
  ]);
  const rotation = rotationFor(new Date(), kalender.wahlen, kalender.eintraege);
  const bilanz = wochenbilanz(heuteIso, kalender.wahlen, kalender.eintraege);

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

  // timeZone ausdrücklich gesetzt: ohne sie nimmt toLocaleDateString die
  // Serverzeit, und auf Vercel (UTC) steht ab 22:00 Wiener Zeit der Vortag da.
  const heuteDatum = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Vienna",
  });

  // Schulferien im Burgenland (lib/schulferien.ts) statt "Schulzeit" ab einem
  // festen Datum — das stand mitten in den Herbstferien da.
  const ferien = ferienAm(heuteIso);
  const phasenText = ferien
    ? `${ferien.name}${ferien.bis > heuteIso ? ` until ${kurzDatum(ferien.bis)}` : ""}`
    : "School";

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

  const gewicht = data.verbunden ? data.gewicht : null;
  const wochenGewichte = (gewicht?.reihe ?? []).filter(
    (w) => w.date >= montagVon(heuteIso) && w.date <= heuteIso
  );
  const wochenSchnitt =
    wochenGewichte.length > 0
      ? wochenGewichte.reduce((n, w) => n + w.kg, 0) / wochenGewichte.length
      : null;

  const lage = lageHeute({
    gewichtKg: gewicht ? (gewicht.schnitt7 ?? gewicht.aktuell?.kg ?? null) : null,
    sollKg: sollGewichtAm(heuteIso),
    bank: bank?.coach
      ? {
          lage: bank.coach.lage,
          vorschlag: bank.coach.vorschlag.text,
          zielImPlan: bank.ziel?.imPlan ?? null,
        }
      : null,
  });

  const kacheln = (
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
      <Kachel
        titel="Bench"
        wert={bank?.tm ? `${de(bank.tm.tmKg)} kg` : "—"}
        einheit="TM"
        text={
          bank?.pr
            ? `Best single ${de(bank.pr.kg)} kg${bank.schaetzung ? ` · est. max ${de(bank.schaetzung)} kg` : ""}`
            : bank?.schaetzung
              ? `Est. max ${de(bank.schaetzung)} kg`
              : "No training max yet."
        }
        href="/bank"
      />
      <Kachel
        titel="Calories"
        wert={kalorien ? kalorien.kcal.toLocaleString("en-GB") : "—"}
        einheit="kcal / day"
        text={kalorien ? `${Math.round(kalorien.eiweissG)} g protein` : "No calorie target set."}
        href="/ernaehrung"
      />
      <Kachel
        titel="This week"
        wert={wochenSchnitt !== null ? `${de(wochenSchnitt)} kg` : "—"}
        einheit="avg"
        text={`${bilanz.erledigt} of ${bilanz.geplant} sessions done${
          wochenGewichte.length > 0
            ? ` · ${anzahl(wochenGewichte.length, "weigh-in", "weigh-ins")}`
            : ""
        }`}
        href="/verlauf"
        breit
      />
    </div>
  );

  const lageKarte = (
    <Card className="mt-4" tone={lage.aufKurs ? "normal" : "warnung"}>
      <Eyebrow>On plan?</Eyebrow>
      <p className="mt-1.5 text-[15px] font-semibold leading-snug">{lage.titel}</p>
      {lage.schritte.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-2">
          {lage.schritte.map((t) => (
            <li key={t} className="border-l-2 border-caution/50 pl-3 text-[13px] leading-relaxed text-fg-dim">
              {t}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  if (!data.verbunden) {
    /* Training hängt nicht an Google — die Karte bleibt auch dann, wenn die
       Verbindung abgelaufen ist. Sonst stünde morgens nach dem wöchentlichen
       Ablauf gar nichts mehr darüber da, was heute ansteht. */
    return (
      <>
        {kopf}
        <HeuteKarte
          rotation={rotation}
          schonHeute={schonHeute}
          regeneration={null}
          befund={null}
          veraltet={false}
          heuteIso={heuteIso}
        />
        {lageKarte}
        {kacheln}
        <VerbindenKarte grund={data.grund} />
      </>
    );
  }

  const { heute, baseline } = data;

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

  /* Seit dem 28.10.2026 ein Dashboard: Training und Regeneration oben, dann
     ob alles nach Plan läuft, dann Bank, Kalorien und die Woche. Schlaf,
     Gewichtseingabe und Trend sind weg — Schlaf und Gewicht sieht Jakob in
     Google Health, und der Trend steckt in der Plan-Zeile. */
  return (
    <>
      {kopf}

      <InstallHinweis className="mt-6" />
      {data.abgelaufen && <AbgelaufenHinweis lage={data.abgelaufen} className="mt-6" />}

      <HeuteKarte
        rotation={rotation}
        schonHeute={schonHeute}
        regeneration={heute && baseline ? { ...heute.regeneration, datum: heute.date } : null}
        befund={schonHeute?.beendet ? null : (tagesBriefing?.befund ?? null)}
        veraltet={veraltet}
        heuteIso={heuteIso}
      />
      {lageKarte}
      {kacheln}
    </>
  );
}

/** Eine Zahl mit Beschriftung, antippbar zum zuständigen Tab. */
function Kachel({
  titel,
  wert,
  einheit,
  text,
  href,
  breit = false,
}: {
  titel: string;
  wert: string;
  einheit: string;
  text: string;
  href: string;
  breit?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-lg border border-hair bg-gradient-to-b from-surface-2 to-surface p-4
                  transition active:scale-[0.98] ${breit ? "col-span-2 md:col-span-1" : ""}`}
    >
      <Eyebrow>{titel}</Eyebrow>
      <p className="num mt-1.5 text-[22px] leading-tight">
        {wert}
        <span className="ml-1 text-[11px] font-medium text-fg-faint">{einheit}</span>
      </p>
      <p className="mt-1 text-[12px] leading-snug text-fg-dim">{text}</p>
    </Link>
  );
}

/**
 * Tageszeitabhängiger Gruß.
 *
 * Die Stunde wird ausdrücklich in Wiener Zeit bestimmt, nicht aus der
 * Serverzeit: auf Vercel laufen die Server in UTC, und dort stünde um
 * 8 Uhr früh sonst "Good night".
 *
 * Ausgelesen wird über formatToParts, nicht über Number(...format(...)):
 * de-AT formatiert eine Stunde als "18 Uhr", nicht als "18". Number("18 Uhr")
 * ist NaN, und jeder Vergleich gegen NaN ist falsch — damit fiel die Funktion
 * rund um die Uhr auf den letzten Zweig durch und grüßte auch um 14 Uhr mit
 * "Gute Nacht" (damals noch deutsch). formatToParts liefert die Stunde als eigenen Teil, ohne die
 * Beschriftung der Sprache.
 *
 * hourCycle: "h23" statt hour12: false, damit Mitternacht 0 ergibt und nicht
 * 24 — h24 wäre kein Treffer in den Bereichen unten.
 */
function gruss(): string {
  const stunde = wienerStunde();

  if (stunde >= 5 && stunde < 12) return "Good morning";
  if (stunde >= 12 && stunde < 18) return "Good afternoon";
  if (stunde >= 18 && stunde < 22) return "Good evening";
  return "Good night";
}

/** Der Zustand steht im Wort, nicht nur in der Farbe. */
function bandWort(band: "gut" | "mittel" | "schlecht"): string {
  if (band === "gut") return "recovered";
  if (band === "mittel") return "recovering";
  return "not recovered";
}

function bandTon(band: "gut" | "mittel" | "schlecht"): "gut" | "warnung" | "schlecht" {
  if (band === "gut") return "gut";
  if (band === "mittel") return "warnung";
  return "schlecht";
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
  let knopf: string | null;

  if (schonHeute) {
    titel = schonHeute.beendet ? `${name(schonHeute.art)} done` : `${name(schonHeute.art)} in progress`;
    text = SESSIONS[schonHeute.art].title;
    knopf = schonHeute.beendet ? "View session" : "Keep logging";
  } else if (rotation.art === "training") {
    // "Today" steht schon als Überschrift darüber.
    titel = name(rotation.einheit);
    text = SESSIONS[rotation.einheit].title;
    knopf = "Open workout";
  } else {
    /* Am Rest Day kein "Training öffnen": der Plan schlägt nichts vor. Wer
       trotzdem ins Gym geht, wählt die Einheit direkt — sie belegt dann den
       nächsten freien Platz der Woche (zuordnung() in plan.ts). */
    titel = "Rest Day";
    text = `Next up: ${name(rotation.naechste)} — ${SESSIONS[rotation.naechste].title}.`;
    knopf = null;
  }

  return (
    <section className="mt-6 rounded-lg border border-hair bg-gradient-to-b from-surface-2 to-surface p-5">
      <div className="flex items-center gap-5">
        {regeneration && <Gauge score={regeneration.score} band={regeneration.band} />}
        <div className="min-w-0 flex-1">
          <Eyebrow>Today</Eyebrow>
          <p className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.02em]">{titel}</p>
          <p className="mt-1 text-[13px] leading-snug text-fg-dim">{text}</p>
          {regeneration && (
            <div className="mt-2.5">
              <Tag tone={veraltet ? "warnung" : bandTon(regeneration.band)}>
                {veraltet ? `Night of ${alterLabel(regeneration.datum, heuteIso)}` : bandWort(regeneration.band)}
              </Tag>
            </div>
          )}
        </div>
      </div>

      {befund && <p className="mt-4 text-sm font-medium leading-relaxed text-fg">{befund}</p>}

      {knopf ? (
        <Link
          href="/training"
          className="mt-4 flex min-h-[52px] items-center justify-center rounded-md bg-accent text-base
                     font-semibold text-on-accent transition active:scale-[0.98]"
        >
          {knopf}
        </Link>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {(["push", "pull"] as const).map((e) => (
            <Link
              key={e}
              href={`/training?einheit=${e}`}
              className="flex min-h-[48px] items-center justify-center rounded-md bg-surface-3
                         text-sm font-semibold text-fg transition active:scale-[0.98]"
            >
              {name(e)} anyway
            </Link>
          ))}
        </div>
      )}
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
        Connect Google
      </a>
    </Card>
  );
}
