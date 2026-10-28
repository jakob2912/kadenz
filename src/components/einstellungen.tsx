"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
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
import { istInstalliert, istIos } from "@/components/pwa";

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

/** Gleicher Schlüssel? applicationServerKey kommt als ArrayBuffer zurück. */
function gleicherSchluessel(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  return x.every((v, i) => v === b[i]);
}

/**
 * Wie es um Push auf diesem Gerät steht — und das Abo dabei abgleichen.
 *
 * Auf dem iPhone gibt es PushManager nur in der installierten App. Im
 * Safari-Tab fehlt er ganz — dann ist "installieren" die Antwort, nicht
 * "wird nicht unterstützt".
 *
 * Abgleich: der Browser kann ein Abo haben, das der Server nicht (mehr)
 * kennt — nach einem 410 gelöscht, Datenbank neu, Schlüssel gewechselt. Die
 * Seite zeigte dann "an", und es kam nie etwas. Deshalb wird ein bestehendes
 * Abo bei jedem Öffnen erneut gemeldet (ein Upsert, harmlos), und eines mit
 * altem Schlüssel abgemeldet, damit "einschalten" wieder angeboten wird.
 */
async function standErmitteln(publicKey: string | null): Promise<Stand> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return istIos() && !istInstalliert() ? { art: "nicht-installiert" } : { art: "nicht-unterstuetzt" };
  }
  if (Notification.permission === "denied") return { art: "abgelehnt" };

  const reg = await navigator.serviceWorker.ready;
  const abo = await reg.pushManager.getSubscription();
  if (!abo) return { art: "aus" };

  if (publicKey && Notification.permission === "granted") {
    const schluessel = alsBytes(publicKey);
    const bisher = abo.options.applicationServerKey;
    /* Nur bei einem nachweislich anderen Schlüssel abmelden. Liefert der
       Browser gar keinen (null), ist das keine Abweichung — sonst würde ein
       funktionierendes Abo bei jedem Öffnen der Einstellungen gekündigt. */
    if (bisher && !gleicherSchluessel(bisher, schluessel)) {
      /* Neu abonnieren erst im Tipp: Safari nimmt subscribe() nur aus einer
         Berührung an. Bis dahin zeigt die Seite ehrlich "aus". Die alte Zeile
         beim Server muss mit weg: mit falschem Schlüssel antwortet Apple mit
         403, nicht mit 410, und sie würde sonst nie aufgeräumt. */
      await abo.unsubscribe();
      await aboEntfernen(abo.endpoint);
      return { art: "aus" };
    }
    const json = abo.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await aboSpeichern({ endpoint: json.endpoint, keys: json.keys });
  }
  return { art: "an", endpoint: abo.endpoint };
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
  /* Der öffentliche Schlüssel wird beim Laden geholt, nicht erst im Tipp:
     zwischen der Erlaubnis und subscribe() soll so wenig wie möglich liegen. */
  const schluessel = useRef<string | null>(null);

  useEffect(() => {
    let aus = false;
    void (async () => {
      const k = await pushSchluessel().catch(() => null);
      schluessel.current = k?.ok ? k.publicKey : null;
      const s = await standErmitteln(schluessel.current).catch(
        (): Stand => ({ art: "aus" })
      );
      if (!aus) setStand(s);
    })();
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

      if (!schluessel.current) {
        const k = await pushSchluessel();
        if (!k.ok) throw new Error(k.fehler);
        schluessel.current = k.publicKey;
      }

      const reg = await navigator.serviceWorker.ready;
      const abo = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: alsBytes(schluessel.current),
      });

      const json = abo.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await aboSpeichern({ endpoint: json.endpoint, keys: json.keys });
      if (!r.ok) {
        await abo.unsubscribe();
        throw new Error(r.fehler);
      }

      setStand({ art: "an", endpoint: abo.endpoint });
      setMeldung({ ton: "gut", text: "Turned on. Tap “Test notification” to check it." });
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
      const r = await aboEntfernen(stand.endpoint);
      if (!r.ok) throw new Error(r.fehler);
      setStand({ art: "aus" });
      router.refresh();
    } catch (e) {
      setMeldung({ ton: "fehler", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setArbeitet(false);
    }
  }

  async function testen() {
    setArbeitet(true);
    setMeldung(null);
    try {
      const r = await testNachricht();
      setMeldung(
        r.ok
          ? { ton: "gut", text: `On its way to ${r.zugestellt === 1 ? "one device" : `${r.zugestellt} devices`}.` }
          : { ton: "fehler", text: r.fehler }
      );
    } catch (e) {
      setMeldung({ ton: "fehler", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setArbeitet(false);
    }
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
          On iPhone, notifications only arrive in the installed app. In Safari, tap{" "}
          <b className="font-semibold text-fg">Share → “Add to Home Screen”</b> (Share
          is behind ••• since iOS 26), open Kadenz from there and turn it on here.
        </Hinweis>
      )}
      {stand.art === "nicht-unterstuetzt" && (
        <Hinweis>This browser can’t receive push notifications.</Hinweis>
      )}
      {stand.art === "abgelehnt" && (
        <Hinweis>
          Notifications are blocked for Kadenz. They can only be allowed in the
          system settings: Settings → Notifications → Kadenz.
        </Hinweis>
      )}

      {(stand.art === "aus" || stand.art === "an") && (
        <div className="flex gap-2.5">
          {stand.art === "aus" ? (
            <Knopf haupt onClick={einschalten} disabled={arbeitet}>
              {arbeitet ? "Turning on…" : "Turn on for this device"}
            </Knopf>
          ) : (
            <>
              <Knopf onClick={testen} disabled={arbeitet}>
                Test notification
              </Knopf>
              <Knopf onClick={ausschalten} disabled={arbeitet}>
                Turn off here
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
          titel="Rest over"
          text="Even with the screen locked — your phone can go in your pocket during rest."
        />
        <Schalter
          an={wahl.morgen}
          onChange={(an) => umschalten("morgen", an)}
          titel="Morning briefing"
          text="Between 6 and 7 am (summer time 7–8): recovery, today's session, whether your weight is missing, and whether Google needs reconnecting."
        />
        <Schalter
          an={wahl.abend}
          onChange={(an) => umschalten("abend", an)}
          titel="Evening reminder"
          text="Between 5 and 6 pm (summer time 6–7), only if a planned session hasn't started or a calorie suggestion is waiting."
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">
        {angemeldet.length === 0
          ? "No device registered yet."
          : `Registered: ${angemeldet.join(", ")}. The switches apply to all devices.`}
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
        titel="Sound when rest ends"
        text="Two short beeps while Kadenz is open. With the screen locked, the notification takes over."
      />
      <Schalter
        an={wach}
        onChange={(an) => setzen("wachhalten", an)}
        titel="Keep screen on during workouts"
        text="The screen stays on during a running session. Costs battery."
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
