import { rotationMitPlan } from "./wochenplan";
import { heutigeEinheit } from "./training-lesen";
import { offenerVorschlag } from "./ernaehrung";
import { offeneDinge, type AbendLage } from "./benachrichtigung-texte";

/**
 * Was heute noch offen ist — für die Zahl am App-Symbol und die
 * Abend-Nachricht, damit beide aus derselben Lage rechnen.
 */
export async function heutigeLage(): Promise<AbendLage> {
  const [rotation, einheit, vorschlag] = await Promise.all([
    rotationMitPlan(new Date()),
    heutigeEinheit(),
    offenerVorschlag(),
  ]);
  return {
    plan:
      rotation.art === "training"
        ? { art: "training", einheit: rotation.einheit }
        : { art: "pause", naechste: rotation.naechste },
    trainiertHeute: einheit !== null,
    kalorienvorschlagOffen: vorschlag !== null,
  };
}

export async function abzeichenZahl(): Promise<number> {
  return offeneDinge(await heutigeLage());
}
