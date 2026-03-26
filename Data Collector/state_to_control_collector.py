"""
PNWER State-to-Control-Countries Data Collector v9
Collects export data from 25 states to non-USMCA control countries.

Used for within-state DDD analysis:
- State exports to CA/MX (treatment) vs state exports to JP/KR/UK/DE (control)

Control country selection criteria:
- Stable comparable large economies
- Excludes countries hit by concurrent trade shocks (CN excluded)
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

# 25 states (same as v8)
PNWER_STATES = ["WA", "OR", "ID", "MT", "AK"]
CONTROL_STATES = [
    "MI", "MN", "ND", "WI", "NY",  # Northern border
    "CA", "NV", "UT", "CO", "WY",  # Western
    "TX", "LA", "OK", "NE", "KS",  # Energy/agriculture
    "FL", "GA", "NC", "SC", "VA"   # Southeast
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

# Control countries (CN excluded to avoid trade war confounding)
CONTROL_COUNTRIES = {
    "5880": {"code": "JP", "name": "Japan"},
    "5800": {"code": "KR", "name": "South Korea"},
    "4120": {"code": "UK", "name": "United Kingdom"},
    "4280": {"code": "DE", "name": "Germany"},
}

YEARS = list(range(2017, 2026))
YEAR_2025_MONTH = "11"

STATE_EXPORT_API = "https://api.census.gov/data/timeseries/intltrade/exports/statehs"


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
# Data Collection
# ============================================================================

def fetch_state_exports(state: str, country_code: str, year: int, month: str) -> dict:
    """Fetch state exports to a given country."""
    
    params = {
        "get": f"STATE,CTY_CODE,E_COMMODITY,ALL_VAL_YR",
        "time": f"{year}-{month}",
        "STATE": state,
        "CTY_CODE": country_code,
        "key": API_KEY
    }
    
    try:
        response = requests.get(STATE_EXPORT_API, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 1:
                headers = data[0]
                val_idx = headers.index("ALL_VAL_YR")
                hs_idx = headers.index("E_COMMODITY")
                
                industry_totals = {}
                total = 0
                
                for row in data[1:]:
                    try:
                        hs_code = row[hs_idx]
                        val_str = row[val_idx]
                        
                        # HS2-level only
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
    except Exception as e:
        return {"total": 0, "by_industry": {}}


def collect_all_data() -> dict:
    """Collect all state-to-control-country export data."""
    
    print("\n" + "=" * 60)
    print(f"State → Control country export data collection")
    print(f"   States: {len(ALL_STATES)}")
    print(f"   Control countries: {list(CONTROL_COUNTRIES.values())}")
    print(f"   Years: {YEARS[0]}-{YEARS[-1]}")
    print("=" * 60)
    
    # Requests: 25 states × 4 countries × 9 years = 900
    total_requests = len(ALL_STATES) * len(CONTROL_COUNTRIES) * len(YEARS)
    current = 0
    
    state_data = {}
    
    for state in ALL_STATES:
        state_data[state] = {
            "name": STATE_NAMES[state],
            "group": "pnwer" if state in PNWER_STATES else "control"
        }
        
        for cty_census_code, cty_info in CONTROL_COUNTRIES.items():
            cty_code = cty_info["code"]
            state_data[state][cty_code] = {}
            
            for year in YEARS:
                month = YEAR_2025_MONTH if year == 2025 else "12"
                
                current += 1
                print(f"\r[{current}/{total_requests}] {state} → {cty_code} ({year})...", 
                      end="", flush=True)
                
                exports = fetch_state_exports(state, cty_census_code, year, month)
                
                state_data[state][cty_code][str(year)] = {
                    "exports": exports["total"],
                    "by_industry": exports["by_industry"]
                }
                
                time.sleep(0.1)
    
    print(f"\n  Collection complete!")
    return state_data


def build_output(state_data: dict) -> dict:
    """Build output JSON."""
    
    return {
        "metadata": {
            "version": "9.0",
            "description": "State exports to control countries (for DDD analysis)",
            "source": "U.S. Census Bureau API",
            "generated_at": datetime.datetime.now().isoformat(),
            "years": YEARS,
            "notes": [
                "Control country data for within-state DDD analysis",
                "Control countries: JP, KR, UK, DE (CN excluded to avoid trade war confounding)",
                "Used in conjunction with v8 state data"
            ]
        },
        
        "control_countries": {
            code: info["name"] for code, info in 
            {v["code"]: v for v in CONTROL_COUNTRIES.values()}.items()
        },
        
        "states": {
            "pnwer": PNWER_STATES,
            "control": CONTROL_STATES
        },
        
        "industries": {
            "agriculture": "HS 01-24",
            "energy": "HS 27",
            "forestry": "HS 44-49",
            "minerals": "HS 26, 72-76",
            "manufacturing": "HS 84-90",
            "other": "others"
        },
        
        "state_exports_to_control": state_data
    }


def print_summary(state_data: dict):
    """Print summary."""
    print("\n" + "=" * 70)
    print("Data summary: State exports to control countries (2019)")
    print("=" * 70)
    
    print(f"\n{'State':<5} {'Group':<8} {'→JP':<12} {'→KR':<12} {'→UK':<12} {'→DE':<12}")
    print("-" * 65)
    
    for state in ALL_STATES[:10]:  # Show first 10 only
        data = state_data[state]
        group = data["group"]
        
        jp = data.get("JP", {}).get("2019", {}).get("exports", 0) / 1e9
        kr = data.get("KR", {}).get("2019", {}).get("exports", 0) / 1e9
        uk = data.get("UK", {}).get("2019", {}).get("exports", 0) / 1e9
        de = data.get("DE", {}).get("2019", {}).get("exports", 0) / 1e9
        
        print(f"{state:<5} {group:<8} ${jp:>8.2f}B  ${kr:>8.2f}B  ${uk:>8.2f}B  ${de:>8.2f}B")
    
    print("... (remaining states omitted)")


def save_data(data: dict, path: str = "data/state_to_control_countries.json"):
    """Save data to JSON file."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\n  Data saved: {path}")


def main():
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║       State → Control Countries Export Collector            ║
    ║       25 states × 4 control countries (JP/KR/UK/DE)         ║
    ╚══════════════════════════════════════════════════════════════╝
    """)
    
    print(f"  Estimated requests: ~900, ~8-10 min\n")
    
    # Collect
    state_data = collect_all_data()
    
    # Summary
    print_summary(state_data)
    
    # Save
    output = build_output(state_data)
    save_data(output, "data/state_to_control_countries.json")
    
    print("\n" + "=" * 60)
    print("  Complete!")
    print("   This data is used for within-state DDD analysis")
    print("   Must be used with pnwer_analysis_data_v8.json")
    print("=" * 60)


if __name__ == "__main__":
    main()