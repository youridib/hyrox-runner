# Hyrox Runner

An evidence-based Hyrox running planner. Static site, installs to the iOS home
screen, works fully offline.

## Running it

```bash
npm install
npm run dev        # local dev server
npm test           # 355 tests
npm run build      # typecheck + production build into dist/
npm run preview    # serve the built site
```

## Deploying to Netlify

Either connect the repo (`netlify.toml` already sets the build command and
publish directory), or run `npm run build` and drag the `dist/` folder onto
Netlify's deploy page.

Then on the iPhone: open the site in Safari, Share → Add to Home Screen. It
launches standalone, with no browser chrome, and works with no connection.

## Layout

```
src/
  domain/        pure planning logic - no DOM, no storage, no strings
    dates.ts       calendar maths (UTC-anchored, DST-safe)
    phases.ts      phase windows, week-in-phase, deload cadence, taper decay
    zones.ts       critical speed, station-fatigue penalty, pace zones
    stations.ts    station benchmarks, weakness ranking, race-standard doses
    intensity.ts   weekly easy/moderate/hard accounting
    progression.ts session volume per phase/week/deload
    scheduler.ts   which session lands on which weekday
    racePlan.ts    predicted finish, run splits, station and roxzone targets
    plan.ts        builds the whole block, keyed to real dates
  state/
    schema.ts      validation + migration from every older shape
    store.ts       persistence, subscriptions, export
  i18n/          English and Dutch copy, typed against the domain
  ui/            Preact components
tests/           domain tests, DOM tests, and backtests
```

The important boundary is `src/domain/`: it is pure, so the whole planner can
be tested without a browser, and the UI cannot accidentally change training
logic.

## How the plan is built

`buildPlan(config, today)` returns the **entire block**, week by week, from the
block start through race week. Each day carries its phase, its week within
that phase, whether it is a deload, the session type, and the numbers for that
session.

Building the whole block - rather than only the current week - is what makes
progression well-defined. A day's position is its index in the block, not a
value reverse-engineered from how far away the race happens to be.

### The pace model

Every pace comes from **critical speed**, not from a fixed offset on a fresh
1 km. Two maximal efforts at different distances (say 1200 m and 2400 m) give a
real critical speed; one fresh 1 km gives a single-point estimate of the same
thing, so the original input still works and the second time trial is an
upgrade rather than a requirement.

Zones are then *fractions* of critical speed - easy 0.68-0.78, threshold
0.96-1.00, VO2 1.08-1.15 - because a fixed `+60 s` easy offset is +20% for a
5:00/km runner and +40% for a 2:30/km runner, which hands the slower athlete
the harder easy run.

**Hyrox target pace is critical speed plus a station-fatigue penalty**, seeded
at +30 s/km and recalibrated from your own logged compromised-run splits - it
is fully self-calibrated after about five of them. That is why target pace now
sits below threshold rather than above it: the race asks for 8 x 1 km with
34 minutes of near-maximal station work in between, not for a fresh 1 km.

Time trials are scheduled automatically on a late day of every deload week,
alternating 1200 m and 2400 m, so the anchor the whole plan rests on never
goes stale.

### Session selection

- Each week wants up to three quality sessions: intervals, a tempo, and either
  a long run or, once the block turns race-specific, a compromised run. In a
  deload week a time trial takes the place of one of them rather than sitting
  on top of all three.
- Hard sessions are never scheduled on adjacent days. When the free days
  cannot hold all three without stacking - four free days in a row can hold two
  at most - the planner drops the least important session rather than
  compromising the spacing. Which one is least important is phase-dependent:
  the tempo goes first in racespec and sharpen, a third interval session goes
  first in base and build.
- A VO2 session replaces the threshold session every second week through build
  and racespec. VO2max is the strongest single correlate of finish time
  (rho = -0.71) and used to lose its stimulus for the last 10+ weeks.
- Leftover days carry genuine easy aerobic running rather than another
  shakeout, when the week has room for it. Endurance volume correlates with
  finish time at rho = -0.68.
- **The taper is 14 days.** Taper week one keeps all three quality sessions at
  held intensity and frequency, with durations on an exponential decay to
  ~65%; the final seven days are fixed as before - rest the day before,
  shakeout two days out, one short sharpener three days out - at ~40-45%.
