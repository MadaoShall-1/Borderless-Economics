"""
One-time backfill: fetch 2026-01 monthly data
Run from D:\Tariff\Data Collector:
    python backfill_jan2026.py
"""
import json, time, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from monthly_collector import (
    fetch_monthly_industry, fetch_monthly_hs4, PNWER_STATES
)

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
    "..", "pnwer-dashboard", "src", "data", "pnwer_analysis_data_v9.json")

YEAR, MONTH = 2026, 1
MONTH_KEY = f"{YEAR}-{MONTH:02d}"

print(f"\n  Backfilling {MONTH_KEY}...")

with open(DATA_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

if "monthly_trade" not in data:
    data["monthly_trade"] = {}
if "monthly_products" not in data:
    data["monthly_products"] = {}

records = 0
for state in PNWER_STATES:
    for cty_code, partner in [("1220", "CA"), ("2010", "MX")]:
        print(f"  {state} ↔ {partner} industry...", end=" ")
        exp = fetch_monthly_industry(state, cty_code, YEAR, MONTH, is_export=True)
        imp = fetch_monthly_industry(state, cty_code, YEAR, MONTH, is_export=False)
        if exp or imp:
            et = exp["total"] if exp else 0
            it = imp["total"] if imp else 0
            ei = exp["by_industry"] if exp else {}
            ii = imp["by_industry"] if imp else {}
            inds = set(ei.keys()) | set(ii.keys())
            by_ind = {ind: {"exports": ei.get(ind,0), "imports": ii.get(ind,0)} for ind in inds}
            data["monthly_trade"].setdefault(state, {}).setdefault(partner, {})
            data["monthly_trade"][state][partner][MONTH_KEY] = {
                "exports": {"total": et, **{k: v["exports"] for k,v in by_ind.items()}},
                "imports": {"total": it, **{k: v["imports"] for k,v in by_ind.items()}},
            }
            records += 1
            print(f"${(et+it)/1e6:.0f}M")
        else:
            print("no data")
        time.sleep(0.1)

        print(f"  {state} ↔ {partner} products...", end=" ")
        exp_hs4 = fetch_monthly_hs4(state, cty_code, YEAR, MONTH, is_export=True)
        imp_hs4 = fetch_monthly_hs4(state, cty_code, YEAR, MONTH, is_export=False)
        all_hs4 = set(exp_hs4.keys()) | set(imp_hs4.keys())
        if all_hs4:
            yr_data = {hs4: {"exports": exp_hs4.get(hs4,0), "imports": imp_hs4.get(hs4,0)} for hs4 in all_hs4}
            data["monthly_products"].setdefault(state, {}).setdefault(partner, {})
            data["monthly_products"][state][partner][MONTH_KEY] = yr_data
            records += 1
            print(f"{len(all_hs4)} products")
        else:
            print("no data")
        time.sleep(0.1)

# Save
with open(DATA_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"\n  Done! {records} records added for {MONTH_KEY}")
print(f"  Saved: {DATA_PATH}")