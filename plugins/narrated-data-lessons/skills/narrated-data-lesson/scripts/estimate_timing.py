"""Estimate word timings from reading speed, so a lesson can be previewed before any
narration is recorded (the player runs on a silent clock when there's no audio file).

    python3 estimate_timing.py video.json --out narration/narration.words.json [--wpm 150]

Writes the same format as align_narration.py ({"duration", "words":[{w,start,end}]}),
adding a pause between sentences and a longer one between scenes. Then run
time_storyboard.py as usual. Replace with real timings once the narration is recorded.
"""
import argparse
import json
import re
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("storyboard")
    ap.add_argument("--out", required=True)
    ap.add_argument("--wpm", type=float, default=150)
    a = ap.parse_args()
    story = json.loads(Path(a.storyboard).read_text())
    per = 60 / a.wpm
    t, words = 0.4, []
    for sc in story["scenes"]:
        for w in sc["say"].split():
            d = per * (1.25 if len(re.sub(r"\W", "", w)) > 7 else 1)
            words.append({"w": w, "start": round(t, 3), "end": round(t + d * 0.9, 3)})
            t += d
            if w.endswith((".", "?", "!")):
                t += 0.45
            elif w.endswith(("...", ",", ":")):
                t += 0.2
        t += 0.9
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps({"duration": round(t, 3), "words": words, "estimated": True}, indent=1))
    print(f"{len(words)} words, ~{t:.1f}s (estimated at {a.wpm:.0f} wpm) -> {a.out}")


if __name__ == "__main__":
    main()
