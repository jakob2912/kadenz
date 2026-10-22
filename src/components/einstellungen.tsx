"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  aboEntfernen,
  aboSpeichern,
  benachrichtigungenSetzen,
  pushSchluessel,
  testNachricht,
} from "@/lib/push-actions";
import type { Benachrichtigungen } from "@/lib/push";
import { geraetLesen, geraetSetzen, type GeraeteEinstellung } from "@/lib/geraet";
import { istInstalliert } from "@/components/pwa";

/** VAPID-Schlüssel kommen als URL-sicheres Base64, PushManager will Bytes. */
function alsBytes(base64: string): Uint8Array<ArrayBuffer> {
  const auffuellen = "=".repeat((4 - (base64.length % 4)) % 4);
  const roh = atob((base64 + auffuellen).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(roh.length));
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
  return bytes;
}

type Stand =
  | { art: "laedt" }
  | { art: "nicht-installiert" }
  | { art: "nicht-unterstuetzt" }
  | { art: "abgelehnt" }
  | { art: "aus" }
  | { art: "an"; endpoint: string };

/**
 * Wie es um Push auf diesem Gerät steht.
 *
 * Auf dem iPhone gibt es PushManager nur in der installierten App. Im
 * Safari-Tab fehlt er ganz — dann ist "installieren" die Antwort, nicht
 * "wird nicht unterstützt".
 */
async function standErmitteln(): Promise<Stand> {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return ios && !istInstalliert() ? { art: "nicht-installiert" } : { art: "nicht-unterstuetzt" };
  }
  if (Notification.permission === "denied") return { art: "abgelehnt" };
  const reg = await navigator.serviceWorker.ready;
  const abo = await reg.pushManager.getSubscription();
  return abo ? { art: "an", endpoint: abo.endpoint } : { art: "aus" };
}

export function PushSchalter({
  einstellungen,
  angemeldet,
}: {
  einstellungen: Benachrichtigungen;
  angemeldet: string[];
}) {
  const router = useRouter();
  const [stand, setStand] = useState<Stand>({ art: "laedt" });
  const [arbeitet, setArbeitet] = useState(false);
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null);
  const [wahl, setWahl] = useState(einstellungen);

  useEffect(() => {
    let aus = false;
    void standErmitteln().then((s) => {
      if (!aus) setStand(s);
    });
    return () => {
      aus = true;
    };
  }, []);

  async function einschalten() {
    setArbeitet(true);
    setMeldung(null);
    try {
      /* Die Erlaubnis zuerst und direkt im Tipp: iOS fragt nur, wenn die
         Anfrage aus einer Berührung kommt, nicht nach einem await auf den
         Server. */
      const erlaubnis = await Notification.requestPermission();
      if (erlaubnis !== "granted") {
        setStand(erlaubnis === "denied" ? { art: "abgelehnt" } : { art: "aus" });
        return;
      }

      const schluessel = await pushSchluessel();
      if (!schluessel.ok) throw new Error(schluessel.fehler);

      const reg = await navigator.serviceWorker.ready;
      const abo = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: alsBytes(schluessel.publicKey),
      });

      const json = abo.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await aboSpeichern({ endpoint: json.endpoint, keys: json.keys });
      if (!r.ok) {
        await abo.unsubscribe();
        throw new Error(r.fehler);
      }

      setStand({ art: "an", endpoint: abo.endpoint });
      setMeldung({ ton: "gut", text: "Eingeschaltet. Tipp auf „Testnachricht“, um es zu prüfen." });
      router.refresh();
    } catch (e) {
      setMeldung({ ton: "fehler", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setArbeitet(false);
    }
  }

  async function ausschalten() {
    if (stand.art !== "an") return;
    setArbeitet(true);
    setMeldung(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      await (await reg.pushManager.getSubscription())?.unsubscribe();
      await aboEntfernen(stand.endpoint);
      setStand({ art: "aus" });
      router.refresh();
    } finally {
      setArbeitet(false);
    }
  }

  async function testen() {
    setArbeitet(true);
    setMeldung(null);
    const r = await testNachricht();
    setMeldung(
      r.ok
        ? { ton: "gut", text: `Unterwegs an ${r.zugestellt === 1 ? "ein Gerät" : `${r.zugestellt} Geräte`}.` }
        : { ton: "fehler", text: r.fehler }
    );
    setArbeitet(false);
  }

  async function umschalten(name: keyof Benachrichtigungen, an: boolean) {
    const neu = { ...wahl, [name]: an };
    setWahl(neu);
    const r = await benachrichtigungenSetzen(neu);
    if (!r.ok) {
      setWahl(wahl);
      setMeldung({ ton: "fehler", text: r.fehler });
    }
  }

  return (
    <div className="mt-3">
      {stand.art === "nicht-installiert" && (
        <Hinweis>
          Auf dem iPhone kommen Nachrichten nur in der installierten App. In Safari auf{" "}
          <b className="font-semibold text-fg">Teilen → „Zum Home-Bildschirm“</b> (Teilen
          liegt seit iOS 26 hinter •••), Kadenz von dort öffnen und hier einschalten.
        </Hinweis>
      )}
      {stand.art === "nicht-unterstuetzt" && (
        <Hinweis>Dieser Browser kann keine Push-Nachrichten empfangen.</Hinweis>
      )}
      {stand.art === "abgelehnt" && (
        <Hinweis>
          Nachrichten sind für Kadenz abgelehnt. Erlauben lässt es sich nur in den
          Systemeinstellungen: Einstellungen → Mitteilungen → Kadenz.
        </Hinweis>
      )}

      {(stand.art === "aus" || stand.art === "an") && (
        <div className="flex gap-2.5">
          {stand.art === "aus" ? (
            <Knopf haupt onClick={einschalten} disabled={arbeitet}>
              {arbeitet ? "Wird eingeschaltet…" : "Auf diesem Gerät einschalten"}
            </Knopf>
          ) : (
            <>
              <Knopf onClick={testen} disabled={arbeitet}>
                Testnachricht
              </Knopf>
              <Knopf onClick={ausschalten} disabled={arbeitet}>
                Hier ausschalten
              </Knopf>
            </>
          )}
        </div>
      )}

      {meldung && (
        <p
          role="status"
          className={`mt-3 text-xs leading-relaxed ${meldung.ton === "gut" ? "text-ready" : "text-strain"}`}
        >
          {meldung.text}
        </p>
      )}

      <div className="mt-4 flex flex-col divide-y divide-hair-soft border-t border-hair-soft">
        <Schalter
          an={wahl.satzpause}
          onChange={(an) => umschalten("satzpause", an)}
          titel="Satzpause vorbei"
          text="Auch bei gesperrtem Bildschirm — das Handy kann in der Pause in die Tasche."
        />
        <Schalter
          an={wahl.morgen}
          onChange={(an) => umschalten("morgen", an)}
          titel="Morgen-Briefing"
          text="Gegen 6–7 Uhr: Regeneration, heutige Einheit, ob das Gewicht fehlt, und ob Google neu verbunden werden muss."
        />
        <Schalter
          an={wahl.abend}
          onChange={(an) => umschalten("abend", an)}
          titel="Abend-Erinnerung"
          text="Gegen 17:30–18:30, nur wenn eine geplante Einheit noch nicht begonnen ist oder ein Kalorienvorschlag wartet."
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
        {angemeldet.length === 0
          ? "Noch kein Gerät angemeldet."
          : `Angemeldet: ${angemeldet.join(", ")}. Die Schalter gelten für alle Geräte.`}
      </p>
    </div>
  );
}

