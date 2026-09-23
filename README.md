# Hyrox Runner

An evidence-based Hyrox running planner. Static site, installs to the iOS home
screen, works fully offline.

## Running it

```bash
npm install
npm run dev        # local dev server
npm test           # 231 tests
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
    phases.ts      phase windows, week-in-phase, deload cadence
    zones.ts       pace zones derived from one fresh 1 km pace
    progression.ts session volume per phase/week/deload
    scheduler.ts   which session lands on which weekday
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

### Session selection

- Each week wants up to three quality sessions: intervals, a tempo, and either
  a long run or, once the block turns race-specific, a compromised run.
- Hard sessions are never scheduled on adjacent days. When the free days
  cannot hold all three without stacking - four free days in a row can hold two
  at most - the planner drops the least important session rather than
  compromising the spacing.
- Race week is fixed: rest the day before, shakeout two days out, one short
  sharpener three days out.

### The three tabs

- **Today** is read-only: the session, and practical notes on how to execute it
  well. Nothing to tap, so it works as a glance before you train.
- **Week** is where you change or log a session, with the whole week in view to
  change it against.
- **Block** is every week from the block start to race day.

### Two kinds of change

Changing a session asks which you mean:

- **Only this date** writes to `overrides`, keyed by ISO date.
- **Every week** writes to `weeklyTemplate`, keyed by weekday.

Overrides beat the template. In race week the template is ignored entirely -
"I usually lift on Saturdays" is not a decision to lift the day before a race -
but an explicit per-date override still stands.

## Data

Everything lives in `localStorage` under `hyroxRunner.v3`, and older keys are
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
