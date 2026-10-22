import { Suspense } from "react";
import { Eyebrow } from "@/components/ui";

type Suchparameter = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * Anmeldung, wenn KADENZ_PASSWORT gesetzt ist — siehe lib/zugang.ts.
 *
 * Ein schlichtes HTML-Formular an /api/anmelden, ohne JavaScript und ohne
 * Server Action (warum, steht in der Route). Einmal je Gerät. Auf dem iPhone
 * hat die installierte App einen eigenen Cookie-Speicher, getrennt von
 * Safari: wer Kadenz zum Home-Bildschirm hinzufügt, meldet sich dort ein
 * zweites Mal an.
 */
export default function Anmelden({ searchParams }: { searchParams: Suchparameter }) {
  return (
    <div className="mx-auto max-w-[420px] pt-16">
      <Eyebrow>Kadenz</Eyebrow>
      <h1 className="mt-2 text-[27px] font-bold tracking-[-0.025em]">Anmelden</h1>
      <p className="mt-3 text-sm leading-relaxed text-fg-dim">
        Kadenz zeigt Gesundheitsdaten und nimmt Trainingseinträge an — deshalb nur mit
        Passwort. Einmal pro Gerät, danach bleibt es ein Jahr angemeldet.
      </p>
      <Suspense fallback={null}>
        <Formular searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Formular({ searchParams }: { searchParams: Suchparameter }) {
  const { weiter, fehler } = await searchParams;

  return (
    <form method="post" action="/api/anmelden" className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="weiter" value={typeof weiter === "string" ? weiter : "/"} />
      <label
        className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint"
        htmlFor="passwort"
      >
        Passwort
      </label>
      <input
        id="passwort"
        name="passwort"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        aria-invalid={fehler ? true : undefined}
        aria-describedby={fehler ? "anmelde-fehler" : undefined}
        className="min-h-[52px] rounded-md border border-transparent bg-surface-3 px-4 text-base outline-none focus:border-accent"
      />
      {fehler && (
        <p id="anmelde-fehler" role="alert" className="text-xs text-strain">
          Das Passwort stimmt nicht.
        </p>
      )}
      <button
        type="submit"
        className="mt-2 flex min-h-[52px] items-center justify-center rounded-md bg-accent font-semibold text-on-accent transition active:scale-[0.98]"
      >
        Anmelden
      </button>
    </form>
  );
}
