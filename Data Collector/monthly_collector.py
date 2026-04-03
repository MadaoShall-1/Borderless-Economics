"""
PNWER Monthly Trade Data Collector
-----------------------------------
Standalone collector for monthly Census Bureau trade data.
Used by refresh_pipeline.py to fetch the latest available month.

Does NOT depend on census_data_collector.py — all config and fetch
logic is self-contained so it can run independently.

Data layers collected (per month):
  A. State industry-level  (25 states × CA/MX, HS2 → 6 industries)
  B. State product-level   (PNWER 5 states × CA/MX, HS4 focus products)
  C. National-level        (7 countries, HS2 → 6 industries)
"""

import requests
import json
import time
import datetime
from pathlib import Path

# ============================================================================
# Configuration
# ============================================================================

API_KEY = "f51f8af17882fc49a8c6a2eec80c9b9d522562fd"

PNWER_STATES = ["WA", "OR", "ID", "MT", "AK"]
CONTROL_STATES = [
    "MI", "MN", "ND", "WI", "NY",
    "CA", "NV", "UT", "CO", "WY",
    "TX", "LA", "OK", "NE", "KS",
    "FL", "GA", "NC", "SC", "VA",
]
ALL_STATES = PNWER_STATES + CONTROL_STATES

COUNTRIES = {
    "1220": {"code": "CA", "name": "Canada",         "group": "usmca"},
    "2010": {"code": "MX", "name": "Mexico",          "group": "usmca"},
    "5700": {"code": "CN", "name": "China",            "group": "control"},
    "5880": {"code": "JP", "name": "Japan",            "group": "control"},
    "4280": {"code": "DE", "name": "Germany",          "group": "control"},
    "4120": {"code": "UK", "name": "United Kingdom",   "group": "control"},
    "5800": {"code": "KR", "name": "South Korea",      "group": "control"},
}

# Per-state HS4 focus products (same as census_data_collector v9)
STATE_FOCUS_HS4 = {
    "WA": {
        "agriculture":   ["0808", "0302", "0406"],
        "energy":        ["2709", "2710", "2711"],
        "forestry":      ["4407", "4418", "4703"],
        "minerals":      ["7601", "7606", "7208"],
        "manufacturing": ["8802", "8411", "8708"],
    },
    "OR": {
        "agriculture":   ["2204", "0808", "1001"],
        "energy":        ["2710", "2709", "2711"],
        "forestry":      ["4407", "4703", "4801"],
        "minerals":      ["7208", "7601", "7606"],
        "manufacturing": ["8542", "8471", "8541"],
    },
    "ID": {
        "agriculture":   ["1001", "1205", "0402"],
        "energy":        ["2709", "2710", "2711"],
        "forestry":      ["4407", "4703", "4418"],
        "minerals":      ["7601", "7403", "2603"],
        "manufacturing": ["8542", "8471", "8432"],
    },
    "MT": {
        "agriculture":   ["1001", "0201", "1205"],
        "energy":        ["2709", "2710", "2701"],
        "forestry":      ["4407", "4403", "4411"],
        "minerals":      ["7108", "2616", "7403"],
        "manufacturing": ["8481", "8413", "8708"],
    },
    "AK": {
        "agriculture":   ["0303", "0304", "0302"],
        "energy":        ["2709", "2711", "2710"],
        "forestry":      ["4407", "4703", "4418"],
        "minerals":      ["7601", "2602", "7108"],
        "manufacturing": ["8905", "8411", "8708"],
    },
}

ALL_FOCUS_HS4 = sorted(set(
    hs4
    for state_inds in STATE_FOCUS_HS4.values()
    for codes in state_inds.values()
    for hs4 in codes
))

# Census API endpoints
STATE_EXPORT_API  = "https://api.census.gov/data/timeseries/intltrade/exports/statehs"
STATE_IMPORT_API  = "https://api.census.gov/data/timeseries/intltrade/imports/statehs"
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
# Auto-detect latest available Census month
# ============================================================================

def detect_latest_month() -> tuple[int, int]:
    """
    Probe the Census API to find the most recent month with data.
    Strategy: start from 2 months ago (typical publication lag), then
    try 1 month ago. Return the latest (year, month) that has data.
    """
    today = datetime.date.today()
    candidates = []
    # Try 1 month back, 2 months back, 3 months back
    for offset in [1, 2, 3]:
        d = today.replace(day=1)
        for _ in range(offset):
            d = (d - datetime.timedelta(days=1)).replace(day=1)
        candidates.append((d.year, d.month))

    # Probe with a known-good request: WA exports to CA
    for year, month in candidates:
        try:
            params = {
                "get": "STATE,CTY_CODE,ALL_VAL_MO",
                "time": f"{year}-{month:02d}",
                "STATE": "WA",
                "CTY_CODE": "1220",
                "key": API_KEY,
            }
            resp = requests.get(STATE_EXPORT_API, params=params, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) > 1:
                    print(f"  Latest available month: {year}-{month:02d}")
                    return (year, month)
        except Exception:
            pass
        time.sleep(0.2)

    # Fallback: 2 months back (safest bet)
    d = today.replace(day=1) - datetime.timedelta(days=1)
    d = (d.replace(day=1) - datetime.timedelta(days=1))
    print(f"  Probe failed — falling back to {d.year}-{d.month:02d}")
    return (d.year, d.month)


