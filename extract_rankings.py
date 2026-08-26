#!/usr/bin/env python3
"""Rebuilds rankings.json from the dynasty draft prep workbook: combines the
overall 'Footballers 2QB (Full 472)' ranking with per-position tiers pulled
from the QB/RB/WR/TE 'Tier List' tabs (tiers are delimited by blank rows).

Re-run this any time the spreadsheet is updated:

    python3 extract_rankings.py ~/Downloads/2026_Dynasty_Startup_Draft_Prep.xlsx
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl

RANK_SHEET = "Footballers 2QB (Full 472)"
TIER_SHEETS = {
    "QB": "QB Tier List",
    "RB": "RB Tier List",
    "WR": "WR Tier List",
    "TE": "TE Tier List",
}
VALID_POS = set(TIER_SHEETS)

SUFFIX_RE = re.compile(r"\b(jr|sr|ii|iii|iv|v)\b")


def normalize_name(name):
    if not name:
        return ""
    n = unicodedata.normalize("NFD", str(name)).encode("ascii", "ignore").decode()
    n = n.lower()
    n = n.replace(".", "").replace("'", "").replace("’", "")
    n = n.replace("-", " ")
    n = SUFFIX_RE.sub("", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def last_name(normalized):
    parts = normalized.split(" ")
    return parts[-1] if parts else ""


def load_tiers(wb):
    """pos -> {normalized_name: (tier_int, pos_rank)}, plus a last-name fallback map.

    Tiers are delimited by blank rows in each Tier List sheet. pos_rank (column A)
    is captured too because the sheet's row order isn't always sorted by it (a
    couple of rows are manually out of order) — sorting by the numeric pos_rank
    is what actually keeps each tier's players in a stable, correct order.
    """
    exact = {}
    by_last = {}  # (pos, last) -> set of (tier, pos_rank) seen
    for pos, sheet_name in TIER_SHEETS.items():
        ws = wb[sheet_name]
        tier = 0
        for row in ws.iter_rows(min_row=3, values_only=True):
            pos_rank, name = row[0], row[1]
            if name is None:
                tier += 1
                continue
            if tier == 0:
                tier = 1
            key = normalize_name(name)
            if not key:
                continue
            entry = (tier, float(pos_rank) if pos_rank is not None else 9999)
            exact[(pos, key)] = entry
            by_last.setdefault((pos, last_name(key)), set()).add(entry)
    return exact, by_last


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads" / "2026_Dynasty_Startup_Draft_Prep.xlsx"
    wb = openpyxl.load_workbook(src, data_only=True)

    tier_exact, tier_by_last = load_tiers(wb)

    ws = wb[RANK_SHEET]
    players = []
    unmatched = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        rank, name, pos, team, bye, age = row[0], row[1], row[2], row[3], row[4], row[5]
        if rank is None or pos not in VALID_POS or not name:
            continue
        key = normalize_name(name)
        entry = tier_exact.get((pos, key))
        if entry is None:
            candidates = tier_by_last.get((pos, last_name(key)))
            if candidates and len(candidates) == 1:
                entry = next(iter(candidates))
        if entry is None:
            unmatched.append(f"{name} ({pos})")
        tier = entry[0] if entry else None
        players.append({
            "rank": int(rank),
            "name": str(name).strip(),
            "pos": pos,
            "team": (team or "").strip(),
            "bye": str(bye).strip() if bye is not None else "",
            "age": age,
            "tier": tier,
        })

    out = Path(__file__).parent / "rankings.json"
    out.write_text(json.dumps(players, indent=0))
    print(f"Wrote {len(players)} players to {out}")
    if unmatched:
        print(f"{len(unmatched)} player(s) had no tier match:")
        for u in unmatched:
            print(f"  - {u}")


if __name__ == "__main__":
    main()
