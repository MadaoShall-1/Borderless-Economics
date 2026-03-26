"""
PNWER Trade Analysis Data Collector v9

Collects two layers of trade data from the U.S. Census Bureau API:
1. Industry-level (HS2 → 6 industries) for all 25 states × CA/MX
2. Product-level (HS4 detail) for PNWER 5 states × CA/MX
3. National-level trade with industry breakdown
"""

import requests
import json
import time
from pathlib import Path
import datetime

# ============================================================================
# Configuration
# ============================================================================

API_KEY = "f51f8af17882fc49a8c6a2eec80c9b9d522562fd"

PNWER_STATES = ["WA", "OR", "ID", "MT", "AK"]
CONTROL_STATES = [
    "MI", "MN", "ND", "WI", "NY",
    "CA", "NV", "UT", "CO", "WY",
    "TX", "LA", "OK", "NE", "KS",
    "FL", "GA", "NC", "SC", "VA"
]
ALL_STATES = PNWER_STATES + CONTROL_STATES

STATE_NAMES = {
    "WA": "Washington", "OR": "Oregon", "ID": "Idaho",
    "MT": "Montana", "AK": "Alaska",
    "MI": "Michigan", "MN": "Minnesota", "ND": "North Dakota",
    "WI": "Wisconsin", "NY": "New York",
    "CA": "California", "NV": "Nevada", "UT": "Utah",
    "CO": "Colorado", "WY": "Wyoming",
    "TX": "Texas", "LA": "Louisiana", "OK": "Oklahoma",
    "NE": "Nebraska", "KS": "Kansas",
    "FL": "Florida", "GA": "Georgia", "NC": "North Carolina",
    "SC": "South Carolina", "VA": "Virginia"
}

COUNTRIES = {
    "1220": {"code": "CA", "name": "Canada", "group": "usmca"},
    "2010": {"code": "MX", "name": "Mexico", "group": "usmca"},
    "5700": {"code": "CN", "name": "China", "group": "control"},
    "5880": {"code": "JP", "name": "Japan", "group": "control"},
    "4280": {"code": "DE", "name": "Germany", "group": "control"},
    "4120": {"code": "UK", "name": "United Kingdom", "group": "control"},
    "5800": {"code": "KR", "name": "South Korea", "group": "control"},
}

YEARS = list(range(2017, 2026))
YEAR_2025_MONTH = "11"

STATE_EXPORT_API = "https://api.census.gov/data/timeseries/intltrade/exports/statehs"
STATE_IMPORT_API = "https://api.census.gov/data/timeseries/intltrade/imports/statehs"
NATIONAL_EXPORT_API = "https://api.census.gov/data/timeseries/intltrade/exports/hs"
NATIONAL_IMPORT_API = "https://api.census.gov/data/timeseries/intltrade/imports/hs"

# Per-state product selection (5 industries × 3 products each)
STATE_FOCUS_HS4 = {
    "WA": {
        "agriculture": ["0808", "0302", "0406"],
        "energy": ["2709", "2710", "2711"],
        "forestry": ["4407", "4418", "4703"],
        "minerals": ["7601", "7606", "7208"],
        "manufacturing": ["8802", "8411", "8708"],
    },
    "OR": {
        "agriculture": ["2204", "0808", "1001"],
        "energy": ["2710", "2709", "2711"],
        "forestry": ["4407", "4703", "4801"],
        "minerals": ["7208", "7601", "7606"],
        "manufacturing": ["8542", "8471", "8541"],
    },
    "ID": {
        "agriculture": ["1001", "1205", "0402"],
        "energy": ["2711", "2710", "2709"],
        "forestry": ["4407", "4418", "4411"],
        "minerals": ["7601", "2603", "7403"],
        "manufacturing": ["8542", "8708", "8471"],
    },
    "MT": {
        "agriculture": ["1001", "0201", "1205"],
        "energy": ["2709", "2711", "2701"],
        "forestry": ["4407", "4403", "4418"],
        "minerals": ["7208", "2602", "7601"],
        "manufacturing": ["8708", "8432", "8481"],
    },
    "AK": {
        "agriculture": ["0302", "0303", "0304"],
        "energy": ["2709", "2711", "2710"],
        "forestry": ["4407", "4703", "4801"],
        "minerals": ["7601", "2616", "7108"],
        "manufacturing": ["8905", "8413", "8708"],
    },
}

