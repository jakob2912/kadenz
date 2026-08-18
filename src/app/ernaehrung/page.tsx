import { loadDashboard } from "@/lib/health-service";
import { datenbankKonfiguriert } from "@/lib/konfiguration";
import {
  aktuellesZiel,
  mahlzeitenLesen,
  vorschlagLage,
  zielHistorie,
  type Mahlzeitplan,
  type VorschlagLage,
  type Ziel,
} from "@/lib/ernaehrung";
import { KalorienVorschlag } from "@/components/kalorien-vorschlag";
import { Card, Eyebrow, Metric, alterLabel, de, heuteWien, kurzDatum } from "@/components/ui";

/* Ziel, Vorschlag und Gewichtsreihe ändern sich täglich und hängen am
   Cookie — nie cachen. */
export const dynamic = "force-dynamic";

const KCAL_PRO_G = { kohlenhydrate: 4, eiweiss: 4, fett: 9 } as const;

/**
 * Ab welcher Abweichung die Makrosumme neben der Kalorienzahl erwähnt wird.
 *
 * Ein paar Kalorien Unterschied sind Rundung und interessieren niemanden.
 * Wird es mehr, gehört dazugesagt, dass die Differenz aus dem Plan stammt —
 * sonst sieht es aus, als könnte die App nicht rechnen.
 */
const KCAL_TOLERANZ = 25;

