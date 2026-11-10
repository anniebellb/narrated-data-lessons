# data.json formats

Each chart type reads one JSON shape. `check_lesson.py` validates it. Keep files small
(< 5 MB): sample people, round numbers to the precision you'll show.

## dot-timeline/v1
```jsonc
{
  "schema": "dot-timeline/v1",
  "states": [{ "id": "alone", "label": "Alone" }, ...],          // every state a dot can be in
  "groups": [{ "id": "15–24", "label": "Ages 15–24",            // columns being compared
               "people": [[state, endMinute, state, endMinute, ...], ...] }],
  "source": { "name", "publisher", "url", "notes": [...] }
}
```
A person = flat list of `[state index, minute that state ends]` from the start of the
timeline (0–1440 for a day; last end must be 1440). Resample people by survey weight so
each dot is an equal share; ~200 per group. Display settings (row order, colors, grey
rows, header stat, pulse/arcs/halo states, summary chart) go in `lesson.json → chartConfig`
(see `examples/who-by-age-engine/lesson.json`). Optional summary view = a line-reveal file.

## line-reveal/v1
```jsonc
{
  "schema": "line-reveal/v1", "title": "Hours per day with each group, by age",
  "x": { "label": "Age", "min": 15, "max": 80, "tickEvery": 5, "format": "{v}", "lastLabel": "80+" },
  "y": { "label": "Hours", "min": 0, "max": 9, "tickEvery": 2, "unit": "h", "decimals": 1 },
  "series": [{ "id": "alone", "label": "Alone", "color": "#2a78d6", "emphasis": true,
               "desc": "shown on hover in the key", "points": [[15, 4.2], [16, 4.4], ...] }]
}
```
Points sorted by x; all y within the axis range. `chartConfig.markLabel` e.g. `"{y} hrs at {x}"`.

## moving-scatter/v1
```jsonc
{
  "schema": "moving-scatter/v1", "title": "...",
  "time": { "label": "Year", "values": [2000, 2001, ...], "format": "{v}" },
  "x": { "label": "Income", "min": 500, "max": 100000, "log": true, "unit": "", "prefix": "$" },
  "y": { "label": "Life expectancy", "min": 40, "max": 90 },
  "size": { "label": "Population", "max": 1.4e9 },                 // optional
  "groups": [{ "id": "asia", "label": "Asia", "color": "#2a78d6", "desc": "" }],   // ≤ 6
  "entities": [{ "id": "jp", "label": "Japan", "group": "asia",
                 "values": { "2000": [x, y, size], "2001": [...] } }]
}
```
Missing years are fine (the bubble interpolates). `chartConfig.alwaysLabel: [ids]`.

## unit-waffle/v1
```jsonc
{
  "schema": "unit-waffle/v1", "title": "...", "unitLabel": "Each square is 1 person out of 100",
  "unitsPerPanel": 100, "columns": 10,
  "categories": [{ "id": "car", "label": "Car", "color": "#eb6834", "desc": "" }],  // fill order, ≤ 6
  "frames": [{ "id": "2015", "label": "2015",
               "panels": [{ "id": "city", "label": "City", "shares": { "car": 0.25, "bus": 0.35, ... } }] }]
}
```
Shares per panel sum to 1 (counts are rounded so each panel shows exactly 100). One
frame = a still breakdown; several frames = squares recolour as time passes.

## Colors
Use the validated categorical order (design-rules): `#2a78d6` blue, `#eb6834` orange,
`#1baf7a` aqua, `#eda100` yellow, `#e87ba4` magenta, `#008300` green, then fold extras into
"Other". Greys (`#9d9a92`, `#c4c0b6`) for "not recorded" states.
