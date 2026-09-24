import type { EffectiveType, IntensityBand, SessionArgs, WeekIntensity } from './types';

/**
 * Weekly intensity accounting.
 *
 * Nothing used to count how hard the week actually was. The default template
 * places three Hyrox days and the planner fills the free days with intervals,
 * a tempo and a long or compromised run - six stressed days out of seven, and
 * per the Frontiers data the Hyrox days are not the easy ones: athletes rated
 * the stations as more demanding than the runs, and lactate peaked higher at
 * the stations (8.5 vs 7.7 mmol/L).
 */

/**
 * Hard for distribution purposes is a wider set than hard for spacing
 * purposes. Station work is high-intensity and has to be counted in the 20%,
 * but making it block adjacency would leave no feasible week, so the two
 * concepts are kept apart on purpose.
 */
export const INTENSITY_BANDS: Record<EffectiveType, IntensityBand | 'none'> = {
  race: 'hard',
  intervals: 'hard',
  compromised: 'hard',
  timeTrial: 'hard',
  hyrox: 'hard',
  tempo: 'moderate',
  long: 'easy',
  easy: 'easy',
  shakeout: 'easy',
  rest: 'none',
};

/**
 * Polarized distributions put roughly 20% of training time at high intensity.
 * The 2024 meta-analysis makes 80/20 a sane default rather than a law, so the
 * warning sits a little above it rather than at it.
 */
export const HARD_FRACTION_LIMIT = 0.3;

/**
 * How much of a session's clock time is actually spent at the intensity its
 * band describes.
 *
 * A running session is what it says it is. A Hyrox session is not: an hour in
 * the gym is work sets, rests between them and technique, and it is the work
 * sets that hit 8.5 mmol/L. Counting the whole hour as hard made every week
 * the planner can produce read as overloaded, which is a warning that says
 * nothing. Half the hour is the honest number, and it still counts station
 * work as hard - which is the point the review makes.
 */
const WORKING_SHARE: Partial<Record<EffectiveType, number>> = {
  hyrox: 0.5,
};

export const bandOf = (type: EffectiveType): IntensityBand | 'none' =>
  INTENSITY_BANDS[type] ?? 'easy';

export interface PlannedSession {
  effectiveType: EffectiveType;
  session: { args: SessionArgs };
}

/** Sums a week's planned minutes by band and reports the hard fraction. */
export function weekIntensity(days: readonly PlannedSession[]): WeekIntensity {
  let easyMin = 0;
  let moderateMin = 0;
  let hardMin = 0;

  for (const day of days) {
    const band = bandOf(day.effectiveType);
    const minutes = Math.max(0, Math.round(day.session.args.plannedMin));
    if (band === 'none') continue;

    const share = WORKING_SHARE[day.effectiveType] ?? 1;
    const atBand = Math.round(minutes * share);
    // Whatever is not at the session's own intensity is still time on your
    // feet, so it belongs in the easy column rather than vanishing from the
    // denominator.
    const rest = minutes - atBand;

    if (band === 'easy') easyMin += minutes;
    else if (band === 'moderate') {
      moderateMin += atBand;
      easyMin += rest;
    } else {
      hardMin += atBand;
      easyMin += rest;
    }
  }

  const totalMin = easyMin + moderateMin + hardMin;
  const hardFraction = totalMin === 0 ? 0 : hardMin / totalMin;

  return {
    easyMin,
    moderateMin,
    hardMin,
    totalMin,
    hardFraction,
    overloaded: hardFraction > HARD_FRACTION_LIMIT,
  };
}
