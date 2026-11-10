"""Self-check a lesson folder. Run after every build step; fix every FAIL before moving on.

    python3 check_lesson.py <lesson-folder> [--assets <skill assets dir>]

Checks:
  1. lesson.json: required fields, files it points to exist, chart type exists.
  2. Data: matches the chart type's format (required fields, value ranges, shares that
     sum to 1, sorted x values, no empty groups) — see references/data-formats.md.
  3. Storyboard: every scene has a title and text; video.timed.json is up to date with
     video.json (same scenes, same words); every beat phrase was found and timed.
  4. Facts (accuracy): every entry in facts.json (narrated numbers, recomputed from the
     source data by the data script) is spoken in the narration with the same value.
  5. Narration & music: audio length matches the timed storyboard; the music bed is long
     enough to play past the last word (else it would end or loop under the narrator).
Exit code 1 if anything FAILs. WARNs are for the builder to judge.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
results = []


def say(level, msg):
    results.append((level, msg))
    print(f"[{level}] {msg}")


def words_to_numbers(text):
    """Spoken numbers in narration text, both digits and words ('seventy-five' -> 75, 'half' -> 0.5)."""
    t = text.lower().replace("-", " ")
    out = [float(x.replace(",", "")) for x in re.findall(r"\d[\d,]*\.?\d*", t)]
    toks = re.findall(r"[a-z]+", t)
    i = 0
    while i < len(toks):
        w = toks[i]
        if w in TENS[2:]:
            v = TENS.index(w) * 10
            if i + 1 < len(toks) and toks[i + 1] in ONES[1:10]:
                v += ONES.index(toks[i + 1]); i += 1
            out.append(v)
        elif w in ONES:
            out.append(ONES.index(w))
        elif w == "hundred" and out:
            out[-1] *= 100
        elif w == "half":
            out.append(0.5)
        elif w in ("quarter", "quarters"):
            out.append(0.25)
        i += 1
    return out


def audio_seconds(path):
    try:
        r = subprocess.run(["afinfo", str(path)], capture_output=True, text=True, timeout=30)
        m = re.search(r"estimated duration: ([\d.]+)", r.stdout)
        if m:
            return float(m.group(1))
    except Exception:  # noqa: BLE001
        pass
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True, timeout=30)
        return float(r.stdout.strip())
    except Exception:  # noqa: BLE001
        return None


def check_data(chart, d):
    if chart == "line-reveal":
        for k in ("x", "y", "series"):
            if k not in d: say("FAIL", f"data: missing '{k}'"); return
        for s in d["series"]:
            xs = [p[0] for p in s["points"]]
            if xs != sorted(xs): say("FAIL", f"data: series '{s['id']}' x values are not in order")
            out = [p for p in s["points"] if not (d["y"]["min"] <= p[1] <= d["y"]["max"])]
            if out: say("FAIL", f"data: series '{s['id']}' has {len(out)} values outside the y axis range")
            if not s.get("color"): say("WARN", f"data: series '{s['id']}' has no color")
    elif chart == "moving-scatter":
        for k in ("time", "x", "y", "groups", "entities"):
            if k not in d: say("FAIL", f"data: missing '{k}'"); return
        gids = {g["id"] for g in d["groups"]}
        for e in d["entities"]:
            if e["group"] not in gids: say("FAIL", f"data: entity '{e['id']}' has unknown group '{e['group']}'")
            for yr, v in e["values"].items():
                if not (d["x"]["min"] <= v[0] <= d["x"]["max"] and d["y"]["min"] <= v[1] <= d["y"]["max"]):
                    say("FAIL", f"data: '{e['id']}' {yr} is outside the axis ranges"); break
        if len(d["groups"]) > 6: say("WARN", "data: more than 6 groups; colors will be hard to tell apart")
    elif chart == "unit-waffle":
        for k in ("categories", "frames"):
            if k not in d: say("FAIL", f"data: missing '{k}'"); return
        if len(d["categories"]) > 6: say("WARN", "data: more than 6 categories; fold the small ones into 'Other'")
        for f in d["frames"]:
            for p in f["panels"]:
                tot = sum(p["shares"].values())
                if abs(tot - 1) > 0.02: say("FAIL", f"data: frame '{f['id']}' panel '{p['id']}' shares sum to {tot:.3f}, not 1")
    elif chart == "dot-timeline":
        for k in ("states", "groups"):
            if k not in d: say("FAIL", f"data: missing '{k}'"); return
        ns = len(d["states"])
        for g in d["groups"]:
            if not g.get("people"): say("FAIL", f"data: group '{g['id']}' has no people")
            for p in g["people"][:50]:
                if p[-1] != 1440 or any(not (0 <= p[i] < ns) for i in range(0, len(p), 2)):
                    say("FAIL", f"data: group '{g['id']}' has a malformed person sequence"); break
    say("PASS" if not any(r[0] == "FAIL" and r[1].startswith("data") for r in results) else "INFO", f"data: checked as {chart}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--assets", default=str(Path(__file__).resolve().parent.parent / "assets"))
    a = ap.parse_args()
    F = Path(a.folder)
    lj = F / "lesson.json"
    if not lj.exists(): say("FAIL", f"no lesson.json in {F}"); sys.exit(1)
    L = json.loads(lj.read_text())
    for k in ("title", "chart", "data", "storyboard"):
        if not L.get(k): say("FAIL", f"lesson.json: missing '{k}'")
    if not (Path(a.assets) / "charts" / L.get("chart", "?") / "chart.js").exists(): say("FAIL", f"chart type '{L.get('chart')}' doesn't exist")
    for k in ("data", "storyboard", "narration", "music"):
        if L.get(k) and not (F / L[k]).exists(): say("FAIL" if k in ("data", "storyboard") else "WARN", f"lesson.json: '{k}' file not found: {L[k]}")
    if (F / L.get("data", "?")).exists():
        check_data(L["chart"], json.loads((F / L["data"]).read_text()))

    tj = F / L.get("storyboard", "video.timed.json")
    vj = tj.with_name(tj.name.replace(".timed", ""))
    if vj.exists() and tj.exists():
        V, T = json.loads(vj.read_text()), json.loads(tj.read_text())
        if [s["say"] for s in V["scenes"]] != [s["say"] for s in T["scenes"]]:
            say("FAIL", "storyboard: video.timed.json is out of date; rerun time_storyboard.py")
        for s in T["scenes"]:
            if not s.get("title"): say("FAIL", f"storyboard: scene '{s['id']}' has no chapter title")
            for b in s.get("beats", []):
                if "t" not in b: say("FAIL", f"storyboard: beat '{b['at']}' in '{s['id']}' was never timed")
            ts = [b["t"] for b in s.get("beats", []) if "t" in b]
            if ts != sorted(ts): say("WARN", f"storyboard: beats in '{s['id']}' are out of order")
        say("PASS", f"storyboard: {len(T['scenes'])} scenes, {T['duration']:.1f}s")
        text = " ".join(s["say"] for s in V["scenes"])
        facts = F / "facts.json"  # numbers the narrator says, computed by the data script
        if facts.exists():
            spoken = words_to_numbers(text)
            for f in json.loads(facts.read_text()):
                want, tol = float(f["spoken"]), float(f.get("tolerance", 0))
                if not any(abs(x - want) <= max(tol, 1e-9) for x in spoken):
                    say("FAIL", f"facts: '{f['id']}' should be spoken as {f['spoken']} but isn't in the narration")
                elif abs(float(f["value"]) - want) > max(tol, abs(float(f["value"])) * float(f.get("round_ok", 0.1))):
                    say("FAIL", f"facts: '{f['id']}' is spoken as {f['spoken']} but the data says {f['value']}")
                else:
                    say("PASS", f"facts: '{f['id']}' = {f['value']} (spoken '{f['spoken']}')")
        else:
            say("WARN", "facts: no facts.json, so narrated numbers weren't checked against the data")
        if L.get("narration") and (F / L["narration"]).exists():
            dur = audio_seconds(F / L["narration"])
            if dur and abs(dur - T["duration"]) > 3: say("FAIL", f"narration is {dur:.1f}s but the storyboard is {T['duration']:.1f}s; re-align and re-time")
            elif dur: say("PASS", f"narration: {dur:.1f}s, matches storyboard")
        else:
            say("WARN", "narration: none yet (silent preview mode)")
        if L.get("music") and (F / L["music"]).exists():
            md = audio_seconds(F / L["music"])
            if md and md < T["duration"] + 6: say("FAIL", f"music is {md:.1f}s but needs ≥ {T['duration'] + 6:.0f}s to play past the last word; extend it (find_loop.py + extend_music.py)")
            elif md: say("PASS", f"music: {md:.1f}s, long enough")
    else:
        say("FAIL", "storyboard: video.json or the timed storyboard is missing")

    fails = sum(1 for r in results if r[0] == "FAIL")
    print(f"\n{'ALL CHECKS PASSED' if not fails else f'{fails} FAIL(S): fix before continuing'}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
