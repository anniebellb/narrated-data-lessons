# Data Visualizations: narrated dot-timeline lessons

Learning experiences built on real behavioral data. Each dot is one person; dots move between states through the
day; a narrated video walks learners through the story, then they explore it themselves.
Destined for LearnCurio / Mindsmith. The goal is to turn this into a reusable skill.

- **Design & interaction rules (read before building another):** [docs/design-rules.md](docs/design-rules.md)
- **How the first lesson evolved:** [docs/changelog.md](docs/changelog.md)

## Lesson 1: Who we spend our day with, by age (`viz/who-by-age/`)

American Time Use Survey 2015–2019 + 2022–2025 (81,148 people), 7 age groups ×
8 "who they're with" states. Video (≈2:03, 10 chapters, ElevenLabs narration + music bed)
and Explore (free-running simulation, hours-by-age line chart, table).

### Run it

```bash
python3 scripts/devserver.py 8123      # no-cache static server
```
Open http://localhost:8123/viz/who-by-age/

### Files

| Path | What it is |
|---|---|
| `data/raw/` | BLS ATUS 2003–2025 multi-year zips (activity, who, summary, respondent). **Not committed** (≈1 GB). Download from https://www.bls.gov/tus/data/datafiles-0325.htm |
| `scripts/build_who_by_age.py` | Raw ATUS → `data/who-by-age.json` (canonical schema below) |
| `data/who-by-age.json` | States, 500 resampled people per age group, aggregates (hours by age, state share by 10-min slot), source notes |
| `viz/who-by-age/index.html` | The lesson (single page: engine, styles, both tabs) |
| `viz/who-by-age/video.json` | Storyboard: scenes (`say` text + cue) and beats pinned to phrases |
| `viz/who-by-age/video.timed.json` | Storyboard with every word/beat timed (generated) |
| `viz/who-by-age/narration/script.txt` | ElevenLabs-tagged script (pauses, CAPS, ellipses) |
| `viz/who-by-age/narration/narration.mp3` | Current narration take (Quentin, Eleven v4, stability 80) |
| `viz/who-by-age/narration/narration.words.json` | Whisper word timings |
| `viz/who-by-age/narration/music.m4a` | Music bed, extended with a matched loop |
| `viz/who-by-age/narration/source/` | Original downloads (narration takes 1–3, two music takes) |
| `scripts/align_narration.py` | Whisper word timing (needs faster-whisper; the venv in `Hardware Learning/.venv-align` has it) |
| `scripts/time_storyboard.py` | Pins storyboard beats to the word timings |
| `scripts/find_loop.py` / `scripts/extend_music.py` | Find a seamless jump point in a music track and extend it |
| `scripts/devserver.py` | No-cache dev server (used by `.claude/launch.json`) |

### Canonical data schema (`dot-timeline/v1`)

```jsonc
{
  "states": [{ "id", "label", "note?" }],          // row order is set in the page
  "groups": [{ "id", "label", "n_respondents",
               "people": [[state, endMinute, state, endMinute, ...], ...] }],
  "clock": { "start": "04:00", "minutes": 1440 },
  "aggregates": { "hours_with_by_age": {...}, "state_share_by_slot": {...} },
  "source": { "name", "publisher", "url", "years_used", "respondents", "notes": [...] }
}
```
A person is a flat list of `[state index, minute the state ends]` pairs from the start of
the diary day. Any dataset that can be shaped like this can drive the same page.

### Rebuild pipeline

```bash
# 1. data
.venv/bin/python scripts/build_who_by_age.py

# 2. narration: record script.txt in ElevenLabs (settings in docs/design-rules.md §4),
#    save as viz/who-by-age/narration/narration.mp3, then time the words
"../Hardware Learning/.venv-align/bin/python" scripts/align_narration.py \
  viz/who-by-age/narration/narration.mp3 --out viz/who-by-age/narration/narration.words.json

# 3. pin the storyboard to the words (fails if a beat's phrase isn't in its scene)
python3 scripts/time_storyboard.py viz/who-by-age/video.json viz/who-by-age/narration/narration.words.json

# 4. music (only if the video outgrows the track)
afconvert -f WAVE -d LEI16 narration/source/<track>.mp3 /tmp/m.wav
.venv/bin/python scripts/find_loop.py /tmp/m.wav --cut 90 110 --back 8 75
.venv/bin/python scripts/extend_music.py /tmp/m.wav /tmp/ext.wav --cut <cut> --back <back> --xfade 0.8
python3 "../Hardware Learning/how-things-work/scripts/audio_prep.py" music /tmp/ext.wav \
  --out viz/who-by-age/narration/music.m4a
```
Current music splice: `--cut 90.28 --back 72.28 --xfade 0.8` (18 s = 6 bars apart).

### Environment

- Project venv `.venv` (pandas, numpy, pyarrow) for data + audio scripts.
- Whisper alignment uses `Hardware Learning/.venv-align` (faster-whisper, Python 3.9).
- macOS `afconvert` for audio conversion (no ffmpeg needed).
