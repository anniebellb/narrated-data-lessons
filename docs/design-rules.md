# Design & interaction rules (for the dot-timeline lesson skill)

> The maintained copy of these rules ships with the skill: `plugins/narrated-data-lessons/skills/narrated-data-lesson/references/design-rules.md`. This file is the original design log from lesson 1.

Every rule below came from review with the project owner while building the first
lesson, **Who we spend our day with, by age** (`viz/who-by-age/`). They are written so
they apply to any dataset with the *person × state × time* shape (time-use surveys,
life-course panels, course engagement logs…). Things that only apply to the first
lesson are marked **[who-by-age]**.

Each rule has a **why** so edge cases can be judged rather than pattern-matched.
Reference implementation: `viz/who-by-age/index.html`. Pipeline: `README.md`.

---

## 1. Lesson structure

- **Two tabs: Video → Explore.** The narrated video comes first (learners watch the story),
  then Explore (they play with it). Same order as the how-things-work lessons.
- **No quiz.** A quiz tab (first as a check, then as "predict before you watch") was built
  and removed: *"the quiz isn't working well. just remove it."* Don't add one unless asked.
- **Video storyline** (the approved arc):
  1. **Intro hook** (≈8 s) before any chart explanation. Approved text:
     *"We all get the same twenty-four hours. But WHO we spend them with... changes a lot
     over a lifetime. Let's take a look."*
  2. **How to read the chart**: one dot = one person; what columns are; what rows are.
  3. **Story beats**: specific times of day, each making one claim that's true in the data.
  4. **The aggregate**: switch to the summary chart (lines) and name the headline numbers.
  5. **Reflection / takeaway** (≈20 s): a human takeaway, honest about what the data
     can and can't say (see §8).
  6. **Your turn**: send learners to Explore.
- **Chapter titles must read naturally.** "Meet the dots" was rejected as clunky. Good:
  "Intro", "How to read the chart", "Who we're with", "4am: almost everyone asleep",
  "Mid-morning: work and school", "7pm: evenings at home", "Fewer friends with age",
  "Time alone adds up", "Small moments, together", "Your turn".
- **Explore always starts at the beginning of the day** (4:00am, playing) when arriving from
  the video; it must not inherit the video's last clock time.

## 2. Look & feel (the how-things-work "minimal" theme)

Match the keyboard-switch lesson in `Hardware Learning` exactly: base `styles.css` +
`themes/minimal.css`, **light only**.

- **Square corners everywhere** (panel, stage, tabs, buttons-as-segments, captions,
  player bar, cards). Pill shape only for primary/ghost `.tw-btn`.
- **White and grey:** page `#f5f5f7`, panel `#ffffff`, ink `#1d1d1f`, muted `#6e6e73`,
  faint `#86868b`, accent **blue `#0071e3`**. System font stack (SF Pro first).
- **Stage background:** white center fading to light grey at the edges:
  `radial-gradient(95% 85% at 50% 42%, #fff 36%, #d2d2d8 100%)`. The owner rejected a
  lighter, almost-flat stage ("go back to the light grey") but wanted the middle a bit
  lighter and the corners *a tiny bit* more shaded.
- **No branding/logos** in the panel (the Curio wordmark was removed). Kicker is a plain
  topic line, e.g. "Human behavior" (not "Human behavior · Time use").
- **End card ("Your turn") is solid white** over a light dark scrim (`rgba(29,29,31,.16)`)
  so it reads as white against the grey stage.
- Layout: left panel 330px (kicker, title, mode tabs, scrollable body, bottom detail box);
  right stage fills the rest. The stage's top area holds the clock; the bottom holds the
  player (Video) or the dock (Explore). Give the grid generous space below the clock.

## 3. The dot grid (the core visual)

Form: a grid. **Columns = groups being compared** (age bands), **rows = states** (who
they're with). Chosen over a ring of states around one population (comparing groups means
switching views) and a mixed two-colour layout (only works for 2 groups).

- **Dots never fly across the screen**: each dot is locked to its column and only moves
  between rows. (The first free-floating version was "jarring".)
- **Fixed-slot packing, no physics.** Each cell is a dense sunflower spiral (slot k at
  radius `SP·√(k+0.5)`, angle `k·golden`). Arrivals take the next slot; a departure is
  filled by the cell's last dot. No force simulation: physics made big clusters "boil".
