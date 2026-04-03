"""
Statistics Canada — Table 12-10-0175-01 CSV Processor (Fixed)
Trade values: Import, Domestic export, Re-export
NAPCS total: "Total of all merchandise"
All values in thousands CAD
"""

import pandas as pd
import json
import os

DATA_DIR = r"D:\Tariff\data"
csv_path = os.path.join(DATA_DIR, "12100175.csv")

if not os.path.exists(csv_path):
    print(f"ERROR: Cannot find {csv_path}")
    exit(1)

print(f"Reading {csv_path}...")
df = pd.read_csv(csv_path, low_memory=False)
print(f"Total rows: {len(df):,}")

# Filter
pnwer_geos = ["British Columbia", "Alberta", "Saskatchewan", "Yukon", "Northwest Territories"]
filtered = df[
    (df["GEO"].isin(pnwer_geos)) &
    (df["Principal trading partners"] == "United States") &
    (df["REF_DATE"].astype(str).str[:4].astype(int) >= 2017)
].copy()
print(f"Filtered: {len(filtered):,} rows")

# Mappings
GEO_MAP = {"British Columbia": "BC", "Alberta": "AB", "Saskatchewan": "SK",
           "Yukon": "YT", "Northwest Territories": "NT"}

NAPCS_MAP = {}
for n in filtered["North American Product Classification System (NAPCS)"].unique():
    ns = str(n)
    if "Total" in ns and "merchandise" in ns: NAPCS_MAP[n] = "all"
    elif "Farm" in ns: NAPCS_MAP[n] = "farm_fish"
    elif "Energy" in ns: NAPCS_MAP[n] = "energy"
    elif "Metal ores" in ns: NAPCS_MAP[n] = "ores"
    elif "Metal and" in ns: NAPCS_MAP[n] = "metals"
    elif "chemical" in ns.lower(): NAPCS_MAP[n] = "chemical"
    elif "Forestry" in ns: NAPCS_MAP[n] = "forestry"
    elif "machinery" in ns.lower(): NAPCS_MAP[n] = "machinery"
    elif "Electronic" in ns: NAPCS_MAP[n] = "electronics"
    elif "Motor vehicle" in ns: NAPCS_MAP[n] = "vehicles"
    elif "Aircraft" in ns: NAPCS_MAP[n] = "aircraft"
    elif "Consumer" in ns: NAPCS_MAP[n] = "consumer"
    elif "Special" in ns: NAPCS_MAP[n] = "special"

NAPCS_TO_INDUSTRY = {
    "farm_fish": "agriculture", "energy": "energy", "ores": "minerals",
    "metals": "minerals", "chemical": "other", "forestry": "forestry",
    "machinery": "manufacturing", "electronics": "manufacturing",
    "vehicles": "manufacturing", "aircraft": "manufacturing",
    "consumer": "other", "special": "other",
}

# Process
result = {}

for _, row in filtered.iterrows():
    geo = GEO_MAP.get(row["GEO"])
    if not geo:
        continue

    year = str(row["REF_DATE"])[:4]
    value = row["VALUE"]
    if pd.isna(value):
        continue
    value = float(value) * 1000  # all in thousands CAD

    napcs_key = NAPCS_MAP.get(row["North American Product Classification System (NAPCS)"])
    if napcs_key is None:
        continue

    # Trade: "Import" → imports, "Domestic export" or "Re-export" → exports
    trade_raw = str(row["Trade"]).strip()
    if trade_raw == "Import":
        trade_key = "imports"
    elif trade_raw in ("Domestic export", "Re-export"):
        trade_key = "exports"
    else:
        continue

    if geo not in result:
        result[geo] = {}
    if year not in result[geo]:
        result[geo][year] = {"total": {"exports": 0, "imports": 0},
                             "by_napcs": {}, "by_industry": {}}

    yd = result[geo][year]

    if napcs_key == "all":
        yd["total"][trade_key] += value
    else:
        if napcs_key not in yd["by_napcs"]:
            yd["by_napcs"][napcs_key] = {"exports": 0, "imports": 0}
        yd["by_napcs"][napcs_key][trade_key] += value

        industry = NAPCS_TO_INDUSTRY.get(napcs_key, "other")
        if industry not in yd["by_industry"]:
            yd["by_industry"][industry] = {"exports": 0, "imports": 0}
        yd["by_industry"][industry][trade_key] += value

# Summary
print(f"\n{'='*80}")
print(f"  PNWER Canadian Provinces — Trade with US (CAD)")
print(f"{'='*80}")
print(f"  {'Prov':<5} {'2023 Exp':>10} {'2023 Imp':>10} {'2024 Exp':>10} {'2024 Imp':>10} {'2025 Exp':>10} {'2025 Imp':>10}")
for p in ["BC", "AB", "SK", "YT", "NT"]:
    nums = []
    for yr in ["2023", "2024", "2025"]:
        e = result.get(p, {}).get(yr, {}).get("total", {}).get("exports", 0)
        i = result.get(p, {}).get(yr, {}).get("total", {}).get("imports", 0)
        nums.extend([e, i])
    print(f"  {p:<5}" + "".join(f" ${v/1e9:>8.1f}B" for v in nums))

# Industry breakdown for 2024
print(f"\n  BY INDUSTRY (2024, CAD)")
print(f"  {'Prov':<5} {'Ag Exp':>8} {'Ag Imp':>8} {'En Exp':>8} {'En Imp':>8} {'For Exp':>8} {'For Imp':>8} {'Min Exp':>8} {'Min Imp':>8} {'Mfg Exp':>8} {'Mfg Imp':>8}")
for p in ["BC", "AB", "SK", "YT", "NT"]:
    bi = result.get(p, {}).get("2024", {}).get("by_industry", {})
    vals = []
    for ind in ["agriculture", "energy", "forestry", "minerals", "manufacturing"]:
        vals.append(bi.get(ind, {}).get("exports", 0))
        vals.append(bi.get(ind, {}).get("imports", 0))
    print(f"  {p:<5}" + "".join(f" {v/1e6:>7.0f}M" for v in vals))

# Save
output = {
    "metadata": {
        "source": "Statistics Canada Table 12-10-0175-01 (CSV)",
        "generated": str(pd.Timestamp.now()),
        "unit": "Canadian dollars",
        "partner": "United States",
        "provinces": ["BC", "AB", "SK", "YT", "NT"],
        "note": "Exports = Domestic export + Re-export. Values in CAD (×0.73 for USD)."
    },
    "napcs_to_industry": NAPCS_TO_INDUSTRY,
    "province_trade": result,
}

out_path = os.path.join(DATA_DIR, "statcan_provinces.json")
with open(out_path, 'w') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)
print(f"\n  Saved: {out_path} ({os.path.getsize(out_path)/1024:.0f} KB)")