export default async function Ernaehrung() {
  if (!datenbankKonfiguriert()) {
    return (
      <Meldung
        titel="Ernährungsplan braucht die Datenbank"
        text="DATABASE_URL ist nicht gesetzt. Plan, Ziel und Historie liegen in der Datenbank; ohne sie kann diese Seite nichts anzeigen."
      />
    );
  }

  let mahlzeiten: Mahlzeitplan[];
  let ziel: Ziel | null;
  let historie: Ziel[];
  try {
    [mahlzeiten, ziel, historie] = await Promise.all([
      mahlzeitenLesen(),
      aktuellesZiel(),
      zielHistorie(),
    ]);
  } catch (e) {
    // Lieber der Grund als ein 500: eine nicht erreichbare Datenbank sieht in
    // der nackten Fehlerseite genauso aus wie ein kaputter Build.
    return (
      <Meldung
        titel="Die Datenbank ist gerade nicht erreichbar"
        text={e instanceof Error ? e.message : String(e)}
      />
    );
  }

  /* Der Vorschlag hängt an der Gewichtsreihe, der Plan nicht. Ohne
     Google-Verbindung bleibt die Seite deshalb benutzbar — es fehlt nur der
     Coach-Teil, und der sagt dann selbst, warum. */
  const daten = await loadDashboard(30);
  const koerpergewichtKg = daten.verbunden ? (daten.gewicht.aktuell?.kg ?? null) : null;

  const lage: VorschlagLage = daten.verbunden
    ? await vorschlagLage({ gewicht: daten.gewicht.reihe, koerpergewichtKg })
    : {
        art: "kein-vorschlag",
        grund: `Ohne deinen Gewichtsverlauf kann ich nichts vorschlagen. ${daten.grund}`,
      };

  const heuteIso = heuteWien();

  return (
    <>
      <header className="pt-10 md:pt-14">
        <Eyebrow>Ernährung · Fitnessbell-Plan</Eyebrow>
        <h1 className="mt-1.5 text-[27px] font-bold leading-tight tracking-[-0.025em] md:text-[33px]">
          {ziel ? `${ziel.kcal} kcal` : "—"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-dim">
          {ziel
            ? `${quellenSatz(ziel.quelle)} · gilt seit ${alterLabel(ziel.gueltigAb, heuteIso)}.`
            : "Noch kein Kalorienziel hinterlegt."}
        </p>
      </header>

      <div className="mt-7 grid items-start gap-4 md:grid-cols-[0.95fr_1.05fr]">
        <div className="flex flex-col gap-3.5">
          {ziel && <MakroKarte ziel={ziel} koerpergewichtKg={koerpergewichtKg} />}

          {lage.art === "vorschlag" ? (
            <KalorienVorschlag vorschlag={lage.vorschlag} />
          ) : (
            <Card>
              {/* Neutraler Rahmen: "ich kann es noch nicht sagen" ist keine
                  Warnung und schon gar kein Zustand seines Körpers. Amber
                  wäre in dieser App beides. */}
              <Eyebrow>Kein Vorschlag</Eyebrow>
              <p className="mt-2 text-sm leading-relaxed text-fg-dim">{lage.grund}</p>
            </Card>
          )}

          {historie.length > 0 && <HistorieKarte historie={historie} heuteIso={heuteIso} />}
        </div>

        <div className="flex flex-col gap-3.5">
          {mahlzeiten.length === 0 ? (
            <Card>
              <Eyebrow>Mahlzeiten</Eyebrow>
              <p className="mt-2 text-sm leading-relaxed text-fg-dim">
                Es ist kein Ernährungsplan hinterlegt.
              </p>
            </Card>
          ) : (
            mahlzeiten.map((m) => <MahlzeitKarte key={m.name + m.fenster} mahlzeit={m} />)
          )}

          <p className="px-1 text-[11px] leading-relaxed text-fg-faint">
            Essensfenster 05:20–18:00. Die Makros oben sind Tagessummen aus dem Plan; auf
            einzelne Mahlzeiten ist er nicht aufgeschlüsselt, und Kadenz rechnet das nicht
            nach — geschätzte Zahlen pro Mahlzeit wären erfunden.
          </p>
        </div>
      </div>
    </>
  );
}

function MakroKarte({
  ziel,
  koerpergewichtKg,
}: {
  ziel: Ziel;
  koerpergewichtKg: number | null;
}) {
  const ausMakros =
    ziel.kohlenhydrateG * KCAL_PRO_G.kohlenhydrate +
    ziel.eiweissG * KCAL_PRO_G.eiweiss +
    ziel.fettG * KCAL_PRO_G.fett;
  const abweichung = ziel.kcal - ausMakros;

  return (
    <Card>
      <Eyebrow>Was du aktuell isst</Eyebrow>
      <div className="mt-3 flex flex-col gap-2.5">
        <Metric label="Kalorien" value={`${ziel.kcal} kcal`} />
        <Metric label="Kohlenhydrate" value={`${ziel.kohlenhydrateG} g`} />
        <Metric label="Eiweiß" value={`${ziel.eiweissG} g`} />
        <Metric label="Fett" value={`${ziel.fettG} g`} />
      </div>

      {koerpergewichtKg !== null && (
        <p className="mt-3.5 text-[11px] leading-relaxed text-fg-faint">
          Eiweiß entspricht {de(ziel.eiweissG / koerpergewichtKg, 2)} g pro kg bei{" "}
          {de(koerpergewichtKg, 1)} kg.
        </p>
      )}

      {Math.abs(abweichung) > KCAL_TOLERANZ && (
        // Die Zahlen stehen so im Plan. Ohne diesen Satz sieht die Differenz
        // aus wie ein Rechenfehler der App.
        <p className="mt-1.5 text-[11px] leading-relaxed text-fg-faint">
          Aus den Makros gerechnet sind es {ausMakros} kcal. Die Differenz von{" "}
          {Math.abs(abweichung)} kcal steht so im Plan von Fitnessbell — Kadenz rundet hier
          nichts weg.
        </p>
      )}
    </Card>
  );
}

function MahlzeitKarte({ mahlzeit }: { mahlzeit: Mahlzeitplan }) {
  return (
    <Card>
      <Eyebrow>
        {mahlzeit.name} · {mahlzeit.fenster}
      </Eyebrow>
      <ul className="mt-3 flex flex-col gap-2.5">
        {mahlzeit.zutaten.map((z) => (
          <li key={z.name} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-[13px] text-fg-dim">
              {z.name}
              {z.alternative && (
                <em className="block not-italic text-[11px] text-fg-faint">{z.alternative}</em>
              )}
            </span>
            <span className="whitespace-nowrap text-sm font-semibold">
              {mengeText(z.menge)} {z.einheit}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function HistorieKarte({ historie, heuteIso }: { historie: Ziel[]; heuteIso: string }) {
  return (
    <Card>
      <Eyebrow>Verlauf der Ziele</Eyebrow>
      <ol className="mt-3 flex flex-col gap-3">
        {historie.map((z) => (
          <li key={z.id} className="border-l-2 border-hair pl-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold">{z.kcal} kcal</span>
              <span className="whitespace-nowrap text-[11px] text-fg-faint">
                {z.gueltigAb === heuteIso ? "seit heute" : `seit ${kurzDatum(z.gueltigAb)}`}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-fg-faint">
              {z.kohlenhydrateG} g KH · {z.eiweissG} g EW · {z.fettG} g F ·{" "}
              {quellenSatz(z.quelle)}
            </p>
            {/* Die Begründung steht ausdrücklich mit in der Liste. Ein
                Kalorienziel ohne sein Warum ist in drei Monaten nur noch eine
                Zahl, die irgendwer irgendwann gesetzt hat. */}
            <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-fg-dim">
              {z.begruendung}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Meldung({ titel, text }: { titel: string; text: string }) {
  return (
    <div className="mx-auto max-w-[520px] pt-10 md:pt-14">
      <Eyebrow>Ernährung</Eyebrow>
      <h1 className="mt-2 text-[27px] font-bold leading-tight tracking-[-0.025em]">{titel}</h1>
      <p className="mt-3 text-sm leading-relaxed text-fg-dim">{text}</p>
    </div>
  );
}

function quellenSatz(quelle: string): string {
  if (quelle === "plan") return "Aus dem Plan übernommen";
  if (quelle === "coach") return "Von Kadenz vorgeschlagen, von dir bestätigt";
  if (quelle === "jakob") return "Von dir gesetzt";
  return quelle;
}

/** 150 statt 150,0 — aber 0,5 bleibt 0,5, falls im Plan je ein halber Löffel steht. */
function mengeText(menge: number): string {
  return Number.isInteger(menge) ? String(menge) : de(menge, 1);
}