- **Motion is an exponential ease** toward the slot (τ ≈ 420 ms). Fade/opacity τ ≈ 280 ms.
- **Row order puts the most common transitions next to each other** (e.g. Sleep at the
  bottom with Alone and Partner directly above it).
- **Dot size: R = 2.6px, 200 dots per group, round clusters.** Rejected alternatives:
  stretching clusters into ovals ("looks weird") and shrinking dots / fewer dots so big
  clusters never touch ("dots too small"). Accept that the largest clusters may touch
  on short screens.
- **Crisp dots:** every dot gets a thin rim in a darker shade of its own colour
  (`d3.color(c).darker(0.9)`, ~0.8px, ~45% alpha). Keep this.
- **Grey for "not recorded" states** (here Sleep and Work/class: the survey doesn't ask
  who was present). They should recede, not compete.
- Column headers show the group name plus one live headline stat (here "% alone").
- **Margins:** row labels inset (x=16), header lower (y≈24/42), so highlight boxes can sit
  *outside* labels/headers/dots with breathing room.

## 4. Narration (video) production

- **Voice:** ElevenLabs, **Quentin – Narrator and Educator**, model **Eleven v4**,
  **Stability ≈ 80%**, **Language: English**, MP3 44.1 kHz 128 kbps. Record the
  **whole script as one take** (never splice clips) so the voice stays consistent.
- **Script style** (from the keyboard-switch script): `[short pause]` between sentences,
  `[long pause]` between scenes, ellipses for a beat before the key word, **one CAPS word
  per sentence** on the stressed word, numbers written out ("seventy-five"), American spelling.
- **Every claim is checked against the data before it's written.** E.g. "nearly HALF of
  adults under fifty-five are at work" (not "most": the survey includes weekends).
- **Offer options before changing narration wording.** The owner picks; options are
  written in final script form with tags.
- **Word timing:** Whisper (`scripts/align_narration.py`, `condition_on_previous_text=False`,
  since expressive takes with long pauses made Whisper skip 20 s), then
  `scripts/time_storyboard.py` pins every beat to its spoken word. Target ≥ 99% word match.
- **Audio is loaded as a blob** (fetch → objectURL) so seeking works on any host.

## 5. Video ↔ visual sync (non-negotiable)

- **Everything the narrator names is shown at that word.** Beats are keyed to phrases
  in `video.json`; the build fails if a phrase isn't in its scene's text.
