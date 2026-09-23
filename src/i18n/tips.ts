import type { EffectiveType } from '../domain/types';
import type { Language } from './index';

/**
 * Practical, do-this-today notes for each session type.
 *
 * Deliberately separate from the session copy: `details` says what the session
 * is, these say how to execute it well. Keyed by session type rather than by
 * phase variant, so there is one place to edit per kind of session and no
 * combinatorial explosion to keep in sync across two languages.
 */
export const TIPS: Record<Language, Record<EffectiveType, string[]>> = {
  en: {
    intervals: [
      'Warm up properly: 10 min easy, then 3 × 20 s build-ups. Cold legs turn rep 1 into a guess.',
      'Run every rep at the same pace. If the last one is your fastest, the first ones were too slow.',
      'If you cannot hold the pace, stop the session there. Two extra bad reps cost more than they add.',
      'Recovery jogs stay easy — they are recovery, not extra training.',
    ],
    tempo: [
      'Threshold is comfortably hard: you could say a short sentence, not hold a conversation.',
      'Settle into the pace over the first 2 min rather than hitting it from the first stride.',
      'Flat, uninterrupted ground beats a fast route with traffic lights.',
      'Finishing feeling you could have done a bit more is correct.',
    ],
    long: [
      'Conversational the whole way. If you are breathing hard, you are doing the wrong session.',
      'Take fluid from 45 min on, and practise whatever you plan to use on race day.',
      'Finish with 4 × 20 s strides to keep some turnover in the legs.',
      'Slower than you think is right is usually right.',
    ],
    compromised: [
      'This is the session that decides your race. Treat it as the priority of the week.',
      'Go straight from the last station into the run — no pause, that transition is the point.',
      'Expect the first 200 m to feel awful. Settle into target pace by 400 m.',
      'Use race weights and race shoes. Rehearse what you will actually do.',
    ],
    hyrox: [
      'This is a strength day, not a run day. Keep running load off it.',
      'Leave a day between this and your next hard run if you can.',
      'Technique under fatigue is what transfers — finish sets clean rather than grinding reps.',
      'Expect the next run to feel heavier than usual. That is the session working, not a problem.',
    ],
    shakeout: [
      'Full rest is a legitimate choice today. If in doubt, take it.',
      'If you run, keep it genuinely easy and short — this is not a training stimulus.',
      'A few strides are fine; anything that raises your breathing is not.',
      'Good day for mobility, sleep and food.',
    ],
    rest: [
      'Adaptation happens now, not during the session. Rest is the training.',
      'Walking, mobility and stretching are fine. Nothing that raises your heart rate much.',
      'Prioritise sleep and eating properly — they do more than any session you could add.',
      'Feeling restless is normal. It is not a reason to train.',
    ],
    race: [
      'Warm up thoroughly: 10–15 min easy, strides, and rehearse the first station.',
      'Even splits. The first kilometre should feel easy — adrenaline hides the cost.',
      'Out of every station, settle back to pace within 100 m rather than sprinting.',
      'Nothing new today: same shoes, same fuel, same routine you practised.',
    ],
  },
  nl: {
    intervals: [
      'Warm goed op: 10 min rustig, dan 3 × 20 s opbouwend. Koude benen maken rep 1 een gok.',
      'Loop elke herhaling op hetzelfde tempo. Is de laatste je snelste, dan waren de eerste te traag.',
      'Houd je het tempo niet, stop dan de sessie. Twee slechte extra reps kosten meer dan ze opleveren.',
      'Herstelstukjes blijven rustig — het is herstel, geen extra training.',
    ],
    tempo: [
      'Drempel is comfortabel zwaar: je kunt een korte zin zeggen, geen gesprek voeren.',
      'Zak in de eerste 2 min in het tempo in plaats van er meteen vol in te gaan.',
      'Vlak en ononderbroken is beter dan een snelle route met stoplichten.',
      'Eindigen met het gevoel dat er nog iets in zat is precies goed.',
    ],
    long: [
      'De hele tijd op praattempo. Adem je zwaar, dan doe je de verkeerde sessie.',
      'Drink vanaf 45 min, en oefen met wat je op wedstrijddag wilt gebruiken.',
      'Sluit af met 4 × 20 s versnellingen om wat snelheid in de benen te houden.',
      'Langzamer dan je denkt dat goed is, is meestal goed.',
    ],
    compromised: [
      'Dit is de sessie die je wedstrijd bepaalt. Behandel het als prioriteit van de week.',
      'Ga direct van het laatste station het loopstuk in — geen pauze, die overgang is de kern.',
      'Verwacht dat de eerste 200 m rot voelt. Zit op doeltempo na 400 m.',
      'Gebruik wedstrijdgewichten en wedstrijdschoenen. Oefen wat je echt gaat doen.',
    ],
    hyrox: [
      'Dit is een krachtdag, geen loopdag. Houd looptraining eraf.',
      'Laat er als het kan een dag tussen deze sessie en je volgende zware loop.',
      'Techniek onder vermoeidheid is wat overdraagt — maak sets schoon af in plaats van reps forceren.',
      'Verwacht dat de volgende loop zwaarder voelt dan normaal. Dat hoort erbij, geen probleem.',
    ],
    shakeout: [
      'Volledige rust is vandaag een prima keuze. Twijfel je, neem hem.',
      'Loop je toch, houd het echt rustig en kort — dit is geen trainingsprikkel.',
      'Een paar versnellingen kan; alles waarvan je ademhaling omhoog gaat niet.',
      'Goede dag voor mobiliteit, slaap en voeding.',
    ],
    rest: [
      'Aanpassing gebeurt nu, niet tijdens de sessie. Rust is de training.',
      'Wandelen, mobiliteit en stretchen mag. Niets waar je hartslag flink van omhoog gaat.',
      'Zet in op slaap en goed eten — dat levert meer op dan welke extra sessie ook.',
      'Onrustig voelen is normaal. Het is geen reden om te trainen.',
    ],
    race: [
      'Warm grondig op: 10–15 min rustig, versnellingen, en oefen het eerste station.',
      'Gelijke splits. De eerste kilometer moet makkelijk voelen — adrenaline maskeert de kosten.',
      'Val na elk station binnen 100 m terug in je tempo in plaats van te sprinten.',
      'Niets nieuws vandaag: zelfde schoenen, zelfde voeding, zelfde routine die je oefende.',
    ],
  },
};

export function getTips(language: string, type: EffectiveType): string[] {
  const table = TIPS[language as Language] ?? TIPS.en;
  return table[type] ?? [];
}
