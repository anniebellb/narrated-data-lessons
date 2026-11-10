"""Shrink a music download for the web (AAC 64 kbps, ~1 MB per 2 minutes). The player sets
the volume and fades, so no level changes are baked in.

    python3 prep_music.py music.mp3 --out <lesson>/narration/music.m4a
"""
import argparse
import shutil
import subprocess


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    if shutil.which("afconvert"):
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000", a.src, a.out], check=True)
    elif shutil.which("ffmpeg"):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", a.src, "-c:a", "aac", "-b:a", "64k", a.out], check=True)
    else:
        raise SystemExit("Needs afconvert (macOS) or ffmpeg.")
    print(f"music -> {a.out}")


if __name__ == "__main__":
    main()
