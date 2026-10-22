/**
 * Kadenz — Einstellungen, die an diesem Gerät hängen
 *
 * Ton, Vibration und "Bildschirm anlassen" sind Fragen des Handys, nicht der
 * Person: auf dem iPhone im Gym will man den Piepton, am Laptop daheim nicht.
 * Deshalb liegen sie im localStorage statt in der Datenbank.
 *
 * Jeder Zugriff ist in try/catch: im privaten Safari-Fenster wirft
 * localStorage, und eine Einstellung darf nie der Grund sein, warum der
 * Logger nicht lädt.
 */

export type GeraeteEinstellung = "ton" | "wachhalten";

const SCHLUESSEL: Record<GeraeteEinstellung, string> = {
  ton: "kadenz_ton",
  wachhalten: "kadenz_wachhalten",
};

/** Ohne Eintrag: Ton an (das Signal ist der Zweck), Bildschirm-an aus (Akku). */
const STANDARD: Record<GeraeteEinstellung, boolean> = {
  ton: true,
  wachhalten: false,
};

export function geraetLesen(name: GeraeteEinstellung): boolean {
  try {
    const wert = localStorage.getItem(SCHLUESSEL[name]);
    if (wert === null) return STANDARD[name];
    return wert === "an";
  } catch {
    return STANDARD[name];
  }
}

export function geraetSetzen(name: GeraeteEinstellung, an: boolean): void {
  try {
    localStorage.setItem(SCHLUESSEL[name], an ? "an" : "aus");
  } catch {
    // Nicht speicherbar — die Einstellung gilt dann nur bis zum Neuladen.
  }
}

// ─────────────────────────────────────────────────────────────
// Signal am Ende der Satzpause
// ─────────────────────────────────────────────────────────────

let audio: AudioContext | null = null;

/**
 * Den Tonkanal freischalten — muss in einem Tipp passieren.
 *
 * iOS erlaubt Ton aus einer Webseite nur, wenn der AudioContext während
 * einer Berührung angelegt oder fortgesetzt wurde. Der Tipp auf den Haken
 * ist dieser Moment; drei Minuten später darf der Countdown dann piepen.
 */
export function tonVorbereiten(): void {
  if (!geraetLesen("ton")) return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audio ??= new Ctor();
    /* Nicht nur "suspended": nach Sperren und Entsperren steht ein
       AudioContext auf iOS auf "interrupted" und bleibt stumm, bis er
       fortgesetzt wird. */
    if (audio.state !== "running") void audio.resume();
  } catch {
    audio = null;
  }
}

/**
 * Zwei kurze Töne und, wo es geht, Vibration.
 *
 * Vibration kennt nur Android — Safari hat navigator.vibrate nicht. Auf dem
 * iPhone übernimmt bei gesperrtem Bildschirm die Push-Nachricht; dieses
 * Signal ist für den Fall, dass Kadenz offen vor einem liegt.
 *
 * Steht der Stummschalter des iPhone auf lautlos, bleibt Web-Audio still —
 * absichtlich nicht umgangen: die Alternative (audioSession "playback")
 * hielte jedes Mal die Musik im Kopfhörer an.
 */
export function pauseVorbeiSignal(): void {
  try {
    navigator.vibrate?.([220, 110, 220]);
  } catch {}

  if (!geraetLesen("ton") || !audio) return;
  try {
    if (audio.state !== "running") void audio.resume();
    const start = audio.currentTime + 0.02;
    for (const [versatz, frequenz] of [
      [0, 880],
      [0.22, 1175],
    ] as const) {
      const osc = audio.createOscillator();
      const lautstaerke = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = frequenz;
      lautstaerke.gain.setValueAtTime(0.0001, start + versatz);
      lautstaerke.gain.exponentialRampToValueAtTime(0.25, start + versatz + 0.02);
      lautstaerke.gain.exponentialRampToValueAtTime(0.0001, start + versatz + 0.18);
      osc.connect(lautstaerke).connect(audio.destination);
      osc.start(start + versatz);
      osc.stop(start + versatz + 0.2);
    }
  } catch {}
}
