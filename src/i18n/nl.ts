import { renderBlock, type DoseWords } from './dose';
import type { Dict } from './types';

const STATION_NAMES = {
  ski: 'SkiErg',
  sledPush: 'sled push',
  sledPull: 'sled pull',
  burpeeBroadJump: 'burpee broad jumps',
  row: 'roeien',
  farmers: 'farmers carry',
  lunges: 'sandbag lunges',
  wallBalls: 'wall balls',
} as const;

const WORDS: DoseWords = {
  stations: STATION_NAMES,
  reps: 'herhalingen',
  perHand: 'per hand',
  to: 'tot',
};

/**
 * Dutch copy.
 *
 * Typed as `Dict`, so each session-variant function gets its argument type
 * contextually, and a variant the planner can emit cannot be forgotten here
 * without failing the build.
 */
export const nl: Dict = {
  days: {
    short: ['Ma','Di','Wo','Do','Vr','Za','Zo'],
    full:  ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag'],
    two:   ['Ma','Di','Wo','Do','Vr','Za','Zo'],
  },
  months: ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'],
  settings: 'Instellingen',
  close: 'Sluiten',
  phase: {
    past:     { label: 'Wedstrijd voorbij',    desc: 'Stel een nieuwe wedstrijddatum in om het volgende blok te plannen.' },
    taper:    { label: 'Aftrainen',            desc: 'Twee weken. Volume daalt, intensiteit en frequentie blijven.' },
    sharpen:  { label: 'Aanscherpen',          desc: 'Piek wedstrijdspecifiek. Simulaties, dan aftrainen.' },
    racespec: { label: 'Wedstrijdspecifiek',   desc: '1 km-herhalingen op doeltempo. Compromised runs bouwen op.' },
    build:    { label: 'Opbouw',               desc: 'Drempelwerk groeit. Eerste compromised runs verschijnen.' },
    base:     { label: 'Basis',                desc: 'Rustig volume en VO₂-werk. Hier wordt het plafond gebouwd.' },
  },
  racePassed: 'Wedstrijd voorbij',
  raceToday: 'Wedstrijd vandaag.',
  daysToRace: (n) => n===1 ? '1 dag tot wedstrijd' : `${n} dagen tot wedstrijd`,
  daysToGo:   (n) => n===1 ? '1 dag te gaan' : `${n} dagen te gaan`,
  weekOf: (w, t) => `Week ${w} van ${t}`,
  deloadBadge: 'Herstel',
  deloadNote: 'Herstelweek — zelfde intensiteit, ~40% minder volume. Lichaam consolideert zodat het volgende blok harder aankomt.',
  todayLabel: 'Vandaag',
  pinnedLabel: 'Vastgezet',
  raceDayLabel: 'Wedstrijddag',
  thisWeek: 'Deze week',
  thisWeekHint: 'Tik op een dag om de sessie te zien. Kies een type om te overschrijven — andere dagen worden aangepast volgens de wetenschap.',
  paceZones: 'Tempo-zones',
  paceZonesSub: (pace) => `doeltempo ${pace}/km`,
  sessionType: 'Sessietype',
  raceWeekTitle: 'Wedstrijdweek',
  raceWeekDesc: 'Laatste zeven dagen. Vertrouw op het werk — niets nieuws deze week. Aanscherpen, slapen, voeding.',
  types: {
    auto: 'Auto', hyrox: 'Hyrox', intervals: 'Intervallen', tempo: 'Tempo',
    long: 'Duurloop', easy: 'Rustig', compromised: 'Compromised', timeTrial: 'Testloop',
    shakeout: 'Losloopje', rest: 'Rust'
  },
  zones: {
    easy: 'Rustig Z2', threshold: 'Drempel', target: 'Hyrox doeltempo',
    vo2: 'VO₂ intervallen', strides: 'Versnellingen'
  },
  language: 'Taal',
  raceDate: 'Wedstrijddatum',
  currentPace: 'Huidig 1 km tempo · fris',
  paceUnit: 'min/km',
  paceHint: 'Jouw beste 1 km tijd uitgerust. Wordt gebruikt als schatting van je kritische snelheid; voeg hieronder een tweede testloop toe om die echt te meten.',
  hyroxDays: 'Hyrox trainingsdagen',
  hyroxDaysHint: 'Snelle instelling. Fijnere aanpassingen (compromised op di, rust op do, enz.) per dag in de weekweergave.',
  heaviestDay: 'Zwaarste Hyrox dag',
  heaviestDayHint: 'Indien ingesteld, worden zware lopen weggehaald bij de dag erna.',
  variesWeekly: 'Wisselt per week',
  resetWeek: 'Reset week',
  savedInBrowser: 'Alleen opgeslagen in deze browser.',
  footerLine1: 'Brandt, Ebel, Lebahn & Schmidt (2025)',
  footerLine2: 'Front. Physiol. 16:1519240 · PMC11994925',
  deloadSuffix: ' · herstel',
  session: {
    race: {
      title: 'WEDSTRIJDDAG',
      pace: ({p1k}) => `Elke loop op ${p1k}`,
      details: ({p1k, transitionSec}) => `Vlakke splits: elke kilometer op ${p1k}, ook de eerste — nooit sneller. Val na elk station binnen 100 m terug in je tempo. Streef naar ${transitionSec} s per overgang.`,
      why: 'Openen op 15 s/km te snel kost ongeveer zes minuten in de tweede helft. Vertrouw op het werk.'
    },
    hyroxTaper: {
      title: 'Hyrox training (licht)',
      pace: 'Alleen techniek — geen volume',
      details: ({dtr}) => `Wedstrijd is over ${dtr ?? 'enkele'} dagen. Techniekdrills en bewegingsrepetitie op wedstrijdgewicht. Een paar zware singles mag; volume niet.`,
      why: 'Volume eruit, intensiteit erin — dezelfde taperlogica als bij het lopen.'
    },
    hyroxTaperEarly: {
      title: 'Hyrox training (ingekort)',
      pace: 'Wedstrijdgewicht, halve volume',
      details: 'Houd de oefeningen en de gewichten, halveer ongeveer het aantal sets. Twee korte sessies in de twee weken houden je output op peil.',
      why: 'Kracht 14 dagen laten vallen dempt je neuromusculaire output. Afbouwen, niet schrappen.'
    },
    hyroxNormal: {
      title: 'Hyrox training',
      pace: '—',
      details: 'Jouw geplande kracht / functionele sessie. Noteer af en toe je stationtijden — die sturen je compromised runs en je wedstrijdplan.',
      why: 'Dit is een zware dag, geen herstel: stations pieken hoger in lactaat dan de lopen.'
    },
    restEve: {
      title: 'Volledige rust — dag voor wedstrijd',
      pace: '—',
      details: 'Geen training. Wandelen, mobiliteit, stretchen als je zin hebt. Pak spullen in, speld bib op. Eet goed, drink veel, ga vroeg naar bed.',
      why: 'Laatste dag voor de wedstrijd. Nul trainingsstress.'
    },
    restNormal: {
      title: 'Rust',
      pace: '—',
      details: 'Volledige rust. Herstel.',
      why: 'Het lichaam past zich aan tussen sessies.'
    },
    shakeoutEve: {
      title: 'Losloopje op voorabend',
      pace: ({easy}) => `20 min op ${easy} + 4 versnellingen`,
      details: '20 min zeer rustig loopje + 4 × 20 s versnellingen op miletempo met volledig herstel. Meer niet.',
      why: 'Benen wakker maken. Voel de tempo’s één keer. Dan rust.'
    },
    shakeoutNormal: {
      title: 'Losloopje of rustig',
      pace: ({easy}) => `Optioneel 25–30 min op ${easy}`,
      details: 'Volledige rust is prima. Als je wilt bewegen: 25–30 min zeer rustig + 4 × 20 s versnellingen op vlakke ondergrond, volledig herstel tussen elk.',
      why: 'Herstel. Versnellingen voor een neuromusculaire opfrisser zonder kosten.'
    },
    easyNormal: {
      title: 'Rustige aerobe loop',
      pace: ({easy}) => easy,
      details: ({durationMin}) => `${durationMin} min echt rustig. Fiets of SkiErg als deze week zwaar is op onderlichaamskracht — lopen voegt excentrische belasting toe.`,
      why: ({isDeload}) => isDeload
        ? 'Herstel — korter, zelfde rustige intensiteit.'
        : 'Duurtrainingsvolume correleert met eindtijd op ρ = −0,68. Dit is de goedkoopste fitheid in het plan.'
    },
    timeTrialNormal: {
      title: 'Testloop',
      pace: ({ttMeters}) => `${ttMeters} m, alles eruit`,
      details: ({ttMeters}) => `15 min rustig + 3 versnellingen, dan ${ttMeters} m zo hard als je gelijkmatig kunt volhouden. Zet de tijd in Instellingen — alle tempo’s bewegen mee.`,
      why: 'Frisse benen in een herstelweek. Niets anders test het getal waar het hele plan op rust.'
    },
    longTaper: {
      title: 'Kort rustig',
      pace: ({easy}) => easy,
      details: ({durationMin}) => `Beperk dit tot ${durationMin} min. Volledig herstel voor wedstrijddag.`,
      why: 'Een lange loop nu maakt je niet fitter. Wel moe.'
    },
    longNormal: {
      title: 'Lange duurloop Zone 2',
      pace: ({easy}) => easy,
      details: ({durationMin}) => `${durationMin} min in rustig gesprektempo. Eindig met 4 × 20 s versnellingen.`,
      why: ({isDeload}) => isDeload
        ? 'Herstelweek — kortere duurloop, aerobe stress daalt maar ritme blijft.'
        : 'Aerobe basis. Zonder dit stagneert al het andere.'
    },
    intervalsTaper: {
      title: 'Wedstrijdtempo scherper',
      pace: ({p400}) => `Elke 400 m in ${p400}`,
      details: '4 × 400 m op Hyrox doeltempo, 200 m dribbel als herstel. 10 min inlopen / 5 min uitlopen. Stop terwijl je nog fris bent — geen extra’s.',
      why: 'Eén korte kwaliteitsimpuls houdt wedstrijdtempo in de benen zonder vermoeidheid op te bouwen.'
    },
    intervalsTaperEarly: {
      title: 'Doeltempo-herhalingen (ingekort)',
      pace: ({p400}) => `Elke 400 m in ${p400}`,
      details: ({reps}) => `${reps} × 400 m op Hyrox doeltempo, 200 m dribbel als herstel. 10 min inlopen / 5 min uitlopen. Zelfde tempo als drie weken terug, minder herhalingen.`,
      why: 'Eerste taperweek: volume omlaag, intensiteit en frequentie onveranderd.'
    },
    intervalsVo2Maintenance: {
      title: 'VO₂ intervallen · onderhoud',
      pace: ({vo2Low, vo2High}) => `Herhalingen op ~${vo2Low}–${vo2High}/km`,
      details: ({reps}) => `${reps} × 2 min hard / 90 s rustige dribbel. 10 min inlopen / 5 min uitlopen. Dit vervangt de drempelsessie deze week, het komt er niet bij.`,
      why: 'VO₂max is de sterkste enkele correlatie met eindtijd (ρ = −0,71). Eén dosis per twee weken houdt hem vast.'
    },
    intervalsRaceSpec: {
      title: 'Hyrox 400s op doeltempo',
      pace: ({p400}) => `Elke 400 m in ${p400}`,
      details: ({reps}) => `${reps} × 400 m op Hyrox doeltempo, 200 m dribbel als herstel. 10 min inlopen / 5 min uitlopen. Loop elke herhaling op hetzelfde tempo — niet zo snel mogelijk.`,
      why: ({isDeload}) => isDeload
        ? 'Herstel — minder herhalingen op hetzelfde doeltempo. Zelfde signaal, minder stress.'
        : 'De meest overdraagbare sessie — spiegelt de wedstrijdstructuur precies.'
    },
    intervalsSharpen: {
      title: 'Hyrox 1000s op doeltempo',
      pace: ({p1k}) => `Elke 1 km op ${p1k}`,
      details: ({reps}) => `${reps} × 1000 m op Hyrox doeltempo, 90 s staande rust. 10 min inlopen / 5 min uitlopen.`,
      why: ({isDeload}) => isDeload
        ? 'Herstel — minder herhalingen op doeltempo. Herstel; de simulatie komt eraan.'
        : 'Wedstrijdlengte-herhalingen op wedstrijdtempo. Als deze houden, houdt wedstrijdtempo ook.'
    },
    intervalsBuild: {
      title: 'Drempel 1000s',
      pace: ({thr}) => `Elke 1 km op ${thr}`,
      details: ({reps}) => `${reps} × 1000 m op drempel, 90 s staande rust tussen herhalingen. 10 min inlopen / 5 min uitlopen.`,
      why: ({isDeload}) => isDeload
        ? 'Herstel — zelfde drempelwerk, minder van. Absorbeer het blok.'
        : 'Langere intervallen tillen de drempel op en oefenen tempo-discipline.'
    },
    intervalsBase: {
      title: 'VO₂ intervallen',
      pace: ({vo2Low, vo2High}) => `Herhalingen op ~${vo2Low}–${vo2High}/km`,
      details: ({reps}) => `${reps} × 2 min hard / 90 s rustige dribbel. 10 min inlopen / 5 min uitlopen.`,
      why: ({isDeload}) => isDeload
        ? 'Herstel — minder herhalingen zodat het aerobe plafond kan adapteren.'
        : 'Blessurevriendelijke manier om het aerobe plafond vroeg in het blok op te bouwen.'
    },
    tempoTaper: {
      title: 'Kort tempo',
      pace: ({thr}) => `10 min op ${thr}`,
      details: '10 min op drempel. 10 min inlopen / 5 min uitlopen. Niet de sessie die ik zou kiezen in de laatste zeven dagen — een losloopje of de wedstrijdtempo-scherper is beter.',
      why: 'Jij hebt dit gekozen. Als je fris voelt is een kleine drempelimpuls OK.'
    },
    tempoTaperEarly: {
      title: 'Drempel tempo (ingekort)',
      pace: ({thr}) => `Op ${thr}`,
      details: ({durationMin}) => `${durationMin} min aaneengesloten op drempel. 10 min inlopen / 5 min uitlopen.`,
      why: 'Eerste taperweek: de drempelsessie blijft, op ongeveer tweederde van de lengte.'
    },
    tempoBase: {
      title: 'Drempel tempo',
      pace: ({thr}) => `Op ${thr}`,
      details: ({durationMin}) => `${durationMin} min aaneengesloten. 10 min inlopen / 5 min uitlopen.`,
      why: ({isDeload}) => isDeload ? 'Herstel — korter tempo, zelfde intensiteit.' : 'Duwt de lactaatdrempel omhoog — minder overspoeld bij elk station.'
    },
    tempoBuild: {
      title: 'Drempel tempo',
      pace: ({thr}) => `Op ${thr}`,
      details: ({sets, blockMin}) => `${sets} × ${blockMin} min, 2 min rustige dribbel tussen. 10 min inlopen / 5 min uitlopen.`,
      why: ({isDeload}) => isDeload ? 'Herstel — kortere blokken, zelfde drempeltempo.' : 'Duwt de lactaatdrempel omhoog — minder overspoeld bij elk station.'
    },
    tempoRaceSpec: {
      title: 'Drempel tempo',
      pace: ({thr}) => `Op ${thr}`,
      details: ({sets, blockMin}) => `${sets} × ${blockMin} min, 2 min rustige dribbel tussen. 10 min inlopen / 5 min uitlopen.`,
      why: ({isDeload}) => isDeload ? 'Herstel — kortere blokken, zelfde drempeltempo.' : 'Hogere drempel = minder overspoeld bij elke Hyrox-loop.'
    },
    tempoSharpen: {
      title: 'Drempel tempo',
      pace: ({thr}) => `Op ${thr}`,
      details: ({sets, blockMin}) => `${sets} × ${blockMin} min, 2 min rustige dribbel tussen. 10 min inlopen / 5 min uitlopen.`,
      why: 'Houd de drempelmotor scherp naast wedstrijdspecifiek werk.'
    },
    compromisedTaper: {
      title: 'Compromised (sla dit over in wedstrijdweek)',
      pace: ({p1k}) => `1 km op ${p1k}`,
      details: ({block}) => `Je hebt dit vastgezet in de laatste zeven dagen — ik zou het vervangen door de wedstrijdtempo-scherper. Als het moet: ${renderBlock(block, WORDS)}, dan één 1 km op doeltempo, dan stoppen.`,
      why: 'Volledig compromised werk zo dicht bij de wedstrijd is belasting die je niet meer verwerkt.'
    },
    compromisedTaperEarly: {
      title: 'Compromised run (ingekort)',
      pace: ({p1k}) => `1 km op ${p1k}`,
      details: ({block, reps1k, transitionSec}) => `${renderBlock(block, WORDS)} → dribbel de overgang (${transitionSec} s) → ${reps1k} × 1 km op doeltempo. Halve blok, zelfde tempo’s.`,
      why: 'Eerste taperweek: houd het patroon, schrap het volume.'
    },
    compromisedRaceSpec: {
      title: 'Compromised run',
      pace: ({p1k}) => `1 km op ${p1k}`,
      details: ({stations, reps1k, block, transitionSec}) => `${stations} stationblok${stations>1?'ken':''} — elk: ${renderBlock(block, WORDS)} — dribbel dan de roxzone (${transitionSec} s streef, klok loopt door) in ${reps1k} × 1 km op doeltempo. Noteer de 1 km split.`,
      why: ({isDeload}) => isDeload
        ? 'Herstel — één licht blok. Behoud het patroon, verlaag de belasting.'
        : 'Compromised is wat je wedstrijd bepaalt. De genoteerde split ijkt je doeltempo.'
    },
    compromisedSharpen: {
      title: 'Compromised blok of halve wedstrijdsim',
      pace: ({p1k}) => `1 km herhalingen op ${p1k}`,
      details: ({stations, reps1k, block, transitionSec}) => `${stations} blokken van ${renderBlock(block, WORDS)} + ${reps1k} × 1 km op doeltempo, ${transitionSec} s overgangen. Alternatief: 4 stations + 4 runs van de echte wedstrijd in volgorde op wedstrijdgewicht — een halve sim.`,
      why: 'Generale repetitie. Dit wil je gedaan hebben voor wedstrijddag.'
    },
    compromisedNormal: {
      title: 'Compromised run',
      pace: ({p1k}) => `1 km op ${p1k}`,
      details: ({block, transitionSec}) => `${renderBlock(block, WORDS)} → direct door in 1 km op doeltempo, ${transitionSec} s in de overgang. Zet je materiaal vooraf klaar. Noteer de 1 km split.`,
      why: 'Eén kort blok per twee weken vanaf half opbouw start de adaptatie maanden eerder.'
    },
    fallback: {
      title: 'Rustig 30 min',
      pace: ({easy}) => easy,
      details: '30 min in rustig tempo. 4 versnellingen aan het eind als je fris bent.',
      why: ''
    }
  },

  // --- Added in v3 ---
  tabToday: 'Vandaag',
  tabWeek: 'Week',
  tabBlock: 'Blok',
  blockTitle: 'Volledig blok',
  blockHint: 'Elke week van het begin van je blok tot wedstrijddag. Tik op een week om te openen.',
  blockWeekLabel: (n, total) => `Week ${n} van ${total}`,
  raceWeekShort: 'Race',
  markDone: 'Afvinken',
  markedDone: 'Gedaan',
  undo: 'Ongedaan maken',
  logTitle: 'Hoe ging het?',
  logHint: 'Afgevinkte sessies tellen mee voor je reeks en voltooiingspercentage.',
  rpeLabel: 'Inspanning (RPE) · alleen dagboek',
  noteLabel: 'Notitie',
  notePlaceholder: 'Voelde sterk, tempo vastgehouden op alle herhalingen…',
  streakLabel: (n) => n === 1 ? '1 week op rij' : `${n} weken op rij`,
  completionLabel: (done, total) => `${done} van ${total} sessies gedaan`,
  last28Days: 'Laatste 28 dagen',
  onlyThisDay: 'Alleen deze datum',
  everyWeek: 'Elke week',
  scopeHint: 'Wijzig alleen deze datum, of elke week vanaf nu.',
  clearOverride: 'Terug naar auto',
  dataTitle: 'Jouw gegevens',
  exportBtn: 'Back-up exporteren',
  importBtn: 'Back-up importeren',
  exportHint: 'Alleen opgeslagen in deze browser. iOS kan opslag wissen — exporteer af en toe.',
  importOk: 'Back-up hersteld.',
  importFailed: (reason) => `Importeren mislukt: ${reason}`,
  storageWarning: 'Kon niet opslaan in deze browser. Wijzigingen gaan verloren bij het sluiten — exporteer een back-up.',
  restartBlock: 'Blok herstarten',
  restartBlockHint: 'Telt de opbouw vanaf deze week. Je logboek blijft behouden.',
  restartBlockConfirm: 'Blok herstarten vanaf deze week? De opbouw begint opnieuw; je logboek blijft behouden.',
  updateAvailable: 'Er is een nieuwe versie klaar.',
  reloadBtn: 'Herladen',
  offlineReady: 'Klaar om offline te werken.',
  errorTitle: 'Er ging iets mis',
  errorBody: 'De planner liep tegen een fout aan. Je gegevens zijn nog opgeslagen. Herladen lost het meestal op.',
  errorReset: 'Terug naar standaardinstellingen',
  today: 'Vandaag',
  cancel: 'Annuleren',
  tipsTitle: 'Hoe uitvoeren',
  deloadTip: 'Herstelweek — houd de intensiteit, schrap het volume. Niet stiekem extra doen.',

  // --- Added in v4 ---
  stations: STATION_NAMES,
  tabRace: 'Wedstrijd',
  racePlanTitle: 'Wedstrijdplan',
  racePlanHint: 'Opgebouwd uit je doeltempo, je stationtijden en een roxzone-budget. Lopen is 52% van de wedstrijd, stations 40%, overgangen 8%.',
  predictedFinish: 'Verwachte eindtijd',
  predictedFinishHint: 'Lopen + stations + roxzone, op onderstaande tijden.',
  goalFinishLabel: 'Doel',
  goalPaceLabel: 'Tempo dat je doel vraagt',
  goalImpossible: 'Dat doel laat geen tijd over voor de lopen. Haal eerst tijd uit de stations.',
  runScheduleTitle: 'Loopschema',
  runScheduleHint: 'Vlak, ook de eerste loop. 15 s/km sneller starten kost ongeveer zes minuten in de tweede helft.',
  runLabel: (n) => `Loop ${n}`,
  stationTargetsTitle: 'Stations',
  stationTargetsHint: 'Jouw tijd tegen het 25e percentiel van het deelnemersveld. Gesorteerd op beschikbare seconden — daar wordt de wedstrijd gewonnen.',
  yourTimeLabel: 'Jij',
  targetTimeLabel: 'Doel',
  availableLabel: 'Beschikbaar',
  estimatedMark: 'schatting',
  estimatedHint: 'Schatting = nog geen benchmark, gemiddelde van het deelnemersveld gebruikt. Vul de jouwe in bij Instellingen.',
  roxzoneTitle: 'Roxzone',
  roxzoneBudget: (transitions, each, total) => `${transitions} overgangen × ${each} = ${total}`,
  roxzoneHint: 'Bovenste kwartiel 5:26, onderste 7:42. Die 2:16 is gratis — het kost geen fitheid, alleen oefening.',
  preRaceTitle: 'Protocol voor de start',
  preRaceSteps: [
    '10–15 min rustig inlopen, klaar 30 min voor je start.',
    '4 × 20 s versnellingen op doeltempo, volledig herstel.',
    'Eén stationrepetitie op wedstrijdgewicht — alleen het eerste station.',
    'Niets nieuws: zelfde schoenen, zelfde voeding, zelfde routine die je oefende.',
  ],
  intensityTitle: 'Weekintensiteit',
  intensityLabel: (hardPct, totalMin) => `${hardPct}% zwaar van ${totalMin} geplande min`,
  intensityWarning: 'Meer dan 30% zwaar. Hyrox-dagen tellen als zwaar — stations pieken hoger in lactaat dan de lopen. Ruil er één om voor rustig aeroob werk.',
  anchorTwoPoint: 'Kritische snelheid uit twee testlopen',
  anchorSinglePoint: 'Kritische snelheid geschat uit één 1 km',
  anchorDecay: (seconds) => `Stationstraf +${seconds} s/km`,
  timeTrialTitle: 'Testlopen',
  timeTrialHint: 'Twee inspanningen over verschillende afstanden (bijv. 1200 m en 2400 m) geven een echte kritische snelheid. Hertest op de laatste dag van elke herstelweek.',
  ttDistanceLabel: 'Afstand (m)',
  ttTimeLabel: 'Tijd (m:ss)',
  ttAddBtn: 'Testloop toevoegen',
  ttEmpty: 'Nog geen testlopen — tempo’s komen uit je 1 km hierboven.',
  ttEntry: (meters, time, date) => `${meters} m in ${time} · ${date}`,
  ttRemove: 'Verwijderen',
  benchmarksTitle: 'Station-benchmarks',
  benchmarksHint: 'Seconden voor de wedstrijddosis op wedstrijdgewicht. Stations zijn 40% van de wedstrijd; deze sturen je compromised runs en je wedstrijdplan. Hertest elke zes weken.',
  benchmarkStale: 'verouderd',
  benchmarkUnit: 'm:ss',
  splitLabel: '1 km split na het blok',
  splitHint: 'De kilometer die je direct uit het stationblok liep. Dit ijkt je doeltempo op jou.',
  divisionLabel: 'Divisie',
  divisionHint: 'Bepaalt de sled-, wall-ball- en carry-gewichten in je compromised runs.',
  divisions: { open: 'Open', pro: 'Pro', doubles: 'Doubles' },
  sexLabel: 'Categorie',
  sexes: { male: 'Mannen', female: 'Vrouwen' },
  goalFinishSetting: 'Doeltijd (u:mm)',
  goalFinishHint: 'Optioneel. Met een doeltijd toont het wedstrijdplan het tempo dat je doel echt vraagt.',
  goalFinishNone: 'Schat op basis van huidige vorm',
};