function nichts() {
  return () => {};
}

/** Ton und Bildschirm-an — Einstellungen dieses Handys, siehe lib/geraet.ts. */
export function GeraeteSchalter() {
  /* Gelesen über useSyncExternalStore: am Server gibt es kein localStorage,
     und ein Wert, der beim Hydrieren umspringt, ließe den Schalter kurz
     falsch stehen. Die Version zählt hoch, wenn ein Schalter bewegt wird. */
  const [version, setVersion] = useState(0);
  const ton = useSyncExternalStore(nichts, () => geraetLesen("ton"), () => true);
  const wach = useSyncExternalStore(nichts, () => geraetLesen("wachhalten"), () => false);

  function setzen(name: GeraeteEinstellung, an: boolean) {
    geraetSetzen(name, an);
    setVersion(version + 1);
  }

  return (
    <div className="mt-3 flex flex-col divide-y divide-hair-soft border-t border-hair-soft" data-v={version}>
      <Schalter
        an={ton}
        onChange={(an) => setzen("ton", an)}
        titel="Ton am Pausenende"
        text="Zwei kurze Töne, wenn Kadenz offen ist. Bei gesperrtem Bildschirm übernimmt die Nachricht."
      />
      <Schalter
        an={wach}
        onChange={(an) => setzen("wachhalten", an)}
        titel="Bildschirm im Training anlassen"
        text="Der Bildschirm geht während einer laufenden Einheit nicht aus. Kostet Akku."
      />
    </div>
  );
}

function Schalter({
  an,
  onChange,
  titel,
  text,
}: {
  an: boolean;
  onChange: (an: boolean) => void;
  titel: string;
  text: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3.5 py-3.5">
      <span className="min-w-0 flex-1">
        <b className="block text-[14px] font-semibold">{titel}</b>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-fg-faint">{text}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={an}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative mt-0.5 h-[30px] w-[50px] shrink-0 rounded-full transition-colors
                    peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent
                    ${an ? "bg-accent" : "bg-surface-3"}`}
      >
        <span
          className={`absolute top-[3px] h-6 w-6 rounded-full bg-fg transition-transform ${
            an ? "translate-x-[23px]" : "translate-x-[3px]"
          }`}
        />
      </span>
    </label>
  );
}

function Knopf({
  children,
  haupt = false,
  onClick,
  disabled,
}: {
  children: ReactNode;
  haupt?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[48px] flex-1 items-center justify-center rounded-md px-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60
                  ${haupt ? "bg-accent text-on-accent" : "bg-surface-2 text-fg"}`}
    >
      {children}
    </button>
  );
}

function Hinweis({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-fg-dim">{children}</p>;
}
