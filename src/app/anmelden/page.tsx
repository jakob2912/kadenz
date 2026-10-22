import { Suspense } from "react";
import { Eyebrow } from "@/components/ui";
import { AnmeldeFormular } from "./formular";

type Suchparameter = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * Anmeldung, wenn KADENZ_PASSWORT gesetzt ist — siehe lib/zugang.ts.
 *
 * Einmal je Gerät. Auf dem iPhone hat die installierte App einen eigenen
 * Cookie-Speicher, getrennt von Safari: wer Kadenz zum Home-Bildschirm
 * hinzufügt, meldet sich dort ein zweites Mal an.
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
  const { weiter } = await searchParams;
  return <AnmeldeFormular weiter={typeof weiter === "string" ? weiter : "/"} />;
}
