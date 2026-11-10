# Changelog: Who we spend our day with (lesson 1)

How the first lesson got to its approved state (2026-11-09), in order. Kept so the
skill can avoid the dead ends. The rules these produced are in [design-rules.md](design-rules.md).

## Concept & data
- Concept: animated dots (one per person) moving between states through a day.
  Scope narrowed to **real data only** (no simulated theories).
- Distribution model decided: **a skill that lives in a GitHub repo** (repo = distribution,
  skill = interface). Inputs tiered: microdata sequences (best) → aggregate tables
  (synthesized, labeled illustrative) → no person×state×time shape (say no).
- ATUS multi-year files downloaded through the browser (BLS blocks scripted downloads).
- Who-codes mapped to 6 companion states + 2 "company not asked" states; priority when
  several present: children > partner > family > friends > others. Years 2015–19 + 2022–25.

## Visual form
1. Free-floating force-layout bubbles, one age group at a time → **jarring motion**.
2. Switched to a **grid** (columns = ages, rows = states).
3. Force physics made big clusters "boil" → **fixed-slot sunflower packing**, eased glide.
4. Branding tried: LearnCurio (cursive logo, white) → replaced by the **keyboard-switch
   lesson's design** → its **minimal theme** (square corners, white/grey, blue accent).
5. Layout: left narrative panel, right stage (from the switch lesson).
6. Dot contrast: crisp darker rims (kept); lighter stage (rejected → light grey kept,
   lighter center, slightly darker corners); stronger dimming of non-narrated dots (kept).
7. Touching clusters: ovals (rejected: "weird"), adaptive smaller dots (rejected: "too
   small") → **kept original size**; accept occasional touching.

## Lesson structure
- Quiz: added as a check → moved first as "predict, then watch" with guesses revealed in
  the video → **removed entirely**.
- Video: storyboard engine (scenes + phrase-pinned beats), word-by-word captions, chapters.
- Narration: macOS placeholder → **ElevenLabs Quentin** (3 takes: base, + intro, + reflection).
- Intro hook added ("We all get the same twenty-four hours… Let's take a look.").
- Reflection added (loneliness as public-health concern + "Small moments, together…
  go a LONG way"), with Surgeon General source note.

## Sync bugs fixed
- Clock drifted from narration (queued "play at speed" commands) → **clock keyframes
  pinned to words**.
- Seeking snapped to 0:00 (dev server lacked range requests) → **audio loaded as blob**.
- Stale browser cache replayed removed narration → **no-cache dev server + fetch no-cache**.
- Whisper skipped 18 s of an expressive take → **condition_on_previous_text=False**.
- "Jump ahead" made dots streak → dots hold during fast clock sweeps, then glide once.

## Emphasis effects (in the order they were added)
Dimming → highlight boxes (only in "how to read" chapters; uniform sizes; breathing
room; glide; Sleep & Work boxed one after another) → "1 person" pulse → clock call-out →
row-label colour (fixed to an alpha crossfade, constant weight) → chart-marker pulse
(softened; clear of labels) → Alone-row halo wave (dots-growing version rejected) →
connection arcs (reversed to flow *into* the grandparent; routed below; no tag line;
fast exit) → "together" halo cascade → intro: clock spin (sped up to 1.5 s) → category
cascade with row band pulse → header sweep → grid fade-up.

## Explore
Speed control under the clock (Slow 4 / Medium 10 / Fast 30), hour-scale slider, group
key with hover definitions (title in group colour), collapsible "About the data",
starts at 4:00am when coming from the video. "Hours by age" label kept.

## Music
Music bed ("A Lifetime In Small Moments") chosen for steadiness → volume lowered to 4.5%
(other options generated, not used) → track ended under the narration → extended with a
time-picked crossfade (sounded like overlap) → **re-spliced at a musically matching point**
(1:30 → 1:12, same beat & chord).

## Skill & engine (narrated-data-lessons)
- Repo renamed **narrated-data-lessons**; made public-ready (MIT code, CC BY 4.0 content, landing page, GitHub Pages).
- Lesson split into a **chart-agnostic engine** (shell, storyboard, captions, chapters, audio,
  music, Explore) + **four chart types**: dot timeline (ported; original lesson left untouched),
  line reveal, moving scatter, unit/waffle. Bar race and maps deferred (harder to read in motion).
- Shared effects library (`engine/fx.js`) so every chart pulses, boxes, tags and fades the same way.
- Holding data still during fast jumps is a per-chart setting (dot timeline only; scatter should move).
- Silent preview clock uses real elapsed time (frame-counted time crawled in background tabs).
- Skill: data profiler with plain-language fit verdicts (link/CSV/Excel/JSON/PDF), three
  user checkpoints, `check_lesson.py` self-check (data format, stale timing, narrated numbers
  vs `facts.json`, audio lengths), beginner walkthroughs, starter lessons per chart type.
