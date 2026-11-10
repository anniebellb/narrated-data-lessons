# Self-checks

Check continuously; never tell the user something works until you've verified it. After
each check, say briefly what you verified.

## Automated (`scripts/check_lesson.py <folder>`): after steps 3, 4, 5, 6 and every revision
- lesson.json complete; every file it points to exists; chart type exists
- data matches the chart format (ranges, sorted x, shares sum to 1, valid sequences)
- `video.timed.json` is current (re-time after any script edit); every beat was timed
- every fact in `facts.json` is spoken and matches the data within its rounding
- narration length matches the storyboard; music long enough to outlast the narration

## Data accuracy (step 3)
- Compute every narrated number in the data script, from the source; write it to facts.json.
- Spot-check 2–3 values by hand against the raw source (open it, find the row).
- Sanity checks: totals add up, no impossible values, sample sizes per group are adequate
  (note small ones), excluded periods/groups are stated in the notes.

## Visual (browser, steps 5–6 and after any visual change)
- Open via `devserver.py` (no caching), check the console: no errors.
- Play the video, or scrub to each beat, and take a screenshot at each narrated moment:
  - the thing being named is visibly highlighted at that word
  - the clock/axis value matches what's said ("seven in the evening" → 7:00pm)
  - nothing overlaps: tags, labels, pulses, boxes, captions
  - transitions are smooth (no snapping, no streaking, no stray leftovers after a beat)
- Explore: starts at the beginning, speed buttons work, slider scale matches the clock,
  hovering a mark and a key item fills the detail box, view switch works.
- Measure rather than eyeball when it matters (e.g. read element positions via JS).

## Audio (step 6)
- ≥ 99% of words matched when timing; listen-critical spots: the first word, every
  number, the last line.
- Music: steady level, no end/loop under narration, fades after the last word.

## Before handing over
Run the automated check, play the whole video once, try Explore, and list for the user
what was verified and anything not verified (e.g. "I can't hear audio, so please listen
for the music level").
