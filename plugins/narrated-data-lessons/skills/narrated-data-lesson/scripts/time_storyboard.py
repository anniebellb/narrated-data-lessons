"""Pin a video storyboard to a narration recording.

    python3 scripts/time_storyboard.py viz/who-by-age/video.json viz/who-by-age/narration/narration.words.json

Reads the storyboard (scenes with `say` text and beats with `at` phrases) and the
word timings (from Whisper, or ElevenLabs' alignment), matches the script to the
transcript word by word (so a transcription slip on one word doesn't shift the
rest), and writes <storyboard>.timed.json next to the storyboard:
  scenes[i].start / .end      seconds
  scenes[i].words             [{w, t}] caption words with the time each is spoken
  scenes[i].beats[j].t        seconds the beat's phrase is spoken
Fails loudly if a beat's phrase isn't in its scene's `say`.
"""
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def num_words(n):
    n = int(n)
    if n < 20:
        return [ONES[n]]
    if n < 100:
        return [TENS[n // 10]] + ([ONES[n % 10]] if n % 10 else [])
    return [str(n)]


def tokens(text):
    """Normalized tokens for one written word ('seventy-five,' -> ['seventy','five'], '75' -> same)."""
    out = []
    for part in re.split(r"[-\s]+", text.lower()):
        part = re.sub(r"[^a-z0-9']", "", part).replace("'", "")
        if not part:
            continue
        out += num_words(part) if part.isdigit() else [part]
    return out


def main(story_path, words_path):
    story = json.loads(Path(story_path).read_text())
    rec = json.loads(Path(words_path).read_text())

    # transcript tokens with times
    t_tok, t_time = [], []
    for w in rec["words"]:
        for tk in tokens(w["w"]):
            t_tok.append(tk)
            t_time.append(w["start"])

    # script tokens, remembering which scene/word each belongs to
    s_tok, owner = [], []
    for si, sc in enumerate(story["scenes"]):
        sc["_words"] = sc["say"].split()
        for wi, w in enumerate(sc["_words"]):
            for tk in tokens(w):
                s_tok.append(tk)
                owner.append((si, wi))

    times = [None] * len(s_tok)
    for a, b, n in SequenceMatcher(None, s_tok, t_tok, autojunk=False).get_matching_blocks():
        for k in range(n):
            times[a + k] = t_time[b + k]
    # interpolate gaps
    known = [i for i, t in enumerate(times) if t is not None]
    if not known:
        sys.exit("no words matched the recording")
    for i in range(len(times)):
        if times[i] is None:
            prev = max([k for k in known if k < i], default=None)
            nxt = min([k for k in known if k > i], default=None)
            if prev is None:
                times[i] = times[nxt]
            elif nxt is None:
                times[i] = times[prev] + 0.3 * (i - prev)
            else:
                times[i] = times[prev] + (times[nxt] - times[prev]) * (i - prev) / (nxt - prev)
    matched = len(known) / len(times)

    word_t = {}
    for (si, wi), t in zip(owner, times):
        word_t.setdefault((si, wi), t)

    scenes = story["scenes"]
    for si, sc in enumerate(scenes):
        sc["words"] = [{"w": w, "t": round(word_t.get((si, wi), 0), 3)} for wi, w in enumerate(sc["_words"])]
        flat = [(tk, wi) for wi, w in enumerate(sc["_words"]) for tk in tokens(w)]
        ftok = [f[0] for f in flat]
        for beat in sc.get("beats", []):
            phrase, nth = (beat["at"].split("#") + ["1"])[:2]
            p = tokens(phrase)
            hits = [i for i in range(len(ftok) - len(p) + 1) if ftok[i:i + len(p)] == p]
            if len(hits) < int(nth):
                sys.exit(f'scene "{sc["id"]}": phrase "{beat["at"]}" not in its say text')
            beat["t"] = round(word_t[(si, flat[hits[int(nth) - 1]][1])] + beat.get("offset", 0), 3)
        del sc["_words"]
    for si, sc in enumerate(scenes):
        sc["start"] = 0.0 if si == 0 else round(max(sc["words"][0]["t"] - 0.35, scenes[si - 1]["words"][-1]["t"] + 0.2), 3)
    for si, sc in enumerate(scenes):
        sc["end"] = scenes[si + 1]["start"] if si + 1 < len(scenes) else round(rec["duration"] + 1.5, 3)
    story["duration"] = scenes[-1]["end"]
    story["audio"] = Path(words_path).with_name(Path(words_path).name.replace(".words.json", "")).name

    out = Path(story_path).with_suffix(".timed.json")
    out.write_text(json.dumps(story, indent=1))
    print(f"matched {matched:.0%} of script words; {len(scenes)} scenes, {story['duration']:.1f}s -> {out}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