# ============================================================================
# Fetch Functions — Monthly (ALL_VAL_MO / GEN_VAL_MO)
# ============================================================================

def fetch_monthly_industry(state, country_code, year, month, is_export=True):
    """
    Fetch single-month HS2 data for one state × one partner,
    aggregate to 6 industries. Uses ALL_VAL_MO (export) / GEN_VAL_MO (import).
    """
    api_url  = STATE_EXPORT_API if is_export else STATE_IMPORT_API
    val_field = "ALL_VAL_MO" if is_export else "GEN_VAL_MO"
    hs_field  = "E_COMMODITY" if is_export else "I_COMMODITY"

    params = {
        "get": f"STATE,CTY_CODE,{hs_field},{val_field}",
        "time": f"{year}-{month:02d}",
        "STATE": state,
        "CTY_CODE": country_code,
        "key": API_KEY,
    }

    try:
        resp = requests.get(api_url, params=params, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 1:
                headers = data[0]
                val_idx = headers.index(val_field)
                hs_idx  = headers.index(hs_field)

                industry_totals = {}
                total = 0
                for row in data[1:]:
                    try:
                        hs_code = row[hs_idx]
                        val_str = row[val_idx]
                        if not hs_code or len(hs_code) != 2:
                            continue
                        if not val_str or val_str == "-":
                            continue
                        value = int(val_str)
                        industry = get_industry_from_hs2(hs_code)
                        if industry:
                            industry_totals[industry] = industry_totals.get(industry, 0) + value
                            total += value
                    except (ValueError, IndexError):
                        pass
                return {"total": total, "by_industry": industry_totals}
        return None
    except Exception:
        return None


def fetch_monthly_hs4(state, country_code, year, month, is_export=True):
    """
    Fetch single-month HS-level data, extract HS4 focus products.
    Uses ALL_VAL_MO / GEN_VAL_MO for monthly values.
    """
    api_url  = STATE_EXPORT_API if is_export else STATE_IMPORT_API
    val_field = "ALL_VAL_MO" if is_export else "GEN_VAL_MO"
    hs_field  = "E_COMMODITY" if is_export else "I_COMMODITY"

    params = {
        "get": f"STATE,CTY_CODE,{hs_field},{val_field}",
        "time": f"{year}-{month:02d}",
        "STATE": state,
        "CTY_CODE": country_code,
        "key": API_KEY,
    }

    try:
        resp = requests.get(api_url, params=params, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 1:
                headers = data[0]
                val_idx = headers.index(val_field)
                hs_idx  = headers.index(hs_field)

                hs4_totals = {}
                for row in data[1:]:
                    try:
                        hs_code = row[hs_idx]
                        val_str = row[val_idx]
                        if not hs_code or not val_str or val_str == "-":
                            continue
                        value = int(val_str)
                        if value <= 0:
                            continue
                        hs4 = hs_code[:4]
                        if hs4 in ALL_FOCUS_HS4:
                            hs4_totals[hs4] = hs4_totals.get(hs4, 0) + value
                    except (ValueError, IndexError):
                        pass
                return hs4_totals
        return {}
    except Exception:
        return {}


def fetch_monthly_national(country_code, year, month, is_export=True):
    """
    Fetch single-month national-level HS2 data for one country,
    aggregate to 6 industries. Uses ALL_VAL_MO / GEN_VAL_MO.
    """
    api_url  = NATIONAL_EXPORT_API if is_export else NATIONAL_IMPORT_API
    val_field = "ALL_VAL_MO" if is_export else "GEN_VAL_MO"
    hs_field  = "E_COMMODITY" if is_export else "I_COMMODITY"

    params = {
        "get": f"CTY_CODE,{hs_field},{val_field}",
        "time": f"{year}-{month:02d}",
        "CTY_CODE": country_code,
        "key": API_KEY,
    }

    try:
        resp = requests.get(api_url, params=params, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 1:
                headers = data[0]
                val_idx = headers.index(val_field)
                hs_idx  = headers.index(hs_field)

                total = 0
                by_industry = {}
                for row in data[1:]:
                    try:
                        hs_code = row[hs_idx]
                        val_str = row[val_idx]
                        if hs_code and len(hs_code) == 2 and val_str and val_str != "-":
                            value = int(val_str)
                            total += value
                            industry = get_industry_from_hs2(hs_code)
                            if industry:
                                by_industry[industry] = by_industry.get(industry, 0) + value
                    except (ValueError, IndexError):
                        pass
                return {"total": total, "by_industry": by_industry}
        return None
    except Exception:
        return None