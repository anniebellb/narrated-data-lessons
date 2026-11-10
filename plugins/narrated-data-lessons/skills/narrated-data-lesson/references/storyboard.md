# Storyboard (video.json) and facts.json

The video is the chart performing to the narration. `video.json` lists scenes; each
scene has the spoken text (`say`), a chapter `title`, a starting `cue`, and `beats`
whose cues fire **on the word** in `at`. `time_storyboard.py` pins every word and beat
to the recording (or to estimated timings for a silent preview) and writes `video.timed.json`.

```jsonc
{
  "terms": { "alone": ["alone", "no one"] },        // caption words tinted with that id's color
  "scenes": [
    { "id": "meet", "title": "How to read the chart",
      "say": "Every dot here is one American...",     // exactly what the narrator says
      "cue": { "view": "sim", "pos": 0, "focus": null },
      "beats": [ { "at": "every dot", "cue": { "pulse": true } },
                 { "at": "teenagers", "cue": { "focus": { "cols": [0] } } } ] }
  ]
}
```
- `at` must appear in that scene's `say` (`"stem#2"` = second occurrence); the timing
  script fails otherwise.
- Beats inherit everything set earlier in the same scene. Each scene starts from its own
  `cue` plus the chart's defaults, so set what the scene needs.
- Seeking (chapters, scrubbing) rebuilds the exact state at that moment; effects that
  only make sense live (pulses, cascades) fire only during normal playback.

## Engine cues (every chart type)
| Cue | Meaning |
|---|---|
| `pos` (or `clock`) | Keyframe: at this word the timeline shows this value. Linear between keyframes; fast jumps ease. |
| `view` | Switch the chart's view (e.g. `"sim"` / `"chart"`). |
| `clockCallout: true` | First time a time is stated: the clock pops blue with a ring. |
| `spinClock: true` | Intro: the clock spins through the whole range (display only). |
| `nudge: "explore"` | Pulse the Explore tab when the narrator names it. |

## Chart cues
**dot-timeline:** `focus: {rows:[stateIds], cols:[groupIdx], header}` (dims the rest; row
labels take the group color) · `outline: true` (highlight boxes, only while teaching how
to read the chart) · `pulse: true` ("1 person") · `grand: true` + `connect: 1..3` (arcs
from other groups into one person; `chartConfig.connect`) · `breathe: true` (halo wave on
`chartConfig.breatheState`) · `together: true` (halo cascade on social groups) ·
`rowCascade` / `colSweep` (intro) · `chartFocus: "id"`, `chartMark: [x,…]` (summary chart).

**line-reveal:** `focus: {series:[ids]}` · `marks: [{series, x, label?}]` (soft pulse; label above).
Use `pos` to draw the lines up to an x value.

**moving-scatter:** `focus: {entities:[ids], groups:[ids]}` · `trail: [ids]` (dotted path
through past years) · `beacon: {entity, label}` (pulse + tag). Use `pos` to move through time.

**unit-waffle:** `focus: {categories:[ids], panels:[ids]}` (one category → shows "N of 100")
· `outline: true` (box the focused panels) · `beacon: {panel, category, label}`. `pos` = frame index.

## facts.json (accuracy)
Written by the data script, from the source data, never by hand:
```json
[{ "id": "alone-at-80", "value": 8.07, "spoken": 8, "round_ok": 0.1,
   "source": "hours alone per day at age 80+ (5-year rolling mean)" }]
```
`check_lesson.py` FAILs if a fact isn't spoken in the narration or the spoken number is
further from the data than `round_ok` (fraction) allows.
