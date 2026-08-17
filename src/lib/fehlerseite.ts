/**
 * Lesbare Fehlerseite für die OAuth-Routen.
 *
 * Die beiden Google-Routen antworten dem Browser direkt, nicht der Oberfläche
 * — sie können also keine Komponente rendern. Ohne diese Seite bekäme man auf
 * Vercel die nackte Next-Fehlerseite mit "Internal Server Error" und müsste
 * für den Grund in die Logs schauen.
 *
 * Bewusst ohne Tailwind: die Antwort geht an Stellen raus, an denen das
 * Stylesheet der App nicht geladen ist.
 */

export type Fehleraktion = {
  text: string;
  href: string;
};

export function fehlerSeite(opts: {
  titel: string;
  nachricht: string;
  /** Voreinstellung 400 — der häufige Fall ist eine abgelehnte Anmeldung. */
  status?: number;
  aktion?: Fehleraktion;
}): Response {
  const { titel, nachricht, status = 400, aktion } = opts;

  const knopf = aktion
    ? `<p><a href="${escapeHtml(aktion.href)}" style="color:#a9c9ff">${escapeHtml(
        aktion.text
      )}</a></p>`
    : "";

  return new Response(
    `<!doctype html><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${escapeHtml(titel)}</title>
     <body style="background:#090b0d;color:#e9eef2;font:16px/1.6 -apple-system,system-ui,sans-serif;padding:2.5rem;max-width:38rem">
       <h1 style="font-size:1.35rem;letter-spacing:-.02em">${escapeHtml(titel)}</h1>
       <p style="color:#94a3ae">${escapeHtml(nachricht)}</p>
       ${knopf}
     </body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

/**
 * In die Meldung fließen fremde Texte ein — Google-Fehlerantworten und
 * Variablennamen. Ohne Maskierung wäre das eine Lücke für eingeschleustes
 * HTML.
 */
export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
