"""Profile a dataset and say, in plain language, whether it can become a narrated lesson
with each of the four chart types.

    python3 profile_data.py <file-or-url> [--sheet NAME] [--json out.json]

Reads CSV/TSV, Excel (.xlsx), JSON (records), Parquet, or tables inside a PDF
(needs `pdfplumber`). A URL is downloaded first; if the site blocks automated
downloads the script says so, so the user can download it in their browser instead.

Output: a short profile (rows, columns, what each column looks like) and a verdict
per chart type: GOOD FIT / POSSIBLE / NOT A FIT, each with the reason and, when it's
not a fit, what data would make it work. The skill reads this and explains it to the user.
"""
import argparse
import json
import re
import sys
import tempfile
import urllib.request
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    sys.exit("This needs pandas. Install it with:  python3 -m pip install pandas openpyxl")

TIME_NAMES = re.compile(r"\b(year|yr|date|time|month|week|day|period|quarter|age|wave|season)\b", re.I)
ID_NAMES = re.compile(r"(^id$|_id$|\bid\b|person|respondent|caseid|student|patient|user|participant|household)", re.I)
START_NAMES = re.compile(r"(start|begin|from|onset)", re.I)
END_NAMES = re.compile(r"(end|stop|until|finish|to_time|duration|minutes)", re.I)
MEASURE_NAMES = re.compile(r"(percent|pct|share|rate|ratio|count|total|number|num_|amount|hours|minutes|score|value|avg|mean|median|income|price|cost|population|size)", re.I)


