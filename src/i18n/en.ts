import type { Dict } from './types';

/**
 * English copy.
 *
 * Typed as `Dict`, so each session-variant function gets its argument type
 * contextually, and a variant the planner can emit cannot be forgotten here
 * without failing the build.
 */
export const en: Dict = {
  days: {
    short: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    full:  ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    two:   ['Mo','Tu','We','Th','Fr','Sa','Su'],
  },
  months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  settings: 'Settings',
  close: 'Close',
  phase: {
    past:     { label: 'Race passed',   desc: 'Set a new race date to plan the next block.' },
    taper:    { label: 'Race week',     desc: 'Volume drops. Short quality only. Trust the work.' },
    sharpen:  { label: 'Sharpen',       desc: 'Peak race-specificity. Simulations, then taper.' },
    racespec: { label: 'Race-specific', desc: '1km reps at target pace. First compromised runs.' },
    build:    { label: 'Build',         desc: 'Intervals lengthen. Threshold work extends.' },
    base:     { label: 'Base',          desc: 'Build easy volume. Short intervals only.' },
  },
  racePassed: 'Race passed',
  raceToday: 'Race today.',
  daysToRace: (n) => `${n} day${n===1?'':'s'} to race`,
  daysToGo:   (n) => `${n} day${n===1?'':'s'} to go`,
  weekOf: (w, t) => `Week ${w} of ${t}`,
  deloadBadge: 'Deload',
  deloadNote: 'Deload week \u2014 same intensity, ~40% less volume. Body consolidates so the next block hits harder.',
  todayLabel: 'Today',
  pinnedLabel: 'Pinned',
  raceDayLabel: 'Race day',
  thisWeek: 'This week',
  thisWeekHint: 'Tap a day to see the session. Pick a type to override \u2014 other days rearrange to keep the science right.',
  paceZones: 'Pace zones',
  paceZonesSub: (pace) => `from ${pace}/km fresh`,
  sessionType: 'Session type',
  raceWeekTitle: 'Race week',
  raceWeekDesc: 'Volume drops ~40%. Trust the work \u2014 nothing new this week. Sharpen, sleep, fuel.',
  types: {
    auto: 'Auto', hyrox: 'Hyrox', intervals: 'Intervals', tempo: 'Tempo',
    long: 'Long', compromised: 'Compromised', shakeout: 'Shakeout', rest: 'Rest'
  },
  zones: {
    easy: 'Easy Z2', threshold: 'Threshold', target: 'Hyrox target',
    vo2: 'VO\u2082 intervals', strides: 'Strides'
  },
  language: 'Language',
  raceDate: 'Race date',
  currentPace: 'Current 1 km pace \u00b7 fresh',
  paceUnit: 'min/km',
  paceHint: 'Your best 1 km time when rested. All paces are derived from this.',
  hyroxDays: 'Hyrox training days',
  hyroxDaysHint: 'Bulk toggle. Fine-grained control (compromised on Tue, rest on Thu, etc.) is on each day in the week view.',
  heaviestDay: 'Heaviest Hyrox day (this week)',
  heaviestDayHint: 'If set, intervals move to a day that isn\u2019t right after this one.',
  variesWeekly: 'Varies week to week',
  resetWeek: 'Reset week',
  savedInBrowser: 'Saved in this browser only.',
  footerLine1: 'Based on the Hyrox running speed reference',
  footerLine2: 'Frontiers in Physiology 2025 \u00b7 PMC 5839711',
  // Deload-suffixed titles
  deloadSuffix: ' \u00b7 deload',
  session: {
    race: {
      title: 'RACE DAY',
      pace: '\u2014',
      details: 'Even splits. First 1 km should feel easy \u2014 adrenaline masks the cost. Settle back into pace within 100 m out of every station.',
      why: 'Trust the work. Warm up thoroughly, fuel, race smart.'
    },
    hyroxTaper: {
      title: 'Hyrox workout (light)',
      pace: 'Skills only \u2014 no volume',
      details: ({dtr}) => `Race is in ${dtr ?? 'a few'} days. Keep this VERY light: technique drills, movement rehearsal at race weight, no intensity. Or skip entirely.`,
      why: 'Nothing to gain from a hard session now. Everything to lose.'
    },
    hyroxNormal: {
      title: 'Hyrox workout',
      pace: '\u2014',
      details: 'Your programmed strength / functional session.',
      why: 'Not a run day. Recovery for running load happens here.'
    },
    restEve: {
      title: 'Full rest \u2014 race eve',
      pace: '\u2014',
      details: 'No training. Walk, mobility, stretch if you feel like it. Pack kit, pin bib. Eat well, hydrate, sleep early.',
      why: 'Last day before race. Zero training stress.'
    },
    restNormal: {
      title: 'Rest',
      pace: '\u2014',
      details: 'Full rest. Recover.',
      why: 'The body adapts to training between sessions.'
    },
    shakeoutEve: {
      title: 'Race-eve shakeout',
      pace: ({easy}) => `20 min at ${easy} + 4 strides`,
      details: '20 min very easy jog + 4 \u00d7 20 s strides at mile pace with full recovery. Nothing more.',
      why: 'Prime the legs. Feel the paces once. Then rest.'
    },
    shakeoutNormal: {
      title: 'Shakeout or easy',
      pace: ({easy}) => `Optional 25\u201330 min at ${easy}`,
      details: 'Full rest is fine. If moving: 25\u201330 min very easy + 4 \u00d7 20 s strides on flat road, full recovery between each.',
      why: 'Recovery. Strides for a neuromuscular touch-up without cost.'
    },
    longTaper: {
      title: 'Short easy',
      pace: ({easy}) => easy,
      details: 'Cut this to 30\u201340 min. Full recovery before race day.',
      why: 'A long run this week won\u2019t make you fitter. It will make you tired.'
    },
    longNormal: {
      title: 'Long easy Zone 2',
      pace: ({easy}) => easy,
      details: ({durationMin}) => `${durationMin} min at easy conversational pace. Finish with 4 \u00d7 20 s strides.`,
      why: ({isDeload}) => isDeload
        ? 'Deload week \u2014 shorter easy run so aerobic stress drops but the rhythm stays.'
        : 'Aerobic base. Everything else plateaus without it.'
    },
    intervalsTaper: {
      title: 'Race-pace sharpener',
      pace: ({p400}) => `Each 400 m in ${p400}`,
      details: '4 \u00d7 400 m at Hyrox target pace, 200 m jog recovery. 10 min WU / 5 min CD. Stop feeling fresh \u2014 no extras.',
      why: 'One short quality touch keeps race pace in the legs without accumulating fatigue.'
    },
    intervalsRaceSpec: {
      title: 'Hyrox 400s at target',
      pace: ({p400}) => `Each 400 m in ${p400}`,
      details: ({reps}) => `${reps} \u00d7 400 m at Hyrox target pace, 200 m jog recovery. 10 min WU / 5 min CD. Run every rep at the same pace \u2014 not as fast as possible.`,
      why: ({isDeload}) => isDeload
        ? 'Deload \u2014 fewer reps at the same target pace. Same signal, less stress.'
        : 'The single most transferable session \u2014 mirrors race structure exactly.'
    },
    intervalsSharpen: {
      title: 'Hyrox 1000s at target',
      pace: ({p1k}) => `Each 1 km at ${p1k}`,
      details: ({reps}) => `${reps} \u00d7 1000 m at Hyrox target pace, 90 s standing recovery. 10 min WU / 5 min CD.`,
      why: ({isDeload}) => isDeload
        ? 'Deload \u2014 fewer reps at target. Recover; the sim is coming.'
        : 'Race-length reps at race pace. If these hold together, race pace will too.'
    },
    intervalsBuild: {
      title: 'Threshold 1000s',
      pace: ({thr}) => `Each 1 km at ${thr}`,
      details: ({reps}) => `${reps} \u00d7 1000 m at threshold, 90 s standing rest between reps. 10 min WU / 5 min CD.`,
      why: ({isDeload}) => isDeload
        ? 'Deload \u2014 same threshold work, less of it. Absorb the block.'
        : 'Longer intervals push threshold up and rehearse pace discipline.'
    },
    intervalsBase: {
      title: 'VO\u2082 intervals',
      pace: ({vo2Low, vo2High}) => `Reps at ~${vo2Low}\u2013${vo2High}/km`,
      details: ({reps}) => `${reps} \u00d7 2 min hard / 90 s easy jog. 10 min WU / 5 min CD.`,
      why: ({isDeload}) => isDeload
        ? 'Deload \u2014 fewer reps to let the aerobic ceiling adapt.'
        : 'Injury-safe way to build the aerobic ceiling early in the block.'
    },
    tempoTaper: {
      title: 'Short tempo',
      pace: ({thr}) => `10 min at ${thr}`,
      details: '10 min at threshold. 10 min WU / 5 min CD. Not the session I\u2019d pick in race week \u2014 a shakeout or the race-pace sharpener is better.',
      why: 'You picked this. If you\u2019re feeling fresh, a tiny threshold touch is OK.'
    },
    tempoBase: {
      title: 'Threshold tempo',
      pace: ({thr}) => `At ${thr}`,
      details: ({durationMin}) => `${durationMin} min continuous. 10 min WU / 5 min CD.`,
      why: ({isDeload}) => isDeload ? 'Deload \u2014 shorter tempo, same intensity.' : 'Pushes lactate threshold \u2014 less flooded arriving at each station.'
    },
    tempoBuild: {
      title: 'Threshold tempo',
      pace: ({thr}) => `At ${thr}`,
      details: ({sets, blockMin}) => `${sets} \u00d7 ${blockMin} min, 2 min easy jog between. 10 min WU / 5 min CD.`,
      why: ({isDeload}) => isDeload ? 'Deload \u2014 shorter blocks, same threshold pace.' : 'Pushes lactate threshold \u2014 less flooded arriving at each station.'
    },
    tempoRaceSpec: {
      title: 'Threshold tempo',
      pace: ({thr}) => `At ${thr}`,
      details: ({sets, blockMin}) => `${sets} \u00d7 ${blockMin} min, 2 min easy jog between. 10 min WU / 5 min CD.`,
      why: ({isDeload}) => isDeload ? 'Deload \u2014 shorter blocks, same threshold pace.' : 'Higher threshold = starting each Hyrox run less flooded.'
    },
    tempoSharpen: {
      title: 'Threshold tempo',
      pace: ({thr}) => `At ${thr}`,
      details: ({sets, blockMin}) => `${sets} \u00d7 ${blockMin} min, 2 min easy jog between. 10 min WU / 5 min CD.`,
      why: 'Keep the threshold engine primed alongside race-specific work.'
    },
    compromisedTaper: {
      title: 'Compromised (skip this in race week)',
      pace: ({p1k}) => `1 km at ${p1k}`,
      details: 'You pinned this in race week \u2014 I\u2019d strongly consider swapping it for the race-pace sharpener. If you must: cut to 2 stations + 1 \u00d7 1 km at target pace, then stop.',
      why: 'Full compromised in taper is too much load this close to race.'
    },
    compromisedRaceSpec: {
      title: 'Compromised run',
      pace: ({p1k}) => `1 km at ${p1k}`,
      details: ({stations, reps1k}) => `${stations} station block${stations>1?'s':''} (each: 500 m row + 40 wall balls + 2 \u00d7 50 m sled) \u2192 immediately ${reps1k} \u00d7 1 km at target pace.`,
      why: ({isDeload}) => isDeload
        ? 'Deload \u2014 one light block. Preserve the pattern, cut the load.'
        : 'Compromised is what actually decides your race. Train what you\u2019ll do.'
    },
    compromisedSharpen: {
      title: 'Compromised block or half race sim',
      pace: ({p1k}) => `1 km reps at ${p1k}`,
      details: ({stations, reps1k}) => `${stations} stations + ${reps1k} \u00d7 1 km at target pace. Alternative: run 4 stations + 4 runs of the actual race in order at race weight \u2014 a half sim.`,
      why: 'Dress rehearsal. You want to have done this before race day.'
    },
    compromisedNormal: {
      title: 'Compromised run',
      pace: ({p1k}) => `1 km at ${p1k}`,
      details: 'Station block (500 m row + 40 wall balls + 2 \u00d7 50 m sled) \u2192 immediately 1 km at target pace. Repeat once if fresh.',
      why: 'Compromised is what actually decides your race. Train what you\u2019ll do.'
    },
    fallback: {
      title: 'Easy 30 min',
      pace: ({easy}) => easy,
      details: '30 min at easy pace. 4 strides at the end if fresh.',
      why: ''
    }
  },

  // --- Added in v3 ---
  tabToday: 'Today',
  tabWeek: 'Week',
  tabBlock: 'Block',
  blockTitle: 'Full block',
  blockHint: 'Every week from the start of your block to race day. Tap a week to open it.',
  blockWeekLabel: (n, total) => `Week ${n} of ${total}`,
  raceWeekShort: 'Race',
  markDone: 'Mark done',
  markedDone: 'Done',
  undo: 'Undo',
  logTitle: 'How did it go?',
  logHint: 'Logged sessions feed the streak and completion rate.',
  rpeLabel: 'Effort (RPE)',
  noteLabel: 'Note',
  notePlaceholder: 'Felt strong, held pace on all reps…',
  streakLabel: (n) => n === 1 ? '1 week streak' : `${n} week streak`,
  completionLabel: (done, total) => `${done} of ${total} sessions done`,
  last28Days: 'Last 28 days',
  onlyThisDay: 'Only this date',
  everyWeek: 'Every week',
  scopeHint: 'Change this date only, or change every week from now on.',
  clearOverride: 'Back to auto',
  dataTitle: 'Your data',
  exportBtn: 'Export backup',
  importBtn: 'Import backup',
  exportHint: 'Saved in this browser only. iOS can clear browser storage — export now and then.',
  importOk: 'Backup restored.',
  importFailed: (reason) => `Import failed: ${reason}`,
  storageWarning: 'Could not save to this browser. Changes will be lost when you close the app — export a backup.',
  restartBlock: 'Restart block',
  restartBlockHint: 'Counts progression from this week instead. Your log is kept.',
  restartBlockConfirm: 'Restart the block from this week? Progression restarts; your training log is kept.',
  updateAvailable: 'A new version is ready.',
  reloadBtn: 'Reload',
  offlineReady: 'Ready to work offline.',
  errorTitle: 'Something broke',
  errorBody: 'The planner hit an error. Your data is still saved. Reloading usually fixes it.',
  errorReset: 'Reset to defaults',
  today: 'Today',
  cancel: 'Cancel',
};
