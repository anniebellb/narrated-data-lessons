---
name: narrated-data-lesson
description: Turn a dataset (a link, CSV, Excel, JSON, or PDF table) into a narrated, animated data-visualization lesson with a Video tab (voice narration synced word-by-word to the chart, captions, chapters, music) and an Explore tab (interactive simulation). Checks whether the data fits, picks the best of four animated chart types (dot timeline, line reveal, moving scatter, unit/waffle), writes and fact-checks the script, and self-checks every step. Use when someone wants a data story, narrated data lesson, animated data explainer, or "make a lesson/visualization from this data", including non-technical users.
license: MIT (code), CC BY 4.0 (example content)
---

# Narrated data lesson

Builds a lesson like the reference example (`who we spend our day with, by age`): a
narrated video that performs on a live chart, then an Explore tab where learners play
with the data. One lesson = one folder with `index.html`, `lesson.json`, `data.json`,
`video.json` (storyboard), narration audio and an optional music bed.

**Read first:** [references/design-rules.md](references/design-rules.md) (approved look,
motion and emphasis rules; follow them exactly) and
[references/user-guidance.md](references/user-guidance.md) (how to work with the user).

Paths below are relative to this skill's folder (`${CLAUDE_SKILL_DIR}`).

## Who you're working with

Assume the user is **not technical**. Speak plainly, one step at a time, and tell them
exactly what to click when something needs them (downloading a file, signing in to
ElevenLabs, approving a script). Never ask them to edit code or JSON. Use the
walkthroughs in [references/user-guidance.md](references/user-guidance.md).

## The workflow (with checkpoints and self-checks)

Run the self-check at the end of **every** step. Don't move on with a FAIL.

### 1. Get the data
- Accept a link, a file, or a PDF. If a link is blocked (sites often block automated
  downloads), walk the user through downloading it in their browser and sharing the file.
- Profile it: `python3 scripts/profile_data.py <file-or-url>`.

### 2. Does it fit? (tell the user, always)
Read the profiler's verdicts and [references/chart-chooser.md](references/chart-chooser.md),
then tell the user in plain language:
- **Fits:** "This works as a ___ because ___." Name the learning question it answers.
- **Partly fits:** what works, what's missing, and the trade-off.
- **Doesn't fit:** say so clearly, explain why, and describe what data *would* work. Don't force it.

### ✋ Checkpoint 1: chart type and story angle
Propose the chart type, the main learning question, and 4–6 story beats (the things the
narrator will point out), each tied to a number you'll compute. Wait for the user's OK.

### 3. Shape the data
- Start the lesson folder: `python3 scripts/new_lesson.py --chart <type> --out <folder>`.
- Write a small, re-runnable script (in the lesson folder) that turns the source into
  `data.json` in the chart's format ([references/data-formats.md](references/data-formats.md))
  **and** writes `facts.json`: every number the narrator will say, computed from the
  source data, with how it will be spoken.
- **Self-check:** `python3 scripts/check_lesson.py <folder>`; also spot-check 2–3 values by
  hand against the source (open the raw file and find them). Report what you checked.

### 4. Write the story
- Write `video.json` (scenes, beats, cues) following [references/storyboard.md](references/storyboard.md)
  and the story arc in design-rules §1 (intro hook → how to read the chart → story beats →
  summary → reflection → "your turn").
- Write the narration script in the ElevenLabs style ([references/narration.md](references/narration.md))
  to `narration/script.txt`. Every claim must match `facts.json`; avoid overclaiming (design-rules §8).
- Fill `lesson.json`: title, kicker, key label, group descriptions, notes, sources.

### ✋ Checkpoint 2: approve the script
Show the script as plain text. Offer options when the user asks; don't apply changes
they haven't approved.

### 5. Preview (before any recording)
- Silent preview: `python3 scripts/estimate_timing.py <folder>/video.json --out <folder>/narration/narration.words.json`
  then `python3 scripts/time_storyboard.py <folder>/video.json <folder>/narration/narration.words.json`.
- Serve and open it: `python3 scripts/devserver.py 8123` (from the folder above the lesson),
  then `http://localhost:8123/<lesson>/`.
- **Self-check (browser):** follow [references/self-checks.md](references/self-checks.md):
  screenshots at every beat, nothing overlapping, no console errors, every named thing
  highlighted at its word.

### 6. Narration and music (needs the user's ElevenLabs account)
- Walk the user through signing in (user-guidance.md → ElevenLabs). Settings: voice
  **Quentin – Narrator and Educator**, **Eleven v4**, **Stability ≈ 80%**, **English**;
  the whole script in **one take**. Save as `narration/narration.mp3`.
- No ElevenLabs? Offer the free placeholder: `python3 scripts/placeholder_voice.py <folder>` (Mac).
- Time the words: `python3 scripts/align_narration.py <folder>/narration/narration.mp3 --out <folder>/narration/narration.words.json`,
  then `time_storyboard.py` again. Aim for ≥ 99% of words matched.
- Music (optional, ElevenLabs Music, instrumental, calm, ~2 min): prepare with
  `prep_music.py`; if the video is longer than the track, extend it with
  `find_loop.py` + `extend_music.py` (never let it end or loop under the narrator).
- **Self-check:** `check_lesson.py` (audio lengths, facts) + a full playthrough in the browser.

### ✋ Checkpoint 3: review together
Walk the user through the finished lesson: what to watch for, how to try Explore. Make
the changes they ask for, re-running the self-checks after each.

### 7. Publish (optional)
Walk them through GitHub Pages or any static host (user-guidance.md → Publishing). The
lesson folder is self-contained.

## Self-check rules (always)
- Run `scripts/check_lesson.py` after steps 3, 4, 5, 6 and after every revision.
- Verify in the browser after any visual change: take screenshots at the narrated moments
  and check them against the storyboard. Say what you checked.
- Recompute every narrated number from the source data; never type a number from memory.
- If something fails, fix it and re-check before telling the user it's done.

## Reference files
| File | Use it for |
|---|---|
| [references/design-rules.md](references/design-rules.md) | Look, motion, emphasis, narration, sync, music, data honesty |
| [references/chart-chooser.md](references/chart-chooser.md) | Which chart for which question; fit criteria |
| [references/data-formats.md](references/data-formats.md) | The four `data.json` formats |
| [references/storyboard.md](references/storyboard.md) | `video.json`: scenes, beats, cues per chart type, `facts.json` |
| [references/narration.md](references/narration.md) | Script style, ElevenLabs settings, timing, music |
| [references/self-checks.md](references/self-checks.md) | What to verify at each step |
| [references/user-guidance.md](references/user-guidance.md) | Plain-language walkthroughs for the user |
| [references/chart-interface.md](references/chart-interface.md) | Adding a new chart type |