# Build flat list of all unique HS4 codes across all states
ALL_FOCUS_HS4 = sorted(set(
    hs4 for state_inds in STATE_FOCUS_HS4.values()
    for codes in state_inds.values()
    for hs4 in codes
))

# HS4 → industry mapping (from any state's assignment)
HS4_TO_INDUSTRY = {}
for state_inds in STATE_FOCUS_HS4.values():
    for ind, codes in state_inds.items():
        for c in codes:
            HS4_TO_INDUSTRY[c] = ind

HS4_NAMES = {
    "0201": "Fresh/chilled beef", "0302": "Fresh fish", "0303": "Frozen fish",
    "0304": "Fish fillets", "0402": "Milk & cream", "0406": "Cheese & dairy",
    "0808": "Apples & pears", "1001": "Wheat", "1205": "Rapeseed/canola",
    "2204": "Wine",
    "2701": "Coal", "2709": "Crude petroleum", "2710": "Refined petroleum",
    "2711": "Natural gas/LPG",
    "4403": "Logs/roundwood", "4407": "Sawnwood/lumber", "4411": "Fibreboard",
    "4418": "Builders woodwork", "4703": "Chemical woodpulp", "4801": "Newsprint",
    "2602": "Manganese ores", "2603": "Copper ores", "2616": "Precious metal ores",
    "7108": "Gold", "7208": "Hot-rolled steel", "7403": "Refined copper",
    "7601": "Unwrought aluminum", "7606": "Aluminum plates/sheets",
    "8411": "Turbojets/turboprops", "8413": "Pumps", "8432": "Agricultural machinery",
    "8471": "Computers", "8481": "Valves & taps", "8541": "Semiconductor devices",
    "8542": "Integrated circuits", "8708": "Auto parts", "8802": "Aircraft/spacecraft",
    "8905": "Vessels/platforms",
}


# ============================================================================
# HS2 → Industry Mapping
# ============================================================================

def get_industry_from_hs2(hs2_code: str) -> str:
    try:
        hs2 = int(hs2_code)
    except (ValueError, TypeError):
        return None
    if 1 <= hs2 <= 24:
        return "agriculture"
    elif hs2 == 27:
        return "energy"
    elif 44 <= hs2 <= 49:
        return "forestry"
    elif hs2 in [26, 72, 73, 74, 75, 76]:
        return "minerals"
    elif hs2 in [84, 85, 86, 87, 88, 89, 90]:
        return "manufacturing"
    else:
        return "other"


# ============================================================================
# Data Collection — Industry Level (HS2 aggregation)
# ============================================================================

