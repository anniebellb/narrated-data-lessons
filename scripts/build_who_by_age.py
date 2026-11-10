"""Build the "Who you spend time with, by age" dataset from ATUS multi-year microdata.

Inputs  (data/raw/, unzipped BLS multi-year files):
  atusact-0325/atusact_0325.dat   activity episodes (timing + activity code)
  atuswho-0325/atuswho_0325.dat   who was present for each episode
  atussum-0325/atussum_0325.dat   respondent age, year, final weight

Output: data/who-by-age.json in the canonical dot-timeline schema:
  states   ordered list of states a dot can be in
  groups   one entry per age band, each with N weighted-resampled people;
           a person is a flat list [state, endMinute, state, endMinute, ...]
           where minutes count from 4:00am (the ATUS diary day start)
  aggregates  exact weighted figures for companion charts

Usage: .venv/bin/python scripts/build_who_by_age.py [--dots 500] [--seed 7]
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "who-by-age.json"

# Pre-pandemic + post-pandemic years. 2020-21 excluded: lockdowns reshaped who
# people were with, and 2020 uses a different weight variable.
YEARS = [2015, 2016, 2017, 2018, 2019, 2022, 2023, 2024, 2025]

AGE_BANDS = [(15, 24), (25, 34), (35, 44), (45, 54), (55, 64), (65, 74), (75, 85)]

# Order = display order of clusters.
STATES = [
    {"id": "sleep",    "label": "Sleep & personal care", "note": "Company not asked"},
    {"id": "work",     "label": "Work or class",         "note": "Company not asked"},
    {"id": "alone",    "label": "Alone"},
    {"id": "partner",  "label": "Partner"},
    {"id": "children", "label": "Your children"},
    {"id": "family",   "label": "Other family"},
    {"id": "friends",  "label": "Friends"},
    {"id": "others",   "label": "Others",                "note": "Coworkers, neighbors, customers, strangers"},
]
S = {s["id"]: i for i, s in enumerate(STATES)}

# TUWHO_CODE -> companion group (from the ATUS 2003-25 Interview Data Dictionary)
WHO_GROUP = {
    18: "alone", 19: "alone",
    20: "partner", 21: "partner",
    22: "children", 27: "children", 40: "children",
    23: "family", 24: "family", 25: "family", 26: "family",
    51: "family", 52: "family", 53: "family",
    54: "friends",
    28: "others", 29: "others", 30: "others", 55: "others", 56: "others",
    57: "others", 58: "others", 59: "others", 60: "others", 61: "others", 62: "others",
}
# When several groups are present, the dot goes to the first one in this list.
PRIORITY = ["children", "partner", "family", "friends", "others", "alone"]
COMPANION = ["alone", "partner", "children", "family", "friends", "others"]


def load():
    summ = pd.read_csv(
        RAW / "atussum-0325/atussum_0325.dat",
        usecols=["TUCASEID", "TEAGE", "TUYEAR", "TUFNWGTP"],
        dtype={"TUCASEID": str},
    )
    summ = summ[summ.TUYEAR.isin(YEARS) & (summ.TUFNWGTP > 0)]
    keep = set(summ.TUCASEID)

    act = pd.read_csv(
        RAW / "atusact-0325/atusact_0325.dat",
        usecols=["TUCASEID", "TUACTIVITY_N", "TRCODEP", "TUACTDUR24", "TUCUMDUR24"],
        dtype={"TUCASEID": str},
    )
    act = act[act.TUCASEID.isin(keep)]

    who = pd.read_csv(
        RAW / "atuswho-0325/atuswho_0325.dat",
        usecols=["TUCASEID", "TUACTIVITY_N", "TUWHO_CODE"],
        dtype={"TUCASEID": str},
    )
    who = who[who.TUCASEID.isin(keep)]
    return summ, act, who


def classify(act, who):
    who = who.assign(group=who.TUWHO_CODE.map(WHO_GROUP)).dropna(subset=["group"])
    # one row per episode with the set of companion groups present
    flags = pd.crosstab([who.TUCASEID, who.TUACTIVITY_N], who.group).clip(upper=1)
    for g in COMPANION:
        if g not in flags:
            flags[g] = 0
    act = act.merge(flags[COMPANION].reset_index(), on=["TUCASEID", "TUACTIVITY_N"], how="left")
    act[COMPANION] = act[COMPANION].fillna(0).astype(np.int8)

    tier2 = act.TRCODEP // 100
    state = np.full(len(act), S["sleep"], dtype=np.int8)  # default: company not recorded
    for g in reversed(PRIORITY):  # lowest priority first, higher ones overwrite
        state[act[g].to_numpy() == 1] = S[g]
    is_work = tier2.isin([501, 502, 503, 504, 599, 601, 602])
    state[is_work.to_numpy() & (act[COMPANION].sum(axis=1) == 0).to_numpy()] = S["work"]
    state[(tier2 == 501).to_numpy()] = S["work"]  # working: who is never asked
    act["state"] = state
    return act


def band_of(age):
    for lo, hi in AGE_BANDS:
        if lo <= age <= hi:
            return f"{lo}–{hi}" if hi < 85 else f"{lo}+"
    return None


def sequences(act):
    """Collapse each person's episodes into [state, endMinute, ...] runs."""
    act = act.sort_values(["TUCASEID", "TUACTIVITY_N"])
    seqs = {}
    for cid, g in act.groupby("TUCASEID", sort=False):
        st = g.state.to_numpy()
        end = np.minimum(g.TUCUMDUR24.to_numpy(), 1440)
        out = []
        for s, e in zip(st, end):
            if out and out[-2] == s:
                out[-1] = int(e)
            else:
                out += [int(s), int(e)]
        if out and out[-1] < 1440:
            out[-1] = 1440
        seqs[cid] = out
    return seqs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dots", type=int, default=500)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)

    summ, act, who = load()
    act = classify(act, who)
    summ = summ.assign(band=summ.TEAGE.map(band_of))
    w = summ.set_index("TUCASEID").TUFNWGTP

    # --- exact aggregates: minutes/day with each group, by single year of age ---
    mins = act[COMPANION].multiply(act.TUACTDUR24, axis=0)
    mins["TUCASEID"] = act.TUCASEID
    per_person = mins.groupby("TUCASEID")[COMPANION].sum().reindex(summ.TUCASEID, fill_value=0)
    per_person["age"] = summ.set_index("TUCASEID").TEAGE
    per_person["w"] = w
    by_age = {}
    for age, g in per_person.groupby("age"):
        by_age[int(age)] = {
            c: round(float(np.average(g[c], weights=g.w)) / 60, 3) for c in COMPANION
        } | {"n": int(len(g))}

    # --- share of people in each state by 10-min slot, per band (weighted) ---
    seqs = sequences(act)
    slots = np.arange(0, 1440, 10) + 5
    share = {}
    groups = []
    for lo, hi in AGE_BANDS:
        label = f"{lo}–{hi}" if hi < 85 else f"{lo}+"
        ids = summ[summ.band == label].TUCASEID.to_numpy()
        ids = np.array([i for i in ids if i in seqs])
        wt = w.loc[ids].to_numpy()

        grid = np.zeros((len(slots), len(STATES)))
        for cid, ww in zip(ids, wt):
            q = seqs[cid]
            st, en = np.array(q[0::2]), np.array(q[1::2])
            idx = np.searchsorted(en, slots, side="right").clip(max=len(st) - 1)
            np.add.at(grid, (np.arange(len(slots)), st[idx]), ww)
        share[label] = (grid / grid.sum(axis=1, keepdims=True)).round(4).tolist()

        # weighted resample: each dot stands for an equal slice of the population
        pick = rng.choice(len(ids), size=args.dots, replace=True, p=wt / wt.sum())
        groups.append({
            "id": label,
            "label": f"Ages {label}",
            "n_respondents": int(len(ids)),
            "people": [seqs[ids[i]] for i in pick],
        })

    out = {
        "schema": "dot-timeline/v1",
        "title": "Who Americans spend their day with, by age",
        "clock": {"start": "04:00", "minutes": 1440, "unit": "minute"},
        "states": STATES,
        "groups": groups,
        "aggregates": {
            "hours_with_by_age": by_age,
            "state_share_by_slot": {"slot_minutes": 10, "bands": share},
        },
        "source": {
            "name": "American Time Use Survey, 2003–2025 multi-year microdata",
            "publisher": "U.S. Bureau of Labor Statistics",
            "url": "https://www.bls.gov/tus/data/datafiles-0325.htm",
            "years_used": YEARS,
            "respondents": int(len(summ)),
            "notes": [
                "Each dot is a survey respondent resampled in proportion to their survey weight; dots are not tracked individuals.",
                "ATUS does not ask who was present during sleep, grooming, work, or class.",
                "When several people were present, the dot joins one group in this order: children, partner, other family, friends, others.",
                "2020–2021 are excluded because the pandemic disrupted normal social time.",
            ],
        },
    }
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size/1e6:.1f} MB), respondents={len(summ)}")
    for a in (20, 30, 40, 50, 60, 70, 80):
        print(a, by_age[a])


if __name__ == "__main__":
    main()
