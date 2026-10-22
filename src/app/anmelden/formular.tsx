"use client";

import { useActionState } from "react";
import { anmelden, type AnmeldeStand } from "./aktion";

export function AnmeldeFormular({ weiter }: { weiter: string }) {
  const [stand, absenden, laeuft] = useActionState<AnmeldeStand, FormData>(anmelden, {
    fehler: null,
  });

  return (
    <form action={absenden} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="weiter" value={weiter} />
      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-faint" htmlFor="passwort">
        Passwort
      </label>
      <input
        id="passwort"
        name="passwort"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        aria-invalid={stand.fehler ? true : undefined}
        className="min-h-[52px] rounded-md border border-transparent bg-surface-3 px-4 text-base outline-none focus:border-accent"
      />
      {stand.fehler && (
        <p role="alert" className="text-xs text-strain">
          {stand.fehler}
        </p>
      )}
      <button
        type="submit"
        disabled={laeuft}
        className="mt-2 flex min-h-[52px] items-center justify-center rounded-md bg-accent font-semibold text-on-accent transition active:scale-[0.98] disabled:opacity-60"
      >
        {laeuft ? "Prüfe…" : "Anmelden"}
      </button>
    </form>
  );
}