def fetch_state_trade_industry(state, country_code, year, month, is_export=True):
    """Fetch HS2-level data aggregated to 6 industries (all 25 states)."""
    api_url = STATE_EXPORT_API if is_export else STATE_IMPORT_API
    val_field = "ALL_VAL_YR" if is_export else "GEN_VAL_YR"
    hs_field = "E_COMMODITY" if is_export else "I_COMMODITY"

    params = {
        "get": f"STATE,CTY_CODE,{hs_field},{val_field}",
        "time": f"{year}-{month}",
        "STATE": state,
        "CTY_CODE": country_code,
        "key": API_KEY
    }

    try:
        response = requests.get(api_url, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 1:
                headers = data[0]
                val_idx = headers.index(val_field)
                hs_idx = headers.index(hs_field)

                industry_totals = {}
                total = 0
                for row in data[1:]:
                    try:
                        hs_code = row[hs_idx]
                        val_str = row[val_idx]
                        if not hs_code or len(hs_code) != 2:
                            continue
                        if not val_str or val_str == '-':
                            continue
                        value = int(val_str)
                        industry = get_industry_from_hs2(hs_code)
                        if industry:
                            industry_totals[industry] = industry_totals.get(industry, 0) + value
                            total += value
                    except (ValueError, IndexError):
                        pass
                return {"total": total, "by_industry": industry_totals}
        return {"total": 0, "by_industry": {}}
    except Exception:
        return {"total": 0, "by_industry": {}}


# ============================================================================
# Data Collection — Product Level (HS4 detail, PNWER 5 states × CA/MX only)
# ============================================================================

def fetch_state_trade_hs4(state, country_code, year, month, is_export=True):
    """Fetch HS4-level product detail — returns trade value per HS4 code."""
    api_url = STATE_EXPORT_API if is_export else STATE_IMPORT_API
    val_field = "ALL_VAL_YR" if is_export else "GEN_VAL_YR"
    hs_field = "E_COMMODITY" if is_export else "I_COMMODITY"

    params = {
        "get": f"STATE,CTY_CODE,{hs_field},{val_field}",
        "time": f"{year}-{month}",
        "STATE": state,
        "CTY_CODE": country_code,
        "key": API_KEY
    }

    try:
        response = requests.get(api_url, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 1:
                headers = data[0]
                val_idx = headers.index(val_field)
                hs_idx = headers.index(hs_field)

                hs4_totals = {}
                for row in data[1:]:
                    try:
                        hs_code = row[hs_idx]
                        val_str = row[val_idx]
                        if not hs_code or not val_str or val_str == '-':
                            continue
                        value = int(val_str)
                        if value <= 0:
                            continue
                        # Take first 4 digits as HS4
                        hs4 = hs_code[:4]
                        if hs4 in ALL_FOCUS_HS4:
                            hs4_totals[hs4] = hs4_totals.get(hs4, 0) + value
                    except (ValueError, IndexError):
                        pass
                return hs4_totals
        return {}
    except Exception:
        return {}


# ============================================================================
# National-Level Trade Data
# ============================================================================

def fetch_national_trade(country_code, year, month, is_export=True):
    api_url = NATIONAL_EXPORT_API if is_export else NATIONAL_IMPORT_API
    val_field = "ALL_VAL_YR" if is_export else "GEN_VAL_YR"
    hs_field = "E_COMMODITY" if is_export else "I_COMMODITY"

    params = {
        "get": f"CTY_CODE,{hs_field},{val_field}",
        "time": f"{year}-{month}",
        "CTY_CODE": country_code,
        "key": API_KEY
    }

    try:
        response = requests.get(api_url, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 1:
                headers = data[0]
                val_idx = headers.index(val_field)
                hs_idx = headers.index(hs_field)
                total = 0
                by_industry = {}
                for row in data[1:]:
                    try:
                        hs_code = row[hs_idx]
                        val_str = row[val_idx]
                        if hs_code and len(hs_code) == 2 and val_str and val_str != '-':
                            value = int(val_str)
                            total += value
                            industry = get_industry_from_hs2(hs_code)
                            if industry:
                                by_industry[industry] = by_industry.get(industry, 0) + value
                    except (ValueError, IndexError):
                        pass
                return {"total": total, "by_industry": by_industry}
        return {"total": 0, "by_industry": {}}
    except Exception:
        return {"total": 0, "by_industry": {}}


# ============================================================================
# Main Collection Pipeline
# ============================================================================

def collect_all():
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║       PNWER Trade Data Collector v9                         ║
    ║       Industry (25 states) + Product HS4 (PNWER 5 states)   ║
    ╚══════════════════════════════════════════════════════════════╝
    """)

    # ================================================================
    # Part 1: Industry-level data (all 25 states, same as v8)
    # ================================================================
    print("=" * 60)
    print(f"[Part 1] Industry-level data ({len(ALL_STATES)} states × 2 partners × {len(YEARS)} years)")
    n_req = len(ALL_STATES) * 2 * len(YEARS) * 2
    print(f"  Estimated requests: {n_req}, ~{n_req * 0.15 / 60:.0f} min")
    print("=" * 60)

    state_data = {}
    current = 0

    for state in ALL_STATES:
        state_data[state] = {
            "name": STATE_NAMES[state],
            "group": "pnwer" if state in PNWER_STATES else "control",
            "CA": {}, "MX": {}
        }
        for cty_code, partner in [("1220", "CA"), ("2010", "MX")]:
            for year in YEARS:
                month = YEAR_2025_MONTH if year == 2025 else "12"

                current += 1
                print(f"\r  [{current}/{n_req}] {state} → {partner} ({year})...", end="", flush=True)
                exports = fetch_state_trade_industry(state, cty_code, year, month, is_export=True)

                current += 1
                print(f"\r  [{current}/{n_req}] {state} ← {partner} ({year})...", end="", flush=True)
                imports = fetch_state_trade_industry(state, cty_code, year, month, is_export=False)

                state_data[state][partner][str(year)] = {
                    "total": {
                        "exports": exports["total"],
                        "imports": imports["total"],
                        "balance": exports["total"] - imports["total"]
                    },
                    "by_industry": {}
                }
                all_ind = set(exports["by_industry"].keys()) | set(imports["by_industry"].keys())
                for ind in all_ind:
                    state_data[state][partner][str(year)]["by_industry"][ind] = {
                        "exports": exports["by_industry"].get(ind, 0),
                        "imports": imports["by_industry"].get(ind, 0),
                        "balance": exports["by_industry"].get(ind, 0) - imports["by_industry"].get(ind, 0)
                    }
                time.sleep(0.1)

    print(f"\n  Part 1 complete!")

    # ================================================================
    # Part 2: Product-level HS4 data (PNWER 5 states × CA/MX only)
    # ================================================================
    print("\n" + "=" * 60)
    n_hs4 = len(PNWER_STATES) * 2 * len(YEARS) * 2
    print(f"[Part 2] Product-level HS4 data (PNWER 5 states × 2 partners × {len(YEARS)} years)")
    print(f"  Focus products: {len(ALL_FOCUS_HS4)} HS4 codes")
    print(f"  Estimated requests: {n_hs4}, ~{n_hs4 * 0.15 / 60:.0f} min")
    print("=" * 60)

    product_data = {}
    current = 0

    for state in PNWER_STATES:
        product_data[state] = {"CA": {}, "MX": {}}
        for cty_code, partner in [("1220", "CA"), ("2010", "MX")]:
            for year in YEARS:
                month = YEAR_2025_MONTH if year == 2025 else "12"

                current += 1
                print(f"\r  [{current}/{n_hs4}] {state} → {partner} HS4 ({year})...", end="", flush=True)
                exp_hs4 = fetch_state_trade_hs4(state, cty_code, year, month, is_export=True)

                current += 1
                print(f"\r  [{current}/{n_hs4}] {state} ← {partner} HS4 ({year})...", end="", flush=True)
                imp_hs4 = fetch_state_trade_hs4(state, cty_code, year, month, is_export=False)

                all_hs4 = set(exp_hs4.keys()) | set(imp_hs4.keys())
                yr_data = {}
                for hs4 in all_hs4:
                    yr_data[hs4] = {
                        "exports": exp_hs4.get(hs4, 0),
                        "imports": imp_hs4.get(hs4, 0),
                    }
                product_data[state][partner][str(year)] = yr_data
                time.sleep(0.1)

    print(f"\n  Part 2 complete!")

    # ================================================================
    # Part 3: National-level data (with industry breakdown)
    # ================================================================
    print("\n" + "=" * 60)
    print(f"[Part 3] National-level data ({len(COUNTRIES)} countries × {len(YEARS)} years)")
    print("=" * 60)

    national_data = {}
    n_nat = len(COUNTRIES) * len(YEARS) * 2
    current = 0

    for cty_code, cty_info in COUNTRIES.items():
        code = cty_info["code"]
        national_data[code] = {"name": cty_info["name"], "group": cty_info["group"], "years": {}}
        for year in YEARS:
            month = YEAR_2025_MONTH if year == 2025 else "12"

            current += 1
            print(f"\r  [{current}/{n_nat}] US → {code} ({year})...", end="", flush=True)
            exp = fetch_national_trade(cty_code, year, month, is_export=True)

            current += 1
            print(f"\r  [{current}/{n_nat}] US ← {code} ({year})...", end="", flush=True)
            imp = fetch_national_trade(cty_code, year, month, is_export=False)

            national_data[code]["years"][str(year)] = {
                "exports": exp["total"],
                "imports": imp["total"],
                "exports_by_industry": exp["by_industry"],
                "imports_by_industry": imp["by_industry"],
                "total_trade": exp["total"] + imp["total"],
                "balance": exp["total"] - imp["total"]
            }
            time.sleep(0.15)

    print(f"\n  Part 3 complete!")

    return state_data, product_data, national_data


def build_and_save(state_data, product_data, national_data):
    output = {
        "metadata": {
            "version": "9.0",
            "description": "PNWER Trade Analysis — Industry + Product Level",
            "source": "U.S. Census Bureau API (statehs endpoint)",
            "generated_at": datetime.datetime.now().isoformat(),
            "years": YEARS,
            "notes": [
                "25-state industry level: 5 PNWER + 20 control (HS2 → 6 industries)",
                "5-state product level: PNWER only × CA/MX (HS4 focus products)",
                "National level with industry breakdown (for Layer 1 DID)",
            ]
        },
        "industries": {
            "agriculture": {"hs2_range": "01-24"},
            "energy": {"hs2_range": "27"},
            "forestry": {"hs2_range": "44-49"},
            "minerals": {"hs2_range": "26, 72-76"},
            "manufacturing": {"hs2_range": "84-90"},
            "other": {"hs2_range": "all others"}
        },
        "focus_products": {
            state: {
                ind: {hs4: HS4_NAMES.get(hs4, hs4) for hs4 in codes}
                for ind, codes in inds.items()
            }
            for state, inds in STATE_FOCUS_HS4.items()
        },
        "national_trade": national_data,
        "state_trade": state_data,
        "product_trade": product_data,
    }

    path = "data/pnwer_analysis_data_v9.json"
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved: {path}")

    # Also save v8-compatible version (without product_trade, for backward compatibility)
    v8_compat = {k: v for k, v in output.items() if k != "product_trade"}
    v8_path = "data/pnwer_analysis_data_v8.json"
    with open(v8_path, 'w', encoding='utf-8') as f:
        json.dump(v8_compat, f, indent=2, ensure_ascii=False)
    print(f"  Saved v8-compatible: {v8_path}")

    return output


def print_product_summary(product_data):
    print("\n" + "=" * 75)
    print("Product-level data summary (per-state, CA bilateral, 2024 vs 2025)")
    print("=" * 75)

    for state in PNWER_STATES:
        print(f"\n  {STATE_NAMES[state]}")
        print(f"  {'-'*65}")
        print(f"  {'HS4':<6} {'Product':<22} {'Exp24':>8} {'Exp25':>8} {'Imp24':>8} {'Imp25':>8}")

        state_hs4 = set()
        for codes in STATE_FOCUS_HS4[state].values():
            state_hs4.update(codes)

        for hs4 in sorted(state_hs4):
            e24 = product_data[state]["CA"].get("2024", {}).get(hs4, {}).get("exports", 0)
            e25 = product_data[state]["CA"].get("2025", {}).get(hs4, {}).get("exports", 0)
            i24 = product_data[state]["CA"].get("2024", {}).get(hs4, {}).get("imports", 0)
            i25 = product_data[state]["CA"].get("2025", {}).get(hs4, {}).get("imports", 0)
            if e24 > 0 or i24 > 0:
                print(f"  {hs4:<6} {HS4_NAMES.get(hs4,''):<22} ${e24/1e6:>6.0f}M ${e25/1e6:>6.0f}M ${i24/1e6:>6.0f}M ${i25/1e6:>6.0f}M")


def main():
    state_data, product_data, national_data = collect_all()
    output = build_and_save(state_data, product_data, national_data)
    print_product_summary(product_data)

    total_req = len(ALL_STATES)*2*len(YEARS)*2 + len(PNWER_STATES)*2*len(YEARS)*2 + len(COUNTRIES)*len(YEARS)*2
    print(f"\n{'='*60}")
    print(f"  v9 collection complete!")
    print(f"  Total requests: {total_req}")
    print(f"  Industry level: {len(ALL_STATES)} states × 2 partners × {len(YEARS)} years")
    print(f"  Product level: {len(PNWER_STATES)} states × 2 partners × {len(YEARS)} years × {len(ALL_FOCUS_HS4)} HS4 codes")
    print(f"  National level: {len(COUNTRIES)} countries × {len(YEARS)} years")
    print(f"  Per-state products: 5 industries × 3 each = 15 per state")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()