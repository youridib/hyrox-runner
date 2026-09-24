import type { SessionArgs, Station } from '../domain/types';

/** A field that is either a literal or derived from the session's numbers. */
export type Field = string | ((a: SessionArgs) => string);

export interface SessionVariant {
  title: Field;
  pace: Field;
  details: Field;
  why: Field;
}

/**
 * Every variant key the domain can emit. Declaring them explicitly means a
 * new variant in `progression.ts` fails to compile until both languages
 * carry a string for it, rather than rendering blank at runtime.
 */
export interface SessionDict {
  race: SessionVariant;
  hyroxTaper: SessionVariant;
  hyroxTaperEarly: SessionVariant;
  hyroxNormal: SessionVariant;
  restEve: SessionVariant;
  restNormal: SessionVariant;
  shakeoutEve: SessionVariant;
  shakeoutNormal: SessionVariant;
  easyNormal: SessionVariant;
  timeTrialNormal: SessionVariant;
  longTaper: SessionVariant;
  longNormal: SessionVariant;
  intervalsTaper: SessionVariant;
  intervalsTaperEarly: SessionVariant;
  intervalsVo2Maintenance: SessionVariant;
  intervalsRaceSpec: SessionVariant;
  intervalsSharpen: SessionVariant;
  intervalsBuild: SessionVariant;
  intervalsBase: SessionVariant;
  tempoTaper: SessionVariant;
  tempoTaperEarly: SessionVariant;
  tempoBase: SessionVariant;
  tempoBuild: SessionVariant;
  tempoRaceSpec: SessionVariant;
  tempoSharpen: SessionVariant;
  compromisedTaper: SessionVariant;
  compromisedTaperEarly: SessionVariant;
  compromisedRaceSpec: SessionVariant;
  compromisedSharpen: SessionVariant;
  compromisedNormal: SessionVariant;
  fallback: SessionVariant;
}

export interface Dict {
  days: { short: string[]; full: string[]; two: string[] };
  months: string[];
  settings: string;
  close: string;
  phase: Record<string, { label: string; desc: string }>;
  racePassed: string;
  raceToday: string;
  daysToRace: (n: number) => string;
  daysToGo: (n: number) => string;
  weekOf: (w: number, t: number) => string;
  deloadBadge: string;
  deloadNote: string;
  todayLabel: string;
  pinnedLabel: string;
  raceDayLabel: string;
  thisWeek: string;
  thisWeekHint: string;
  paceZones: string;
  paceZonesSub: (pace: string) => string;
  sessionType: string;
  raceWeekTitle: string;
  raceWeekDesc: string;
  types: Record<string, string>;
  zones: Record<string, string>;
  language: string;
  raceDate: string;
  currentPace: string;
  paceUnit: string;
  paceHint: string;
  hyroxDays: string;
  hyroxDaysHint: string;
  heaviestDay: string;
  heaviestDayHint: string;
  variesWeekly: string;
  resetWeek: string;
  savedInBrowser: string;
  footerLine1: string;
  footerLine2: string;
  deloadSuffix: string;
  session: SessionDict;

  // --- Added in v3 ---
  tabToday: string;
  tabWeek: string;
  tabBlock: string;
  blockTitle: string;
  blockHint: string;
  blockWeekLabel: (n: number, total: number) => string;
  raceWeekShort: string;
  markDone: string;
  markedDone: string;
  undo: string;
  logTitle: string;
  logHint: string;
  rpeLabel: string;
  noteLabel: string;
  notePlaceholder: string;
  streakLabel: (n: number) => string;
  completionLabel: (done: number, total: number) => string;
  last28Days: string;
  onlyThisDay: string;
  everyWeek: string;
  scopeHint: string;
  clearOverride: string;
  dataTitle: string;
  exportBtn: string;
  importBtn: string;
  exportHint: string;
  importOk: string;
  importFailed: (reason: string) => string;
  storageWarning: string;
  restartBlock: string;
  restartBlockHint: string;
  restartBlockConfirm: string;
  updateAvailable: string;
  reloadBtn: string;
  offlineReady: string;
  errorTitle: string;
  errorBody: string;
  errorReset: string;
  today: string;
  cancel: string;
  tipsTitle: string;
  deloadTip: string;

  // --- Added in v4: the other 48% of the race ---
  /** Station names, keyed the way the domain keys them. */
  stations: Record<Station, string>;
  tabRace: string;
  racePlanTitle: string;
  racePlanHint: string;
  predictedFinish: string;
  predictedFinishHint: string;
  goalFinishLabel: string;
  goalPaceLabel: string;
  goalImpossible: string;
  runScheduleTitle: string;
  runScheduleHint: string;
  runLabel: (n: number) => string;
  stationTargetsTitle: string;
  stationTargetsHint: string;
  yourTimeLabel: string;
  targetTimeLabel: string;
  availableLabel: string;
  estimatedMark: string;
  estimatedHint: string;
  roxzoneTitle: string;
  roxzoneBudget: (transitions: number, each: string, total: string) => string;
  roxzoneHint: string;
  preRaceTitle: string;
  preRaceSteps: string[];
  /** Weekly intensity accounting. */
  intensityTitle: string;
  intensityLabel: (hardPct: number, totalMin: number) => string;
  intensityWarning: string;
  /** Pace anchor. */
  anchorTwoPoint: string;
  anchorSinglePoint: string;
  anchorDecay: (seconds: number) => string;
  timeTrialTitle: string;
  timeTrialHint: string;
  ttDistanceLabel: string;
  ttTimeLabel: string;
  ttAddBtn: string;
  ttEmpty: string;
  ttEntry: (meters: number, time: string, date: string) => string;
  ttRemove: string;
  /** Station benchmarks. */
  benchmarksTitle: string;
  benchmarksHint: string;
  benchmarkStale: string;
  benchmarkUnit: string;
  /** Compromised-run split logging. */
  splitLabel: string;
  splitHint: string;
  /** Division, sex and goal. */
  divisionLabel: string;
  divisionHint: string;
  divisions: Record<string, string>;
  sexLabel: string;
  sexes: Record<string, string>;
  goalFinishSetting: string;
  goalFinishHint: string;
  goalFinishNone: string;
}
