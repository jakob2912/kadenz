"use client";

import { useEffect, useSyncExternalStore, useState } from "react";

/**
 * Meldet den Service Worker an (public/sw.js).
 *
 * Ohne ihn gibt es auf dem iPhone keine Push-Nachrichten, und ohne Netz zeigt
 * die installierte App die leere Safari-Fehlerseite statt einer Auskunft.
 * `updateViaCache: "none"`, damit eine neue sw.js nicht im HTTP-Cache hängen
 * bleibt — der Worker cacht selbst nichts, aber eine veraltete Version könnte
 * Push-Nachrichten falsch anzeigen.
 */
export function SwRegistrierung() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((e) => console.error("Service Worker nicht angemeldet:", e));
  }, []);
  return null;
}

/** Läuft Kadenz als installierte App vom Home-Bildschirm? */
export function istInstalliert(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari kennt display-mode erst seit iOS 17 zuverlässig; das alte Flag
    // ist der Rückfall.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function istIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS meldet sich als Mac, hat aber Touch.
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

const WEGGEKLICKT = "kadenz_installhinweis_weg";

function nichts() {
  return () => {};
}

/**
 * Hinweis auf der Startseite, solange Kadenz im Safari-Tab läuft.
 *
 * Auf dem iPhone ist "Zum Home-Bildschirm" der einzige kostenlose Weg zu
 * einer App ohne Browser-Leiste — und die Voraussetzung für Push-Nachrichten.
 * Safari bietet die Installation nicht von sich aus an; ohne diesen Hinweis
 * findet man sie nur, wenn man weiß, dass es sie gibt.
 *
 * useSyncExternalStore statt useEffect + setState: am Server ist die Antwort
 * immer "nicht zeigen", im Browser die echte — ohne dass beim Hydrieren
 * erst etwas anderes dasteht.
 */
export function InstallHinweis({ className = "" }: { className?: string }) {
  const zeigen = useSyncExternalStore(
    nichts,
    () => {
      try {
        if (localStorage.getItem(WEGGEKLICKT)) return false;
      } catch {
        // Privates Fenster: dann eben jedes Mal.
      }
      return istIos() && !istInstalliert();
    },
    () => false
  );
  const [weg, setWeg] = useState(false);

  if (!zeigen || weg) return null;

  return (
    <section className={`rounded-lg border border-accent/30 bg-accent/5 p-5 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
        Als App installieren
      </p>
      <p className="mt-2 text-sm leading-relaxed text-fg-dim">
        In Safari unten auf <b className="font-semibold text-fg">Teilen</b> tippen, dann{" "}
        <b className="font-semibold text-fg">„Zum Home-Bildschirm“</b>. Danach startet Kadenz
        ohne Browser-Leiste wie eine App — und nur so kann es dir Nachrichten schicken
        (Satzpause vorbei, Morgen-Briefing).
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(WEGGEKLICKT, "1");
          } catch {}
          setWeg(true);
        }}
        className="mt-3 min-h-[44px] text-[13px] font-semibold text-fg-faint active:text-fg"
      >
        Nicht mehr anzeigen
      </button>
    </section>
  );
}
