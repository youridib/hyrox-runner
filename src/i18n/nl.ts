import type { Dict } from './types';

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
    taper:    { label: 'Wedstrijdweek',        desc: 'Volume gaat omlaag. Alleen korte kwaliteit. Vertrouw op het werk.' },
    sharpen:  { label: 'Aanscherpen',          desc: 'Piek wedstrijdspecifiek. Simulaties, dan aftrainen.' },
    racespec: { label: 'Wedstrijdspecifiek',   desc: '1 km-herhalingen op doeltempo. Eerste compromised runs.' },
    build:    { label: 'Opbouw',               desc: 'Intervallen worden langer. Meer drempelwerk.' },
    base:     { label: 'Basis',                desc: 'Bouw rustig volume op. Alleen korte intervallen.' },
  },
  racePassed: 'Wedstrijd voorbij',
  raceToday: 'Wedstrijd vandaag.',
  daysToRace: (n) => n===1 ? '1 dag tot wedstrijd' : `${n} dagen tot wedstrijd`,
  daysToGo:   (n) => n===1 ? '1 dag te gaan' : `${n} dagen te gaan`,
  weekOf: (w, t) => `Week ${w} van ${t}`,
  deloadBadge: 'Herstel',
  deloadNote: 'Herstelweek \u2014 zelfde intensiteit, ~40% minder volume. Lichaam consolideert zodat het volgende blok harder aankomt.',
  todayLabel: 'Vandaag',
  pinnedLabel: 'Vastgezet',
  raceDayLabel: 'Wedstrijddag',
  thisWeek: 'Deze week',
  thisWeekHint: 'Tik op een dag om de sessie te zien. Kies een type om te overschrijven \u2014 andere dagen worden aangepast volgens de wetenschap.',
  paceZones: 'Tempo-zones',
  paceZonesSub: (pace) => `van ${pace}/km fris`,
  sessionType: 'Sessietype',
  raceWeekTitle: 'Wedstrijdweek',
  raceWeekDesc: 'Volume gaat ~40% omlaag. Vertrouw op het werk \u2014 niets nieuws deze week. Aanscherpen, slapen, voeding.',
  types: {
    auto: 'Auto', hyrox: 'Hyrox', intervals: 'Intervallen', tempo: 'Tempo',
    long: 'Duurloop', compromised: 'Compromised', shakeout: 'Losloopje', rest: 'Rust'
  },
  zones: {
    easy: 'Rustig Z2', threshold: 'Drempel', target: 'Hyrox doeltempo',
    vo2: 'VO\u2082 intervallen', strides: 'Versnellingen'
  },
  language: 'Taal',
  raceDate: 'Wedstrijddatum',
  currentPace: 'Huidig 1 km tempo \u00b7 fris',
  paceUnit: 'min/km',
  paceHint: 'Jouw beste 1 km tijd uitgerust. Alle tempo\u2019s worden hiervan afgeleid.',
  hyroxDays: 'Hyrox trainingsdagen',
  hyroxDaysHint: 'Snelle instelling. Fijnere aanpassingen (compromised op di, rust op do, enz.) per dag in de weekweergave.',
  heaviestDay: 'Zwaarste Hyrox dag',
  heaviestDayHint: 'Geldt elke week. Indien ingesteld, worden zware lopen weggehaald bij de dag erna.',
  variesWeekly: 'Wisselt per week',
  resetWeek: 'Reset week',
  savedInBrowser: 'Alleen opgeslagen in deze browser.',
  footerLine1: 'Gebaseerd op de Hyrox loop-referentie',
  footerLine2: 'Frontiers in Physiology 2025 \u00b7 PMC 5839711',
  deloadSuffix: ' \u00b7 herstel',
  session: {
    race: {
      title: 'WEDSTRIJDDAG',
      pace: '\u2014',
      details: 'Gelijke splits. Eerste 1 km moet makkelijk voelen \u2014 adrenaline maskeert de kosten. Val binnen 100 m na elk station terug in je tempo.',
      why: 'Vertrouw op het werk. Warm goed op, tank bij, race slim.'
    },
    hyroxTaper: {
      title: 'Hyrox training (licht)',
      pace: 'Alleen techniek \u2014 geen volume',
      details: ({dtr}) => `Wedstrijd is over ${dtr ?? 'enkele'} dagen. Houd het HEEL licht: techniekdrills, bewegingsrepetitie op wedstrijdgewicht, geen intensiteit. Of sla helemaal over.`,
      why: 'Niets te winnen met een zware sessie nu. Alles te verliezen.'
    },
    hyroxNormal: {
      title: 'Hyrox training',
      pace: '\u2014',
      details: 'Jouw geplande kracht / functionele sessie.',
      why: 'Geen loopdag. Herstel van looptrainingen gebeurt hier.'
    },
    restEve: {
      title: 'Volledige rust \u2014 dag voor wedstrijd',
      pace: '\u2014',
      details: 'Geen training. Wandelen, mobiliteit, stretchen als je zin hebt. Pak spullen in, speld bib op. Eet goed, drink veel, ga vroeg naar bed.',
      why: 'Laatste dag voor de wedstrijd. Nul trainingsstress.'
    },
    restNormal: {
      title: 'Rust',
      pace: '\u2014',
      details: 'Volledige rust. Herstel.',
      why: 'Het lichaam past zich aan tussen sessies.'
    },
    shakeoutEve: {
      title: 'Losloopje op voorabend',
      pace: ({easy}) => `20 min op ${easy} + 4 versnellingen`,
      details: '20 min zeer rustig loopje + 4 \u00d7 20 s versnellingen op miletempo met volledig herstel. Meer niet.',
      why: 'Benen wakker maken. Voel de tempo\u2019s \u00e9\u00e9n keer. Dan rust.'
    },
    shakeoutNormal: {
      title: 'Losloopje of rustig',
      pace: ({easy}) => `Optioneel 25\u201330 min op ${easy}`,
      details: 'Volledige rust is prima. Als je wilt bewegen: 25\u201330 min zeer rustig + 4 \u00d7 20 s versnellingen op vlakke ondergrond, volledig herstel tussen elk.',
      why: 'Herstel. Versnellingen voor een neuromusculaire opfrisser zonder kosten.'
    },
    longTaper: {
      title: 'Kort rustig',
      pace: ({easy}) => easy,
      details: 'Beperk dit tot 30\u201340 min. Volledig herstel voor wedstrijddag.',
      why: 'Een lange loop deze week maakt je niet fitter. Wel moe.'
    },
    longNormal: {
      title: 'Lange duurloop Zone 2',
      pace: ({easy}) => easy,
      details: ({durationMin}) => `${durationMin} min in rustig gesprektempo. Eindig met 4 \u00d7 20 s versnellingen.`,
      why: ({isDeload}) => isDeload
        ? 'Herstelweek \u2014 kortere duurloop, aerobe stress daalt maar ritme blijft.'
        : 'Aerobe basis. Zonder dit stagneert al het andere.'
    },
    intervalsTaper: {
      title: 'Wedstrijdtempo scherper',
      pace: ({p400}) => `Elke 400 m in ${p400}`,
      details: '4 \u00d7 400 m op Hyrox doeltempo, 200 m dribbel als herstel. 10 min inlopen / 5 min uitlopen. Stop terwijl je nog fris bent \u2014 geen extra\u2019s.',
      why: 'E\u00e9n korte kwaliteitsimpuls houdt wedstrijdtempo in de benen zonder vermoeidheid op te bouwen.'
    },
    intervalsRaceSpec: {
      title: 'Hyrox 400s op doeltempo',
      pace: ({p400}) => `Elke 400 m in ${p400}`,
      details: ({reps}) => `${reps} \u00d7 400 m op Hyrox doeltempo, 200 m dribbel als herstel. 10 min inlopen / 5 min uitlopen. Loop elke herhaling op hetzelfde tempo \u2014 niet zo snel mogelijk.`,
      why: ({isDeload}) => isDeload
        ? 'Herstel \u2014 minder herhalingen op hetzelfde doeltempo. Zelfde signaal, minder stress.'
        : 'De meest overdraagbare sessie \u2014 spiegelt de wedstrijdstructuur precies.'
    },
    intervalsSharpen: {
      title: 'Hyrox 1000s op doeltempo',
      pace: ({p1k}) => `Elke 1 km op ${p1k}`,
      details: ({reps}) => `${reps} \u00d7 1000 m op Hyrox doeltempo, 90 s staande rust. 10 min inlopen / 5 min uitlopen.`,
      why: ({isDeload}) => isDeload
        ? 'Herstel \u2014 minder herhalingen op doeltempo. Herstel; de simulatie komt eraan.'
        : 'Wedstrijdlengte-herhalingen op wedstrijdtempo. Als deze houden, houdt wedstrijdtempo ook.'
    },
    intervalsBuild: {
      title: 'Drempel 1000s',
      pace: ({thr}) => `Elke 1 km op ${thr}`,
      details: ({reps}) => `${reps} \u00d7 1000 m op drempel, 90 s staande rust tussen herhalingen. 10 min inlopen / 5 min uitlopen.`,
      why: ({isDeload}) => isDeload
        ? 'Herstel \u2014 zelfde drempelwerk, minder van. Absorbeer het blok.'
        : 'Langere intervallen tillen de drempel op en oefenen tempo-discipline.'
    },
    intervalsBase: {
      title: 'VO\u2082 intervallen',
      pace: ({vo2Low, vo2High}) => `Herhalingen op ~${vo2Low}\u2013${vo2High}/km`,
      details: ({reps}) => `${reps} \u00d7 2 min hard / 90 s rustige dribbel. 10 min inlopen / 5 min uitlopen.`,
      why: ({isDeload}) => isDeload
        ? 'Herstel \u2014 minder herhalingen zodat het aerobe plafond kan adapteren.'
        : 'Blessurevriendelijke manier om het aerobe plafond vroeg in het blok op te bouwen.'
    },
    tempoTaper: {
      title: 'Kort tempo',
      pace: ({thr}) => `10 min op ${thr}`,
      details: '10 min op drempel. 10 min inlopen / 5 min uitlopen. Niet de sessie die ik zou kiezen in wedstrijdweek \u2014 een losloopje of de wedstrijdtempo-scherper is beter.',
      why: 'Jij hebt dit gekozen. Als je fris voelt is een kleine drempelimpuls OK.'
    },
    tempoBase: {
      title: 'Drempel tempo',
      pace: ({thr}) => `Op ${thr}`,
      details: ({durationMin}) => `${durationMin} min aaneengesloten. 10 min inlopen / 5 min uitlopen.`,
      why: ({isDeload}) => isDeload ? 'Herstel \u2014 korter tempo, zelfde intensiteit.' : 'Duwt de lactaatdrempel omhoog \u2014 minder overspoeld bij elk station.'
    },
    tempoBuild: {
      title: 'Drempel tempo',
      pace: ({thr}) => `Op ${thr}`,
      details: ({sets, blockMin}) => `${sets} \u00d7 ${blockMin} min, 2 min rustige dribbel tussen. 10 min inlopen / 5 min uitlopen.`,
      why: ({isDeload}) => isDeload ? 'Herstel \u2014 kortere blokken, zelfde drempeltempo.' : 'Duwt de lactaatdrempel omhoog \u2014 minder overspoeld bij elk station.'
    },
    tempoRaceSpec: {
      title: 'Drempel tempo',
      pace: ({thr}) => `Op ${thr}`,
      details: ({sets, blockMin}) => `${sets} \u00d7 ${blockMin} min, 2 min rustige dribbel tussen. 10 min inlopen / 5 min uitlopen.`,
      why: ({isDeload}) => isDeload ? 'Herstel \u2014 kortere blokken, zelfde drempeltempo.' : 'Hogere drempel = minder overspoeld bij elke Hyrox-loop.'
    },
    tempoSharpen: {
      title: 'Drempel tempo',
      pace: ({thr}) => `Op ${thr}`,
      details: ({sets, blockMin}) => `${sets} \u00d7 ${blockMin} min, 2 min rustige dribbel tussen. 10 min inlopen / 5 min uitlopen.`,
      why: 'Houd de drempelmotor scherp naast wedstrijdspecifiek werk.'
    },
    compromisedTaper: {
      title: 'Compromised (sla dit over in wedstrijdweek)',
      pace: ({p1k}) => `1 km op ${p1k}`,
      details: 'Je hebt dit vastgezet in de wedstrijdweek \u2014 overweeg sterk het te vervangen door de wedstrijdtempo-scherper. Als het moet: beperk tot 2 stations + 1 \u00d7 1 km op doeltempo, dan stoppen.',
      why: 'Volledige compromised in de taper is te veel belasting zo dicht bij de wedstrijd.'
    },
    compromisedRaceSpec: {
      title: 'Compromised run',
      pace: ({p1k}) => `1 km op ${p1k}`,
      details: ({stations, reps1k}) => `${stations} station${stations>1?'s':''} blok${stations>1?'ken':''} (elk: 500 m roeien + 40 wall balls + 2 \u00d7 50 m sled) \u2192 direct ${reps1k} \u00d7 1 km op doeltempo.`,
      why: ({isDeload}) => isDeload
        ? 'Herstel \u2014 \u00e9\u00e9n licht blok. Behoud het patroon, verlaag de belasting.'
        : 'Compromised is wat je wedstrijd bepaalt. Train wat je gaat doen.'
    },
    compromisedSharpen: {
      title: 'Compromised blok of halve wedstrijdsim',
      pace: ({p1k}) => `1 km herhalingen op ${p1k}`,
      details: ({stations, reps1k}) => `${stations} stations + ${reps1k} \u00d7 1 km op doeltempo. Alternatief: 4 stations + 4 runs van de echte wedstrijd in volgorde op wedstrijdgewicht \u2014 een halve sim.`,
      why: 'Generale repetitie. Dit wil je gedaan hebben voor wedstrijddag.'
    },
    compromisedNormal: {
      title: 'Compromised run',
      pace: ({p1k}) => `1 km op ${p1k}`,
      details: 'Station blok (500 m roeien + 40 wall balls + 2 \u00d7 50 m sled) \u2192 direct 1 km op doeltempo. Herhaal \u00e9\u00e9n keer als je fris bent.',
      why: 'Compromised is wat je wedstrijd bepaalt. Train wat je gaat doen.'
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
  rpeLabel: 'Inspanning (RPE)',
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
};
