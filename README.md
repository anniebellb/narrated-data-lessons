# Narrated Data Lessons

Turn a dataset into a **narrated, animated data lesson**: a short video where a narrator
walks learners through the data while the chart performs, word by word, followed by an
**Explore** mode where they play with it themselves.

**▶ See it live:** [Who we spend our day with, and how it changes as we age](https://anniebellb.github.io/narrated-data-lessons/viz/who-by-age/)
(American Time Use Survey, 81,148 people)

This repo contains:
1. **The example lesson** you can watch, read and fork.
2. **A Claude Code skill** that builds new lessons from your own data: give it a link or
   a file, and it checks whether the data fits, picks the best chart type, writes and
   fact-checks a script, records narration, and assembles the lesson with you.
3. **A reusable lesson engine** with four animated chart types.

## What you need

| To… | You need |
|---|---|
| Watch the example | Nothing: open the link above |
| Build your own lessons with the skill | [Claude Code](https://claude.com/claude-code), Python 3 (with `pandas`), a modern browser |
| Add a real narrator voice and music | **An [ElevenLabs](https://elevenlabs.io) account.** The skill uses it for the narration (voice: *Quentin – Narrator and Educator*, Eleven v4) and optional background music. A paid plan is recommended if you'll publish the lesson; check ElevenLabs' terms for your plan. Without an account you can still build and preview lessons with a free placeholder voice (Mac) or silently with captions. |
| Precise word timing for recorded narration | `faster-whisper` (optional, Python 3.9–3.12) |
| Share your lesson with a link | A free GitHub account (GitHub Pages) or any static web host |

## Use the skill

In Claude Code:
```
/plugin marketplace add anniebellb/narrated-data-lessons
/plugin install narrated-data-lessons@narrated-data-lessons
```
Then just ask, for example: *"Make a narrated data lesson from this data: <link or file>"*.

The skill will:
1. **Check your data** and tell you plainly whether it works for this kind of lesson (and if not, why, and what data would).
2. **Suggest the chart type and the story** → you approve.
3. **Shape the data** and compute every number the narrator will say (checked against the source).
4. **Write the script** → you approve.
5. **Show you a preview**, then walk you through recording the narration in ElevenLabs.
6. **Check itself at every step**: data accuracy, timing, and how it looks at every narrated moment.

It's written for non-technical users: it tells you exactly what to click whenever it needs you.

**Other ways to install:** copy `plugins/narrated-data-lessons/skills/narrated-data-lesson/`
to `~/.claude/skills/narrated-data-lesson/`, or zip that folder and upload it at
claude.ai → Customize → Skills. **Updating:** `/plugin marketplace update narrated-data-lessons`.

## The four chart types

| Chart | Best for |
|---|---|
| **Dot timeline** | What people do, moment to moment, compared across groups (one dot = one person). See the [example lesson](https://anniebellb.github.io/narrated-data-lessons/viz/who-by-age/). |
| **Line reveal** | How something changes over time (lines draw as the narrator speaks) |
| **Moving scatter** | How two measures relate and shift over the years (one bubble = one country, school…) |
| **Unit / waffle** | How many out of 100, compared across groups and over time |

Each chart type ships with a small **starter template** (made-up placeholder data, no
narration) that the skill copies and replaces with your data, script and recorded voice.
The templates are building blocks, not finished lessons.

## Fork it / branch off it

Fork this repo to make your own lessons, add chart types, or change the look.
- **Design and interaction rules** (look, motion, narration, sync, emphasis effects, music, data honesty):
  [`references/design-rules.md`](plugins/narrated-data-lessons/skills/narrated-data-lesson/references/design-rules.md)
- **Adding a chart type:** [`references/chart-interface.md`](plugins/narrated-data-lessons/skills/narrated-data-lesson/references/chart-interface.md)
- **The example lesson on the shared engine:** [`examples/who-by-age-engine/`](examples/who-by-age-engine/)

## Repository layout

```
viz/who-by-age/                the original example lesson (as approved), with narration + music
data/who-by-age.json           its data (built by scripts/build_who_by_age.py)
examples/who-by-age-engine/    the same lesson running on the shared engine (template for forks)
plugins/narrated-data-lessons/ the Claude Code plugin
  skills/narrated-data-lesson/
    SKILL.md                   the workflow, checkpoints and self-checks
    references/                design rules, chart chooser, data formats, storyboard, narration, guidance
    assets/engine/             lesson player (shell, video, captions, music, Explore) + shared effects
    assets/charts/<type>/      the four chart types, each with a starter template (placeholder data)
    scripts/                   data profiler, lesson checker, timing, placeholder voice, music tools
docs/                          design log and changelog from building the first lesson
scripts/                       pipeline for the example lesson
```

## Rebuilding the example lesson's data

The raw survey files (~1 GB) aren't included. Download the ATUS 2003–2025 multi-year
**Activity**, **Who** and **Activity summary** files from the
[BLS](https://www.bls.gov/tus/data/datafiles-0325.htm) into `data/raw/`, then:
```
python3 -m venv .venv && .venv/bin/pip install pandas pyarrow
.venv/bin/python scripts/build_who_by_age.py
```

## License

- **Code** (engine, chart types, scripts, skill): [MIT](LICENSE)
- **Lesson content** (scripts, narration and music recordings, lesson text, docs): [CC BY 4.0](LICENSE-CONTENT.md)
  (reuse with credit to Annie Kiele Brown)
- **Data:** American Time Use Survey data is from the U.S. Bureau of Labor Statistics (public domain).
