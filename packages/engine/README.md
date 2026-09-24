# @ajeenckya/engine

Pure training calculations. No React, no DOM, no network. Version 0.1.0.

```ts
import { decideCall, sleepPerformancePct } from "@ajeenckya/engine";
```

## Today's call

`decideCall` returns `push`, `build`, or `recover`. The first matching rule wins.

1. Illness is flagged → **recover**. A sick day never returns push or build.
2. Overreaching is flagged → **recover**.
3. Acute:chronic workload ratio ≥ 1.5 → **recover** (Gabbett spike zone).
4. Readiness &lt; 38, or HRV z-score &lt; −1.35, or injury-risk probability &gt; 0.55 → **recover**.
5. Readiness ≥ 72 and ACWR &lt; 1.25 and HRV z-score &gt; −0.25 and training-stress balance ≥ 0 → **push**.
6. Otherwise → **build**.

Training-stress balance is chronic load minus acute load.

## Strain

Edwards-style strain from minutes in zones 0–5:

```
strain = Σ minutesᵢ × weightᵢ
weights = 0.5, 1, 2, 3, 4, 5
```

Negative or non-finite minutes are ignored.

## Sleep

Default need is 7.5 hours.

```
performance = round(min(100, restMs / needMs × 100))
efficiency  = round(min(100, restMs / inBedMs × 100))
```

Invalid inputs return 0.

## Recovery age gate

A recovery-age number is published only when the history is real, at least 14 nights are collected, and at least 6 markers are collected. Sample nights never publish.

## Weather

Heat index is the NWS Rothfusz regression. Inputs are °C and relative humidity. Below 80°F the index is the air temperature. The low-humidity and high-humidity adjustments from the NWS note are applied.

Outdoor WBGT uses the Bureau of Meteorology full-sun approximation:

```
e (hPa) = (rh / 100) × 6.105 × exp(17.27 × Ta / (237.7 + Ta))
WBGT    = 0.567 × Ta + 0.393 × e + 3.94
```

The best outdoor hour over the next 36 hours prefers daylight (06:00–20:00) and minimizes:

```
|tempC − 16| + 0.35 × UV + 0.08 × precipChance
```

## Other

`timeOfDayGreeting(hour)` clamps to 0–23. Before 05:00 is night, before 12:00 morning, before 17:00 afternoon, otherwise evening. A non-finite hour is afternoon.

`parseLocaleNumber` accepts `.` or `,` as the decimal mark, and both `1.234,5` and `1,234.5`. Empty or non-finite text returns null.
