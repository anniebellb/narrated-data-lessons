# Narration, timing and music

## Writing the script
- Story arc: **intro hook** (≈8 s, before explaining anything) → **how to read the chart**
  (one mark = one thing; what columns/rows/axes mean) → **3–5 story beats** (one true claim
  each, tied to `facts.json`) → **the summary** (aggregate chart, headline numbers) →
  **reflection** (a human takeaway that doesn't overclaim) → **your turn** (send them to Explore).
- 60–150 s total. Short sentences. Numbers written out ("seventy-five"). American spelling.
- Every named thing is shown and highlighted on that word (see storyboard.md).
- When the user asks for options, give 3–5 in final script form and wait.

## ElevenLabs tagging (`narration/script.txt`)
The `say` text in `video.json` is plain; the script sent to ElevenLabs adds:
- `[short pause]` between sentences, `[long pause]` between scenes
- ellipses for a beat before the key word: "spend the morning... ALONE"
- **one CAPS word per sentence** on the stressed word
Example: `Every dot here is ONE American... drawn from a national survey of how people spend their day. [short pause]`

## Recording (the user's ElevenLabs account; see user-guidance.md)
- Text to Speech → voice **Quentin – Narrator and Educator**, model **Eleven v4**,
  **Stability ≈ 80%**, **Language: English**, MP3 44.1 kHz 128 kbps.
- Paste the **whole script**; generate **one take** (never stitch clips: the voice drifts).
- Don't press Auto-tag (it rewrites the text). Check the character count matches.
- Download → `narration/narration.mp3`; set `"narration": "narration/narration.mp3"` in lesson.json.
- No account: `placeholder_voice.py` (Mac voice) or a silent preview (`estimate_timing.py`).

## Timing
`align_narration.py narration.mp3 --out narration.words.json` (Whisper, local; uses
`condition_on_previous_text=False` so long expressive pauses don't make it skip speech),
then `time_storyboard.py video.json narration.words.json`. Target ≥ 99% words matched;
if lower, look for skipped stretches and re-run.

## Music bed (optional)
- ElevenLabs Music: instrumental, ~2:00, prompt for calm/warm/steady ("unobtrusive, sits
  under a narrator, no vocals, no builds or drops"). Pick the take with the steadiest loudness.
- `prep_music.py <download> --out narration/music.m4a`; volume in lesson.json (`musicVolume`, default 0.045).
- The player fades it in (1.5 s), keeps it ~1.5 s past the last word, then fades out (4 s).
- **It must never end or loop audibly under the narrator.** If the video is longer than the
  track, extend it: `find_loop.py track.wav` (finds a jump with the same beat & chord), then
  `extend_music.py track.wav out.wav --cut <cut> --back <back> --xfade 0.8`.
