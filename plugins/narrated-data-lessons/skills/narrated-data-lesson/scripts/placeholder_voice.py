"""Record a free placeholder narration with the Mac's built-in voice, so a lesson can be
reviewed with sound before recording the real ElevenLabs narration.

    python3 placeholder_voice.py <lesson-folder> [--voice Samantha]

Writes <lesson>/narration/narration.m4a from video.json (scene texts, with pauses between
scenes). Then time the words: align_narration.py (needs faster-whisper) and
time_storyboard.py. macOS only; elsewhere use estimate_timing.py for a silent preview.
"""
import argparse
import json
import shutil
import subprocess
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lesson")
    ap.add_argument("--voice", default="Samantha")
    ap.add_argument("--rate", type=int, default=168)
    a = ap.parse_args()
    if not shutil.which("say"):
        raise SystemExit("No 'say' command (not a Mac). Use estimate_timing.py for a silent preview instead.")
    L = Path(a.lesson)
    V = json.loads((L / "video.json").read_text())
    text = " [[slnc 800]] ".join(s["say"] for s in V["scenes"])
    (L / "narration").mkdir(exist_ok=True)
    out = L / "narration" / "narration.m4a"
    subprocess.run(["say", "-v", a.voice, "-r", str(a.rate), "-o", str(out), "--file-format=m4af", "--data-format=aac", text], check=True)
    print(f"placeholder narration -> {out}  (set lesson.json \"narration\": \"narration/narration.m4a\")")


if __name__ == "__main__":
    main()