- Deloads stay on a four-week cadence counting back from the race, but never
  fire inside the first three weeks of a block.

### The other 48% of the race

Running is 52% of an average finish; the stations are 40% and the roxzone 8%.
The planner does not prescribe lifting, but it does measure the stations:

- **Station benchmarks** (the Stations tab) are ranked against the population
  25th percentile in *seconds available*, not percentage behind - which is what
  keeps the app pointed at wall balls (5:15 of spread) rather than the SkiErg
  (1:19). Anything untested is estimated rather than blank: with a goal finish
  the stations get what the goal leaves once the runs and roxzone are paid for,
  split by each station's share of the population total; without one the
  population averages are scaled to your own target pace, damped because
  running ability only partly transfers to the stations.
- **Compromised runs are built from that ranking**: your two worst stations in
  every block, the rest rotating, always in race order, at doses rendered from
  your division and category. They start at low dose from mid-build rather
  than waiting for racespec.
- **The roxzone** is trained as part of the session - jog in and out, set the
  next station up first, count the transition - and budgeted in the race plan
  at 8 x 40 s. Top quartile to bottom quartile is 2:16 of free time.

### The five tabs

- **Today** is read-only: the session, and practical notes on how to execute it
  well. Nothing to tap, so it works as a glance before you train.
- **Week** is where you change or log a session, with the whole week in view to
  change it against. It also shows how much of the week is hard, and warns
  above 30% - Hyrox days count as hard there, because the stations peak higher
  on lactate than the runs do.
- **Block** is every week from the block start to race day.
- **Stations** is where the other 40% of the race is scored: one row per
  station, ranked worst first by seconds available against the population 25th
  percentile. Times are entered as separate minute and second fields - a phone
  numeric keypad has no colon - and every untested station still shows a
  number, from your goal finish when you have set one and from your target
  pace otherwise. The goal itself is set here, in hours and minutes.

  With a goal, each station also carries its own goal target: the goal, minus
  your runs and the roxzone, split by that station's share of the population
  station total - so if wall balls are 17% of the average station time, they
  get 17% of your budget. Measure one and its time is spent first; the rest
  re-split what is left, so the plan keeps adding up to the goal. When your
  measured times no longer fit, the total goes red and says by how much
  rather than quietly relaxing the goal.
- **Race** is the race plan: predicted finish, a flat eight-run split schedule,
  your station times against the population target, a roxzone budget and the
  pre-race protocol.

### Two kinds of change

Changing a session asks which you mean:

- **Only this date** writes to `overrides`, keyed by ISO date.
- **Every week** writes to `weeklyTemplate`, keyed by weekday.

Overrides beat the template. In race week the template is ignored entirely -
"I usually lift on Saturdays" is not a decision to lift the day before a race -
but an explicit per-date override still stands.

## Data

Everything lives in `localStorage` under `hyroxRunner.v4`, and older keys are
migrated on first load. Storage is treated as untrusted: every field is
validated independently on read, so one corrupt value costs that value rather
than the whole block.

iOS can evict browser storage. Settings → Your data → **Export backup** writes
a JSON file; **Import backup** restores it. Worth doing occasionally.

## Testing

```bash
npm test
```

- **Unit tests** cover dates, phases, zones, progression, the scheduler and the
  state schema.
- **DOM tests** (`tests/ui.test.tsx`) render the real app and drive it: tab
  switching, changing a session, logging, settings, and recovery from corrupt
  or unavailable storage.
- **Backtests** (`tests/backtest.test.ts`) walk whole blocks day by day across
  eight race dates, seven weekly templates, both languages and every pace in
  range, asserting the invariants hold at every point - including that the plan
  never rewrites a day the user has already lived through.

## Fonts

Inter and JetBrains Mono load from Google Fonts without blocking paint, and the
app falls back to the system stack, which on iOS is SF Pro. That is what makes
a cold offline launch look right. To remove the CDN entirely, drop the woff2
files into `public/fonts/`, add `@font-face` rules, and delete the `<link>`
tags from `index.html`.

## Known limits

- Data is per-device. There is no sync; export/import is the way to move it.
- The planner assumes one race. Setting a new race date re-derives everything
  from that date; use **Restart block** to count progression from this week.