- **The clock is a pure function of video time**: keyframes (`clock` cues) pinned to words,
  linear between them. Never "play at speed X" queues: they drifted ("narration says 7pm,
  screen shows 11:22am").
- **Fast jumps ("jump ahead to 7pm"):** the clock counts up but dots hold, then each dot
  glides once to its destination (no streaking through every hour).
- **Captions** fill in word by word; group names in the caption turn their group colour.
- **Nothing on screen during narration should be static**: every line gets a visual
  (e.g. the intro got: clock spin → row-label cascade → header sweep → grid fade-up).
- **Seeking/chapters rebuild the exact state** the storyboard reaches at that time.

## 6. Highlight & emphasis toolkit (reusable)

All emphasis uses the accent blue unless it's a group's own colour. **Pulses are soft.**

| Effect | When | Spec |
|---|---|---|
| **Dim the rest** | narrator names a row/column/cell | non-focused dots → 7% opacity; focused dots +0.7px and stronger rim |
| **Highlight box** | *only* while teaching how to read the chart | square, 2px accent stroke, soft glow, 7% tint; outside labels/dots with padding; **all row boxes same height, column boxes same width**; never show two different-size boxes at once (step from one to the next); a single box **glides** between targets |
| **Row-label colour** | narrator names a group | label crossfades (alpha, not colour blend) to the group colour; **constant font weight** (blending/bold-switching looked "weird") |
| **"1 person" pulse** | "Every dot is ONE …" | one dot: two staggered rings, slight swell, tag "1 person"; rest fades to ~22% |
| **Clock call-out** | first time the narrator states a time | clock turns blue, pops twice, ring grows out |
| **Clock spin** | "the same twenty-four hours" | display-only spin through 24h in 1.5 s, done before the next effect starts |
| **Category cascade** | "who we spend them with" | rows light top→bottom, each with a soft band in its colour across the row + label swell |
| **Header sweep** | "over a lifetime" | headers turn blue left→right with a 3px lift |
| **Chart markers** | narrator names a number on the summary chart | dot + label; **soft** pulse (2 rings, ~45% start alpha, 2 s, max ~2.3×) that **never overlaps the label** |
| **Row halo wave** | broad statement about one state ("loneliness…") | soft radial halo behind every cluster of that state, wave across groups. **Don't grow the dots** (they merged into blobs) |
| **Connection arcs** | the takeaway's call to action | arcs flow **from** other groups **into** the person in focus, eased (~1.1 s) with a glowing tip, routed below the row (never through tags); source ripples, arrival pulse; tag above the cluster, **no leader line** |
| **Together cascade** | "Small moments, together" | colored halos ripple left→right over all *social* clusters; previous arcs/tags vanish fast (~70 ms τ) |

General motion rules: everything eases (no snaps); exits are faster than entrances;
effects only fire during natural playback (seeking cancels them).

**Tags** ("1 person", "Someone's grandparent") are **solid white** with the blue outline:
they pop in fully opaque and never look see-through while fading.

**Smooth on every browser** (it looked fine locally but was janky for viewers):
- **No `shadowBlur` in anything drawn every frame.** It's very slow in Safari. Fake glows
  with a few wide, faint strokes (boxes, arcs) or a small radial gradient (arc tip).
- **Draw repeated marks from pre-rendered sprites** (one small canvas per colour at screen
  resolution, positions snapped to device pixels). Vector-draw only marks mid-transition or hovered.
- **Interpolate the video clock** between audio time reports (some browsers report coarse
  steps): advance with the frame clock, re-anchor on each report, never step backwards.
- **Only touch the page when something changed**: cache caption spans, skip identical
  text/slider writes.
- Test on the live host, not just locally (network, caching), and in Safari when possible.

**Every screen size** (check phone 375, tablet 768, small laptop 1024, 1280, 1440, 1920):
- **Never scroll sideways.** The chart always fits its stage.
- **Wide screens (≈1280px+) keep the approved look exactly** (scale 1). Below that, dots and
  clusters scale down just enough that a full cluster fits its column, and the label column
  and fonts tighten (≈800px and ≈560px tiers).
- **Phones (<600px):** half the dots per group; column stats show just the number with the
  label written once at the left; the caption is 3 lines that scroll with the narrator, below
  the chart (never covering it); slider labels every other tick; dock buttons on one row.

## 7. Explore tab

- Clock **centered** at top with Pause/Slow/Medium/Fast **centered under it**, small.
  Speeds (sim-minutes per second): **Slow 4 · Medium 10 · Fast 30**.
- **Time slider** with a clock-style scale: tick every hour, labels every 3 hours
  (6am…3am), nearest label bold; thumb synced to the clock. No "4am … 4am" end labels.
- Dock buttons: Simulation / Hours by age (the owner chose to keep these labels).
- Side panel: **group key with no inline notes.** Hovering a group shows its definition in
  the grey detail box at the bottom, **title in the group's colour**. Hovering a dot shows
  that person's full day. "About the data" is a **collapsed dropdown** with space above it.
- The summary chart: lines by age, rolling average, legend toggles, hover crosshair,
  "Show table" fallback.

## 8. Data honesty

- Each dot is a weighted-resampled respondent, not a tracked person; say so.
- States the survey didn't record are shown grey and explained.
- Exclude periods that distort the story (here 2020–21 pandemic years) and say why.
- **Takeaways must not overclaim**: e.g. the reflection says "time alone isn't the same as
  loneliness", and any outside claim (loneliness ≈ smoking) gets its source in About the data.
- Animations must not imply data that isn't there (arcs are drawn *over* the chart; no dot
  is moved to a state it isn't in).

## 9. Music

- **Soft instrumental bed** under the narrator (ElevenLabs Music v2.5, instrumental, ~2 min,
  calm/warm/no builds). Picked by **steadiness** (loudness range) as well as feel.
- **Volume 4.5%**, fade in 1.5 s, **keep playing ~1.5 s past the last word, then fade 4 s.**
- **The music must never end, pause or loop audibly during the video.** If the video is
  longer than the track, extend it with `scripts/find_loop.py` (finds a musically matching
  jump: same beat & chord) + `scripts/extend_music.py` (short equal-power crossfade of the
  *same* musical moment). A time-picked 6 s crossfade sounded like overlapping music.

## 10. Process

- Verify every change in the browser (screenshots / measured values), not just in code.
- Use a no-cache dev server (`scripts/devserver.py`): stale caching made fixed bugs
  reappear.
- When asked "give me options", give options and wait; don't apply.