def load(src, sheet=None):
    if re.match(r"https?://", src):
        suffix = Path(src.split("?")[0]).suffix or ".csv"
        tmp = Path(tempfile.mkdtemp()) / f"download{suffix}"
        req = urllib.request.Request(src, headers={"User-Agent": "narrated-data-lessons/0.1 (data profiler)"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                tmp.write_bytes(r.read())
        except Exception as e:  # noqa: BLE001
            sys.exit(f"COULD NOT DOWNLOAD: {e}. The site may block automated downloads. "
                     "Ask the user to download the file in their browser and share it.")
        src = str(tmp)
    p = Path(src)
    ext = p.suffix.lower()
    if ext in (".csv", ".txt"):
        return pd.read_csv(p, sep=None, engine="python")
    if ext == ".tsv":
        return pd.read_csv(p, sep="\t")
    if ext in (".xlsx", ".xls"):
        return pd.read_excel(p, sheet_name=sheet or 0)
    if ext == ".json":
        raw = json.loads(p.read_text())
        return pd.json_normalize(raw if isinstance(raw, list) else next(v for v in raw.values() if isinstance(v, list)))
    if ext == ".parquet":
        return pd.read_parquet(p)
    if ext == ".pdf":
        try:
            import pdfplumber
        except ImportError:
            sys.exit("This is a PDF. Install pdfplumber (python3 -m pip install pdfplumber) to read its tables, "
                     "or extract the table another way and save it as CSV.")
        tables = []
        with pdfplumber.open(p) as pdf:
            for page in pdf.pages:
                for t in page.extract_tables() or []:
                    if len(t) > 2:
                        tables.append(pd.DataFrame(t[1:], columns=t[0]))
        if not tables:
            sys.exit("NO TABLES FOUND in this PDF. If the numbers are in charts or prose, they can't be read reliably; "
                     "ask the user for the underlying data (CSV/Excel) instead.")
        df = max(tables, key=len)
        return df.apply(pd.to_numeric, errors="ignore")
    sys.exit(f"Don't know how to read '{ext}' files. Supported: CSV, TSV, Excel, JSON, Parquet, PDF tables.")


def describe(df):
    cols = []
    for c in df.columns:
        s = df[c]
        num = pd.to_numeric(s, errors="coerce")
        is_num = num.notna().mean() > 0.9
        uniq = s.nunique(dropna=True)
        is_code = is_num and uniq <= 50 and (num.dropna() % 1 == 0).all() and not MEASURE_NAMES.search(str(c))   # integer codes = categories
        kind = "category" if is_code else "number" if is_num else "category" if uniq <= max(30, len(df) * 0.05) else "text"
        if TIME_NAMES.search(str(c)) and (is_num or pd.to_datetime(s, errors="coerce").notna().mean() > 0.8):
            kind = "time"
        if ID_NAMES.search(str(c)) and uniq > 1:
            kind = "id" if kind != "time" else kind
        info = {"name": str(c), "kind": kind, "unique": int(uniq), "missing": round(float(s.isna().mean()), 3)}
        if is_num:
            info.update(min=float(num.min()), max=float(num.max()))
        else:
            info["examples"] = [str(v) for v in s.dropna().unique()[:5]]
        cols.append(info)
    return cols


def assess(df, cols):
    by = {k: [c for c in cols if c["kind"] == k] for k in ("time", "id", "category", "number", "text")}
    n = len(df)
    v = {}

    # dot timeline: individual people, each with a sequence of states over a timeline
    ids = by["id"]
    starts = [c for c in cols if START_NAMES.search(c["name"])]
    ends = [c for c in cols if END_NAMES.search(c["name"])]
    rep = ids and n / max(1, ids[0]["unique"]) >= 3
    if ids and rep and (starts or ends) and by["category"]:
        v["dot-timeline"] = ("GOOD FIT", f"Rows describe individuals ('{ids[0]['name']}', ~{n // ids[0]['unique']} rows each) with timed states "
                             f"('{(starts or ends)[0]['name']}') and categories ('{by['category'][0]['name']}'): each dot can be one person moving between states.")
    elif ids and rep and by["category"]:
        v["dot-timeline"] = ("POSSIBLE", "Has repeated records per individual and categories, but no clear start/end times. "
                             "Works if each row is a time step (e.g. a month or survey wave) for that person.")
    else:
        v["dot-timeline"] = ("NOT A FIT", "Needs person-level records over time (one row per person per activity or period, with a state). "
                             "This data looks like totals or one row per thing. A time-use diary, course clickstream, or panel survey would work.")

    # line reveal: a numeric measure across an ordered x
    t = by["time"]
    if t and by["number"] and t[0]["unique"] >= 5:
        series = [c for c in by["category"] if 2 <= c["unique"] <= 8]
        extra = f", with up to {series[0]['unique']} lines by '{series[0]['name']}'" if series else ""
        v["line-reveal"] = ("GOOD FIT", f"'{by['number'][0]['name']}' across {t[0]['unique']} values of '{t[0]['name']}'{extra}: lines can draw themselves over time.")
    elif t and by["number"]:
        v["line-reveal"] = ("POSSIBLE", f"Only {t[0]['unique']} time points; a line works best with 5 or more.")
    else:
        v["line-reveal"] = ("NOT A FIT", "Needs a measure tracked over an ordered axis (years, dates, ages). "
                            + ("There's a time column but no numeric measure to plot." if t else "No time-like column was found."))

    # moving scatter: entities with two+ measures over time
    ents = [c for c in by["category"] + by["id"] + by["text"] if 5 <= c["unique"] <= 300]
    if t and len(by["number"]) >= 2 and ents and t[0]["unique"] >= 3:
        nums = [c["name"] for c in by["number"] if c["name"] != t[0]["name"]][:3]
        v["moving-scatter"] = ("GOOD FIT", f"{ents[0]['unique']} '{ents[0]['name']}' values, each with measures ({', '.join(nums)}) across {t[0]['unique']} time points: "
                               "bubbles can slide as the years pass.")
    elif len(by["number"]) >= 2 and ents:
        v["moving-scatter"] = ("POSSIBLE", "Has things with two measures but no time column: works as a still scatter, not an animated one.")
    else:
        v["moving-scatter"] = ("NOT A FIT", "Needs several things (countries, schools, groups) each measured two ways, ideally over several years.")

    # unit waffle: a breakdown into a handful of categories
    small_cats = [c for c in by["category"] if 2 <= c["unique"] <= 6]
    if small_cats and by["number"]:
        v["unit-waffle"] = ("GOOD FIT", f"A breakdown by '{small_cats[0]['name']}' ({small_cats[0]['unique']} categories) with counts or shares: "
                            "can show 'how many out of 100' per group.")
    elif small_cats:
        v["unit-waffle"] = ("POSSIBLE", f"Has a short category list ('{small_cats[0]['name']}'); counts can be tallied from the rows.")
    else:
        v["unit-waffle"] = ("NOT A FIT", "Needs a breakdown into 2–6 categories (e.g. how people commute) with counts or percentages.")
    return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--sheet")
    ap.add_argument("--json")
    a = ap.parse_args()
    df = load(a.src, a.sheet)
    cols = describe(df)
    verdicts = assess(df, cols)
    print(f"ROWS {len(df):,}   COLUMNS {len(df.columns)}")
    for c in cols:
        extra = f"range {c['min']:g}–{c['max']:g}" if "min" in c else f"e.g. {', '.join(c['examples'][:3])}"
        print(f"  - {c['name']}: {c['kind']}, {c['unique']} unique, {c['missing']:.0%} missing, {extra}")
    print("\nFIT FOR EACH CHART TYPE")
    for k, (verdict, why) in verdicts.items():
        print(f"  {k:15s} {verdict:10s} {why}")
    if not any(v[0] == "GOOD FIT" for v in verdicts.values()):
        print("\nNO GOOD FIT: explain why to the user and suggest what data would work (see each reason above).")
    if a.json:
        Path(a.json).write_text(json.dumps({"rows": len(df), "columns": cols, "verdicts": verdicts}, indent=1))


if __name__ == "__main__":
    main()
