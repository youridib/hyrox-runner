
import { renderBlock, type DoseWords } from './dose';
import type { Dict } from './types';

const STATION_NAMES = {
  ski: 'SkiErg',
  sledPush: 'sled push',
  sledPull: 'sled pull',
  burpeeBroadJump: 'burpee broad jumps',
  row: 'row',
  farmers: 'farmers carry',
  lunges: 'sandbag lunges',
  wallBalls: 'wall balls',
} as const;

const WORDS: DoseWords = {
  stations: STATION_NAMES,
  reps: 'reps',
  perHand: 'each hand',
  to: 'to',
};

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
    taper:    { label: 'Taper',         desc: 'Two weeks. Volume falls, intensity and frequency hold.' },
    sharpen:  { label: 'Sharpen',       desc: 'Peak race-specificity. Simulations, then taper.' },
    racespec: { label: 'Race-specific', desc: '1km reps at target pace. Compromised runs build.' },
    build:    { label: 'Build',         desc: 'Threshold extends. First compromised runs appear.' },
    base:     { label: 'Base',          desc: 'Easy volume and VO₂ work. The ceiling gets built here.' },
  },
  racePassed: 'Race passed',
  raceToday: 'Race today.',
  daysToRace: (n) => `${n} day${n===1?'':'s'} to race`,
  daysToGo:   (n) => `${n} day${n===1?'':'s'} to go`,
  weekOf: (w, t) => `Week ${w} of ${t}`,
  deloadBadge: 'Deload',
  deloadNote: 'Deload week — same intensity, ~40% less volume. Body consolidates so the next block hits harder.',
  todayLabel: 'Today',
  pinnedLabel: 'Pinned',
  raceDayLabel: 'Race day',
  thisWeek: 'This week',
  thisWeekHint: 'Tap a day to see the session. Pick a type to override — other days rearrange to keep the science right.',
  paceZones: 'Pace zones',
  paceZonesSub: (pace) => `target ${pace}/km`,
  sessionType: 'Session type',
  raceWeekTitle: 'Race week',
  raceWeekDesc: 'Final seven days. Trust the work — nothing new this week. Sharpen, sleep, fuel.',
  types: {
    auto: 'Auto', hyrox: 'Hyrox', intervals: 'Intervals', tempo: 'Tempo',
    long: 'Long', easy: 'Easy', compromised: 'Compromised', timeTrial: 'Time trial',
    shakeout: 'Shakeout', rest: 'Rest'
  },
  zones: {
    easy: 'Easy Z2', threshold: 'Threshold', target: 'Hyrox target',
    vo2: 'VO₂ intervals', strides: 'Strides'
  },
  language: 'Language',
  raceDate: 'Race date',
  currentPace: 'Current 1 km pace · fresh',
  paceUnit: 'min/km',
  paceHint: 'Your best 1 km time when rested. Used as a single-point estimate of critical speed; add a second time trial below to measure it properly.',
  hyroxDays: 'Hyrox training days',
  hyroxDaysHint: 'Bulk toggle. Fine-grained control (compromised on Tue, rest on Thu, etc.) is on each day in the week view.',
  heaviestDay: 'Heaviest Hyrox day',
  heaviestDayHint: 'If set, hard runs move off the day after this one.',
  variesWeekly: 'Varies week to week',
  resetWeek: 'Reset week',
  savedInBrowser: 'Saved in this browser only.',
  footerLine1: 'Brandt, Ebel, Lebahn & Schmidt (2025)',
  footerLine2: 'Front. Physiol. 16:1519240 · PMC11994925',
  // Deload-suffixed titles
  deloadSuffix: ' · deload',
  session: {
    race: {
      title: 'RACE DAY',
      pace: ({p1k}) => `Every run at ${p1k}`,
      details: ({p1k, transitionSec}) => `Flat splits: every kilometre at ${p1k}, run 1 included — never faster. Out of every station, back on pace within 100 m. Target ${transitionSec} s per transition.`,
      why: 'Opening 15 s/km fast costs about six minutes over the back half. Trust the work.'
    },
    hyroxTaper: {
      title: 'Hyrox workout (light)',
      pace: 'Skills only — no volume',
      details: ({dtr}) => `Race is in ${dtr ?? 'a few'} days. Technique drills and movement rehearsal at race weight. A few heavy singles are fine; volume is not.`,
      why: 'Cut the volume, keep the intensity — the same taper logic as the running.'
    },
    hyroxTaperEarly: {
      title: 'Hyrox workout (trimmed)',
      pace: 'Race weight, half the volume',
      details: 'Keep the movements and the loads, cut the sets roughly in half. Two short sessions across the fortnight maintain output.',
      why: 'Dropping strength for 14 days blunts neuromuscular output. Taper it, do not delete it.'
    },
    hyroxNormal: {
      title: 'Hyrox workout',
      pace: '—',
      details: 'Your programmed strength / functional session. Log your station times now and then — they steer the compromised runs and the race plan.',
      why: 'This is a hard day, not recovery: stations peak higher on lactate than the runs do.'
    },
    restEve: {
      title: 'Full rest — race eve',
      pace: '—',
      details: 'No training. Walk, mobility, stretch if you feel like it. Pack kit, pin bib. Eat well, hydrate, sleep early.',
      why: 'Last day before race. Zero training stress.'
    },
    restNormal: {
      title: 'Rest',
      pace: '—',
      details: 'Full rest. Recover.',
      why: 'The body adapts to training between sessions.'
    },
    shakeoutEve: {
      title: 'Race-eve shakeout',
      pace: ({easy}) => `20 min at ${easy} + 4 strides`,
      details: '20 min very easy jog + 4 × 20 s strides at mile pace with full recovery. Nothing more.',
      why: 'Prime the legs. Feel the paces once. Then rest.'
    },
    shakeoutNormal: {
      title: 'Shakeout or easy',
      pace: ({easy}) => `Optional 25–30 min at ${easy}`,
      details: 'Full rest is fine. If moving: 25–30 min very easy + 4 × 20 s strides on flat road, full recovery between each.',
      why: 'Recovery. Strides for a neuromuscular touch-up without cost.'
    },
    easyNormal: {
      title: 'Easy aerobic',
      pace: ({easy}) => easy,
      details: ({durationMin}) => `${durationMin} min genuinely easy. Bike or SkiErg instead if this week is heavy on lower-body lifting — running adds the eccentric load.`,
      why: ({isDeload}) => isDeload
        ? 'Deload — shorter, same easy intensity.'
        : 'Endurance volume correlates with finish time at ρ = −0.68. This is the cheapest fitness in the plan.'
    },
    timeTrialNormal: {
      title: 'Time trial',
      pace: ({ttMeters}) => `${ttMeters} m, all out`,
      details: ({ttMeters}) => `15 min easy + 3 strides, then ${ttMeters} m as hard as you can hold evenly. Enter the time in Settings — every pace in the app moves with it.`,
      why: 'Fresh legs in a deload week. Nothing else re-tests the number the whole plan is derived from.'
    },
    longTaper: {
      title: 'Short easy',
      pace: ({easy}) => easy,
      details: ({durationMin}) => `Cut this to ${durationMin} min. Full recovery before race day.`,
      why: 'A long run now will not make you fitter. It will make you tired.'
    },
    longNormal: {
      title: 'Long easy Zone 2',
      pace: ({easy}) => easy,
      details: ({durationMin}) => `${durationMin} min at easy conversational pace. Finish with 4 × 20 s strides.`,
      why: ({isDeload}) => isDeload
        ? 'Deload week — shorter easy run so aerobic stress drops but the rhythm stays.'
        : 'Aerobic base. Everything else plateaus without it.'
    },
    intervalsTaper: {
      title: 'Race-pace sharpener',
      pace: ({p400}) => `Each 400 m in ${p400}`,
      details: '4 × 400 m at Hyrox target pace, 200 m jog recovery. 10 min WU / 5 min CD. Stop feeling fresh — no extras.',
      why: 'One short quality touch keeps race pace in the legs without accumulating fatigue.'
    },
    intervalsTaperEarly: {
      title: 'Target-pace reps (trimmed)',
      pace: ({p400}) => `Each 400 m in ${p400}`,
      details: ({reps}) => `${reps} × 400 m at Hyrox target pace, 200 m jog recovery. 10 min WU / 5 min CD. Same pace as three weeks ago, fewer of them.`,
      why: 'Taper week one: volume down, intensity and frequency unchanged.'
    },
    intervalsVo2Maintenance: {
      title: 'VO₂ intervals · maintenance',
      pace: ({vo2Low, vo2High}) => `Reps at ~${vo2Low}–${vo2High}/km`,
      details: ({reps}) => `${reps} × 2 min hard / 90 s easy jog. 10 min WU / 5 min CD. This replaces the threshold session this week rather than adding to it.`,
      why: 'VO₂max is the strongest single correlate of finish time (ρ = −0.71). One dose a fortnight keeps it.'
    },
    intervalsRaceSpec: {
      title: 'Hyrox 400s at target',
      pace: ({p400}) => `Each 400 m in ${p400}`,
      details: ({reps}) => `${reps} × 400 m at Hyrox target pace, 200 m jog recovery. 10 min WU / 5 min CD. Run every rep at the same pace — not as fast as possible.`,
      why: ({isDeload}) => isDeload
        ? 'Deload — fewer reps at the same target pace. Same signal, less stress.'
        : 'The single most transferable session — mirrors race structure exactly.'
    },
    intervalsSharpen: {
      title: 'Hyrox 1000s at target',
      pace: ({p1k}) => `Each 1 km at ${p1k}`,
      details: ({reps}) => `${reps} × 1000 m at Hyrox target pace, 90 s standing recovery. 10 min WU / 5 min CD.`,
      why: ({isDeload}) => isDeload
        ? 'Deload — fewer reps at target. Recover; the sim is coming.'
        : 'Race-length reps at race pace. If these hold together, race pace will too.'
    },
    intervalsBuild: {
      title: 'Threshold 1000s',
      pace: ({thr}) => `Each 1 km at ${thr}`,
      details: ({reps}) => `${reps} × 1000 m at threshold, 90 s standing rest between reps. 10 min WU / 5 min CD.`,
      why: ({isDeload}) => isDeload
        ? 'Deload — same threshold work, less of it. Absorb the block.'
        : 'Longer intervals push threshold up and rehearse pace discipline.'
    },
    intervalsBase: {
      title: 'VO₂ intervals',
      pace: ({vo2Low, vo2High}) => `Reps at ~${vo2Low}–${vo2High}/km`,
      details: ({reps}) => `${reps} × 2 min hard / 90 s easy jog. 10 min WU / 5 min CD.`,
      why: ({isDeload}) => isDeload
        ? 'Deload — fewer reps to let the aerobic ceiling adapt.'
        : 'Injury-safe way to build the aerobic ceiling early in the block.'
    },
    tempoTaper: {
      title: 'Short tempo',
      pace: ({thr}) => `10 min at ${thr}`,
      details: '10 min at threshold. 10 min WU / 5 min CD. Not the session I’d pick in the final seven days — a shakeout or the race-pace sharpener is better.',
      why: 'You picked this. If you’re feeling fresh, a tiny threshold touch is OK.'
    },
    tempoTaperEarly: {
      title: 'Threshold tempo (trimmed)',
      pace: ({thr}) => `At ${thr}`,
      details: ({durationMin}) => `${durationMin} min continuous at threshold. 10 min WU / 5 min CD.`,
      why: 'Taper week one: the threshold session stays, at about two thirds of its length.'
    },
    tempoBase: {
      title: 'Threshold tempo',
      pace: ({thr}) => `At ${thr}`,
      details: ({durationMin}) => `${durationMin} min continuous. 10 min WU / 5 min CD.`,
      why: ({isDeload}) => isDeload ? 'Deload — shorter tempo, same intensity.' : 'Pushes lactate threshold — less flooded arriving at each station.'
    },
    tempoBuild: {
      title: 'Threshold tempo',
      pace: ({thr}) => `At ${thr}`,
      details: ({sets, blockMin}) => `${sets} × ${blockMin} min, 2 min easy jog between. 10 min WU / 5 min CD.`,
      why: ({isDeload}) => isDeload ? 'Deload — shorter blocks, same threshold pace.' : 'Pushes lactate threshold — less flooded arriving at each station.'
    },
    tempoRaceSpec: {
      title: 'Threshold tempo',
      pace: ({thr}) => `At ${thr}`,
      details: ({sets, blockMin}) => `${sets} × ${blockMin} min, 2 min easy jog between. 10 min WU / 5 min CD.`,
      why: ({isDeload}) => isDeload ? 'Deload — shorter blocks, same threshold pace.' : 'Higher threshold = starting each Hyrox run less flooded.'
    },
    tempoSharpen: {
      title: 'Threshold tempo',
      pace: ({thr}) => `At ${thr}`,
      details: ({sets, blockMin}) => `${sets} × ${blockMin} min, 2 min easy jog between. 10 min WU / 5 min CD.`,
      why: 'Keep the threshold engine primed alongside race-specific work.'
    },
    compromisedTaper: {
      title: 'Compromised (skip this in race week)',
      pace: ({p1k}) => `1 km at ${p1k}`,
      details: ({block}) => `You pinned this inside the final seven days — I’d swap it for the race-pace sharpener. If you must: ${renderBlock(block, WORDS)}, then one 1 km at target pace, then stop.`,
      why: 'Full compromised work this close to the race is load you cannot absorb in time.'
    },
    compromisedTaperEarly: {
      title: 'Compromised run (trimmed)',
      pace: ({p1k}) => `1 km at ${p1k}`,
      details: ({block, reps1k, transitionSec}) => `${renderBlock(block, WORDS)} → jog the transition (${transitionSec} s) → ${reps1k} × 1 km at target pace. Half the usual block, same paces.`,
      why: 'Taper week one: keep the pattern, cut the volume.'
    },
    compromisedRaceSpec: {
      title: 'Compromised run',
      pace: ({p1k}) => `1 km at ${p1k}`,
      details: ({stations, reps1k, block, transitionSec}) => `${stations} station block${stations>1?'s':''} — each: ${renderBlock(block, WORDS)} — then jog the roxzone (${transitionSec} s target, clock never stops) into ${reps1k} × 1 km at target pace. Log the 1 km split.`,
      why: ({isDeload}) => isDeload
        ? 'Deload — one light block. Preserve the pattern, cut the load.'
        : 'Compromised is what actually decides your race. The logged split is what calibrates your target pace.'
    },
    compromisedSharpen: {
      title: 'Compromised block or half race sim',
      pace: ({p1k}) => `1 km reps at ${p1k}`,
      details: ({stations, reps1k, block, transitionSec}) => `${stations} blocks of ${renderBlock(block, WORDS)} + ${reps1k} × 1 km at target pace, ${transitionSec} s transitions. Alternative: 4 stations + 4 runs of the actual race in order at race weight — a half sim.`,
      why: 'Dress rehearsal. You want to have done this before race day.'
    },
    compromisedNormal: {
      title: 'Compromised run',
      pace: ({p1k}) => `1 km at ${p1k}`,
      details: ({block, transitionSec}) => `${renderBlock(block, WORDS)} → straight into 1 km at target pace, ${transitionSec} s in the transition. Set the kit up before you start. Log the 1 km split.`,
      why: 'One short block a fortnight from mid-build starts the decay-reduction adaptation months earlier.'
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
  rpeLabel: 'Effort (RPE) · diary only',
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
  tipsTitle: 'How to run it',
  deloadTip: 'Deload week — hold the intensity, cut the volume. Resist adding extra.',

  // --- Added in v4 ---
  stations: STATION_NAMES,
  tabRace: 'Race',
  racePlanTitle: 'Race plan',
  racePlanHint: 'Built from your target pace, your station times and a roxzone budget. Runs are 52% of the race, stations 40%, transitions 8%.',
  predictedFinish: 'Predicted finish',
  predictedFinishHint: 'Runs + stations + roxzone, at the times below.',
  goalFinishLabel: 'Goal',
  goalPaceLabel: 'Pace your goal needs',
  goalImpossible: 'That goal leaves no time for the runs. Take time out of the stations first.',
  runScheduleTitle: 'Run schedule',
  runScheduleHint: 'Flat, run 1 included. Starting 15 s/km faster than this costs about six minutes over the back half.',
  runLabel: (n) => `Run ${n}`,
  stationTargetsTitle: 'Stations',
  stationTargetsHint: 'Your time against the population 25th percentile. Sorted by seconds available — that is where the race is won.',
  yourTimeLabel: 'You',
  targetTimeLabel: 'Target',
  availableLabel: 'Available',
  estimatedMark: 'est.',
  estimatedHint: 'Marked est. = no benchmark yet, population average used. Add yours in Settings.',
  roxzoneTitle: 'Roxzone',
  roxzoneBudget: (transitions, each, total) => `${transitions} transitions × ${each} = ${total}`,
  roxzoneHint: 'Top quartile 5:26, bottom quartile 7:42. That 2:16 is free — it costs no fitness, only rehearsal.',
  preRaceTitle: 'Pre-race protocol',
  preRaceSteps: [
    '10–15 min easy jog, finishing 30 min before your start.',
    '4 × 20 s strides at target pace, full recovery.',
    'One station rehearsal at race weight — the first station only.',
    'Nothing new: same shoes, same fuel, same routine you practised.',
  ],
  intensityTitle: 'Week intensity',
  intensityLabel: (hardPct, totalMin) => `${hardPct}% hard of ${totalMin} planned min`,
  intensityWarning: 'Over 30% hard. Hyrox days count as hard — stations peak higher on lactate than the runs. Swap one for easy aerobic work.',
  anchorTwoPoint: 'Critical speed from two time trials',
  anchorSinglePoint: 'Critical speed estimated from one 1 km',
  anchorDecay: (seconds) => `Station penalty +${seconds} s/km`,
  timeTrialTitle: 'Time trials',
  timeTrialHint: 'Two efforts at different distances (e.g. 1200 m and 2400 m) give a real critical speed. Re-test on the last day of each deload week.',
  ttDistanceLabel: 'Distance (m)',
  ttTimeLabel: 'Time (m:ss)',
  ttAddBtn: 'Add time trial',
  ttEmpty: 'No time trials yet — paces come from your 1 km above.',
  ttEntry: (meters, time, date) => `${meters} m in ${time} · ${date}`,
  ttRemove: 'Remove',
  tabStations: 'Stations',
  stationsTitle: 'Station times',
  stationsHint: 'The stations are 40% of the race and carry most of its spread. Enter what each one actually takes you; anything you have not tested is estimated below.',
  stationsFooterHint: 'Times are for the race-standard dose at race weight. Re-test every six weeks - benchmarks older than that are marked stale.',
  stationsTestedLabel: (tested, total) => `${tested} of ${total} measured`,
  stationTotalLabel: 'Stations total',
  requiredFinish: 'Adds up to your goal',
  goalShort: 'goal',
  fieldShort: 'field',
  goalOverBy: 'Over your goal by',
  goalOverrunHint: (pace) =>
    'Your measured stations no longer fit this goal. Take the time out of the stations above, run faster than ' + pace + '/km, or give the goal more room.',
  estimateFromGoal: 'Untested stations are what your goal finish leaves them, once the runs and roxzone are paid for.',
  estimateFromPace: (pace) =>
    `Untested stations are estimated from your target pace of ${pace}/km. Set a goal finish above to work backwards from that instead.`,
  estimateAllMeasured: 'Every station measured - these are your own numbers.',
  clearBenchmark: 'Clear',
  minutesLabel: 'Minutes',
  secondsLabel: 'Seconds',
  goalHoursLabel: 'Hours',
  goalMinutesLabel: 'Minutes',
  benchmarksTitle: 'Station benchmarks',
  benchmarksHint: 'Seconds for the race-standard dose at race weight. Stations are 40% of the race; these steer your compromised runs and the race plan. Re-test every six weeks.',
  benchmarkStale: 'stale',
  benchmarkUnit: 'm:ss',
  splitLabel: '1 km split off the block',
  splitHint: 'The kilometre you ran straight out of the station block. This is what calibrates your target pace to you.',
  divisionLabel: 'Division',
  divisionHint: 'Sets the sled, wall-ball and carry loads in your compromised runs.',
  divisions: { open: 'Open', pro: 'Pro', doubles: 'Doubles' },
  sexLabel: 'Category',
  sexes: { male: 'Men', female: 'Women' },
  goalFinishSetting: 'Goal finish (h:mm)',
  goalFinishHint: 'Optional. With one, the race plan shows the pace your goal actually requires.',
  goalFinishNone: 'Project from current fitness',
};

