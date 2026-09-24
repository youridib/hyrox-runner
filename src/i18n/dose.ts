import type { Station, StationDose } from '../domain/types';

/**
 * Rendering for station doses.
 *
 * The domain emits a station key and its numbers; the words live here, once
 * per language, so a compromised-run block reads naturally without the
 * planner ever knowing what language it is being read in.
 */
export interface DoseWords {
  stations: Record<Station, string>;
  /** "100 wall balls" - the noun after the count. */
  reps: string;
  /** "@ 24 kg each hand" - the qualifier for a two-handed carry. */
  perHand: string;
  /** "to 3.0 m" - the wall-ball target height. */
  to: string;
}

export function renderDose(dose: StationDose, words: DoseWords): string {
  const name = words.stations[dose.station];
  const parts: string[] = [];

  if (dose.reps !== undefined) parts.push(`${dose.reps} ${name}`);
  else if (dose.meters !== undefined) parts.push(`${dose.meters} m ${name}`);
  else parts.push(name);

  if (dose.weightKg !== undefined) {
    parts.push(`@ ${dose.weightKg} kg${dose.perHand ? ` ${words.perHand}` : ''}`);
  }
  if (dose.heightM !== undefined) parts.push(`${words.to} ${dose.heightM.toFixed(1)} m`);

  return parts.join(' ');
}

/** A whole block, in race order, as one readable line. */
export const renderBlock = (block: readonly StationDose[], words: DoseWords): string =>
  block.map((dose) => renderDose(dose, words)).join(' → ');
