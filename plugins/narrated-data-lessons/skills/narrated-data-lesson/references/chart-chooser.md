# Choosing the chart type

Pick by the **learning question**, then confirm the data supports it (`profile_data.py`).
Animated + narrated charts need: things the narrator can name and point at, motion that
shows real change, and a pattern a learner can carry to other situations.

| Learning question | Chart | Data it needs | Good examples |
|---|---|---|---|
| *What do people do / who are they with, moment to moment?* | **dot-timeline** | Person-level records with a state over a timeline (diary, panel, clickstream), plus a grouping to compare | time use by age, how students move through a course, patient journeys |
| *How does something change over time?* | **line-reveal** | A measure over an ordered axis (years, dates, ages; ≥ 5 points), 1–8 lines | wages since 1980, test scores by grade, hours alone by age |
| *How do two things relate, and how has that shifted?* | **moving-scatter** | 5–300 things (countries, schools…) each with 2 measures (+ optional size) across ≥ 3 time points | income vs. life expectancy, study time vs. scores |
| *How much / how many out of 100?* | **unit-waffle** | A breakdown into 2–6 categories (counts or shares) for 1–5 groups, optionally over a few time frames | how people commute, vote, spend a dollar |

## Fit verdicts → what to tell the user
- **GOOD FIT:** "This works as a ___ because ___." Name the question it answers.
- **POSSIBLE:** say what's missing and the trade-off (e.g. "only 3 years, so the lines will
  be short; a waffle would show the breakdown better").
- **NOT A FIT (for all four):** say so plainly. Don't force a chart. Explain what data
  would work and offer to look for a public source that has it.

## Tie-breakers
- Prefer the chart whose **motion carries the point** (a trend → line; a shift in
  relationship → scatter; a share → waffle; behaviour of individuals → dots).
- Fewer, bigger things beat many small ones: ≤ 7 groups/columns, ≤ 8 lines, ≤ 6 categories.
- If two fit equally, pick the simpler for a beginner audience and mention the other.

## Data honesty checks before committing
- Is it a sample? Weighted? Say so in the notes.
- Are there periods/groups that distort the story (e.g. a pandemic year)? Exclude and say why.
- Does the data measure what the story claims? (e.g. "time alone" ≠ "loneliness").
