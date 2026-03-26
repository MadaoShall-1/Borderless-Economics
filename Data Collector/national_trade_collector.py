"""
National Trade Data Collector
Collects U.S. national-level export data to each trading partner.

Used for Layer 1 DID analysis:
- Treatment: US exports to CA/MX (USMCA)
- Control: US exports to JP/KR/UK/DE (stable comparable large economies)

Note: CN excluded due to concurrent trade war impact.
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

# Trade partners
COUNTRIES = {
    # USMCA (Treatment)
    "1220": {"code": "CA", "name": "Canada", "group": "usmca"},
    "2010": {"code": "MX", "name": "Mexico", "group": "usmca"},
    # Control — stable comparable large economies
    "5880": {"code": "JP", "name": "Japan", "group": "control"},
    "5800": {"code": "KR", "name": "South Korea", "group": "control"},
    "4120": {"code": "UK", "name": "United Kingdom", "group": "control"},
    "4280": {"code": "DE", "name": "Germany", "group": "control"},
}

YEARS = list(range(2017, 2026))
YEAR_2025_MONTH = "11"

NATIONAL_EXPORT_API = "https://api.census.gov/data/timeseries/intltrade/exports/hs"
NATIONAL_IMPORT_API = "https://api.census.gov/data/timeseries/intltrade/imports/hs"


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

def fetch_national_trade(country_code: str, year: int, month: str, 
                         is_export: bool = True) -> dict:
    """Fetch national-level trade data for a given country (with industry breakdown)."""
    
    if is_export:
        api_url = NATIONAL_EXPORT_API
        val_field = "ALL_VAL_YR"
        hs_field = "E_COMMODITY"
    else:
        api_url = NATIONAL_IMPORT_API
        val_field = "GEN_VAL_YR"
        hs_field = "I_COMMODITY"
    
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
    """Collect all national-level trade data."""
    
    print("\n" + "=" * 60)
    print("National-level trade data collection")
    print(f"   USMCA: CA, MX")
    print(f"   Control: JP, KR, UK, DE")
    print(f"   Years: {YEARS[0]}-{YEARS[-1]}")
    print("=" * 60)
    
    # Requests: 6 countries × 9 years × 2 (exports+imports) = 108
    total_requests = len(COUNTRIES) * len(YEARS) * 2
    current = 0
    
    national_data = {}
    
    for cty_census_code, cty_info in COUNTRIES.items():
        code = cty_info["code"]
        national_data[code] = {
            "name": cty_info["name"],
            "group": cty_info["group"],
            "years": {}
        }
        
        for year in YEARS:
            month = YEAR_2025_MONTH if year == 2025 else "12"
            
            # Exports
            current += 1
            print(f"\r[{current}/{total_requests}] US → {code} ({year})...", 
                  end="", flush=True)
            exports = fetch_national_trade(cty_census_code, year, month, is_export=True)
            
            # Imports
            current += 1
            print(f"\r[{current}/{total_requests}] US ← {code} ({year})...", 
                  end="", flush=True)
            imports = fetch_national_trade(cty_census_code, year, month, is_export=False)
            
            national_data[code]["years"][str(year)] = {
                "exports": exports["total"],
                "imports": imports["total"],
                "total_trade": exports["total"] + imports["total"],
                "balance": exports["total"] - imports["total"],
                "exports_by_industry": exports["by_industry"],
                "imports_by_industry": imports["by_industry"]
            }
            
            time.sleep(0.15)
    
    print(f"\n  Collection complete!")
    return national_data


def build_output(national_data: dict) -> dict:
    """Build output JSON."""
    
    return {
        "metadata": {
            "version": "1.0",
            "description": "US national trade with USMCA and control countries",
            "source": "U.S. Census Bureau API",
            "generated_at": datetime.datetime.now().isoformat(),
            "years": YEARS,
            "notes": [
                "Used for Layer 1 DID analysis",
                "Treatment: CA, MX (USMCA)",
                "Control: JP, KR, UK, DE (stable comparable large economies)",
                "CN excluded (trade war confounding)",
                "Recommended post-period starts from 2021 (excluding 2020 transition year)"
            ]
        },
        
        "analysis_design": {
            "treatment": ["CA", "MX"],
            "control": ["JP", "KR", "UK", "DE"],
            "pre_period": "2017-2019",
            "post_period": "2021-2025 (recommended)",
            "transition_year": 2020
        },
        
        "industries": {
            "agriculture": "HS 01-24",
            "energy": "HS 27",
            "forestry": "HS 44-49",
            "minerals": "HS 26, 72-76",
            "manufacturing": "HS 84-90",
            "other": "others"
        },
        
        "national_trade": national_data
    }


def print_summary(national_data: dict):
    """Print summary."""
    print("\n" + "=" * 70)
    print("Data summary: US exports (billions USD)")
    print("=" * 70)
    
    print(f"\n{'Country':<8} {'Group':<10} {'2019':<12} {'2024':<12} {'Growth':<10}")
    print("-" * 55)
    
    for code, data in national_data.items():
        exp_19 = data["years"]["2019"]["exports"] / 1e9
        exp_24 = data["years"]["2024"]["exports"] / 1e9
        growth = (exp_24 / exp_19 - 1) * 100 if exp_19 > 0 else 0
        
        print(f"{code:<8} {data['group']:<10} ${exp_19:>8.1f}B    ${exp_24:>8.1f}B    {growth:>+6.1f}%")
    
    # Group averages
    print("-" * 55)
    for group in ["usmca", "control"]:
        pre_total = sum(d["years"]["2019"]["exports"] for d in national_data.values() 
                       if d["group"] == group)
        post_total = sum(d["years"]["2024"]["exports"] for d in national_data.values() 
                        if d["group"] == group)
        growth = (post_total / pre_total - 1) * 100 if pre_total > 0 else 0
        print(f"{group.upper():<8} {'avg':<10} ${pre_total/1e9:>8.1f}B    ${post_total/1e9:>8.1f}B    {growth:>+6.1f}%")


def save_data(data: dict, path: str = "data/national_trade.json"):
    """Save data to JSON file."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\n  Data saved: {path}")


def main():
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║       National Trade Data Collector                         ║
    ║       US → USMCA(CA/MX) + Control(JP/KR/UK/DE)              ║
    ╚══════════════════════════════════════════════════════════════╝
    """)
    
    print(f"  Estimated requests: ~108, ~2 min\n")
    
    # Collect
    national_data = collect_all_data()
    
    # Summary
    print_summary(national_data)
    
    # Save
    output = build_output(national_data)
    save_data(output, "data/national_trade.json")
    
    print("\n" + "=" * 60)
    print("  Complete!")
    print("   Used for Layer 1 DID: overall USMCA effect")
    print("=" * 60)


if __name__ == "__main__":
    main()