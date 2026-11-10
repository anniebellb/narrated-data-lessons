# Adding a chart type

A chart type is a folder `assets/charts/<type>/` with `chart.js` (an ES module), a
`sample/` starter lesson (made-up data, clearly labelled), a data format added to
data-formats.md, its cues added to storyboard.md, and a row in chart-chooser.md.

```js
export async function createChart({ mount, data, lesson, api }) {
  // mount: a div filling the stage; draw on your own canvas inside it (engine/fx.js helpers)
  // lesson.chartConfig: per-lesson display settings
  // api: { detail({kicker,title,color,body}), resetDetail(), font, ink, muted, faint, mode }
  return {
    pos: null | {                 // the timeline the video and Explore move along
      min, max, start, loop,      // loop: Explore wraps at max (false = stop)
      holdOnJumps,                // true: during fast jumps data holds, then moves once
      format: p => "7:00pm",      // big label at the top
      speeds: [{label, value}],   // Explore speeds (units per second); Pause is added
      defaultSpeed, ticks: [{v, label, major}]   // slider scale
    },
    views: [{ id, label, icon, usesPos }],   // optional second view (e.g. summary chart)
    setView(id),
    cueDefaults: { ... },         // the state every scene starts from
    setPos(p, { jump, snap }),    // jump: discontinuous (rebuild); snap: no glide
    apply(cue, { natural }),      // chart cues; natural=false when seeking (set state, no one-off effects)
    clear(),                      // drop all narration emphasis (leaving the video)
    frame(dt, now),               // animate + draw
    resize(),
    legend: () => [{ id, label, color, titleColor, desc }],   // Explore key (hover shows desc)
    hoverKey(id | null),          // key hover: highlight that group
    color: id => "#hex",          // caption term colors
  };
}
```

Rules for every chart type (design-rules.md): square/minimal theme, crisp marks, dim
the rest when narrating (≈7–15% opacity), crossfade label colors by alpha (never blend),
soft pulses that never cover text, exits faster than entrances, hover → detail box,
no motion that implies data that isn't there. Use `engine/fx.js` (box, BoxLayer, ring,
beacon, tag, halo, arc, crossText, approach, bump) so all charts feel the same.

Verify with the sample lesson: `check_lesson.py`, then browser screenshots at every beat.
