"""Start a new lesson folder from a chart type's starter, fully self-contained (the
engine and chart are copied in), so the finished lesson can be hosted anywhere.

    python3 new_lesson.py --chart <dot-timeline|line-reveal|moving-scatter|unit-waffle> --out <folder>

Creates:
  <folder>/index.html          the page (open through a local server: devserver.py)
  <folder>/lesson.json         title, chart type, files, Explore settings, notes, sources
  <folder>/data.json           REPLACE with the real data (format: references/data-formats.md)
  <folder>/video.json          REPLACE with the storyboard (format: references/storyboard.md)
  <folder>/assets/engine/...   lesson player (don't edit per lesson)
  <folder>/assets/charts/<type>/chart.js
"""
import argparse
import json
import shutil
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
CHARTS = ["dot-timeline", "line-reveal", "moving-scatter", "unit-waffle"]
NEEDS = {"dot-timeline": ["line-reveal"]}          # dot timeline's summary view uses the line chart

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lesson</title>
<link rel="stylesheet" href="assets/engine/lesson.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
</head>
<body>
<script type="module">
  import { runLesson } from "./assets/engine/player.js";
  runLesson("lesson.json", "./assets");
</script>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chart", required=True, choices=CHARTS)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    out = Path(a.out)
    if out.exists() and any(out.iterdir()):
        raise SystemExit(f"{out} already has files in it; choose an empty folder.")
    A = SKILL / "assets"
    shutil.copytree(A / "engine", out / "assets" / "engine")
    for c in [a.chart, *NEEDS.get(a.chart, [])]:
        (out / "assets" / "charts" / c).mkdir(parents=True, exist_ok=True)
        shutil.copy(A / "charts" / c / "chart.js", out / "assets" / "charts" / c / "chart.js")
    starter = A / "charts" / a.chart / "sample"
    if starter.exists():
        for f in ("data.json", "video.json", "lesson.json"):
            if (starter / f).exists():
                shutil.copy(starter / f, out / f)
        L = json.loads((out / "lesson.json").read_text())
        L.update({"data": "data.json", "storyboard": "video.timed.json", "narration": None, "music": None})
        (out / "lesson.json").write_text(json.dumps(L, indent=2))
    (out / "index.html").write_text(PAGE)
    (out / "narration").mkdir(exist_ok=True)
    print(f"New {a.chart} lesson at {out}/  (starter content is SAMPLE DATA: replace data.json, video.json, lesson.json)")


if __name__ == "__main__":
    main()
