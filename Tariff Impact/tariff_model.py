"""
PNWER Bilateral Tariff Impact Model — Core
Shared parameters, computation logic, and data loading.

v2: Monthly-calibrated elasticities (Apr-Dec 2025 seasonal-adjusted)
    - AGG_SCALE removed — monthly ε already reflects real market response
    - Monthly tariff timeline added for forecast engine
    - Paths unified to pnwer-dashboard/src/data/
"""

import json
import os
from pathlib import Path

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_DATA = os.path.join(SCRIPT_DIR, "..", "pnwer-dashboard", "src", "data")
DATA_PATH = os.path.join(DASHBOARD_DATA, "pnwer_analysis_data_v9.json")
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")
CA_DATA_PATH = os.path.join(DASHBOARD_DATA, "statcan_provinces.json")
JSON_OUT = DASHBOARD_DATA

# Load config
with open(CONFIG_PATH, 'r') as f:
    _CONFIG = json.load(f)

US_CONFIG = _CONFIG["US"]
CA_CONFIG = _CONFIG["CA"]
_US_SET = set(US_CONFIG["regions"])
_CA_SET = set(CA_CONFIG["regions"])

def get_config(region_code):
    if region_code in _US_SET: return US_CONFIG
    if region_code in _CA_SET: return CA_CONFIG
    raise ValueError(f"Unknown region: {region_code}")

PNWER_STATES = ["WA", "OR", "ID", "MT", "AK"]
STATE_NAMES = {"WA": "Washington", "OR": "Oregon", "ID": "Idaho", "MT": "Montana", "AK": "Alaska"}
INDUSTRIES = ["agriculture", "energy", "forestry", "minerals", "manufacturing", "other"]

WTI_2024 = 77.13
WTI_2025 = 65.00
WTI_CHG = (WTI_2025 - WTI_2024) / WTI_2024
ENERGY_HS4 = {"2709", "2710", "2711", "2701"}

# ==========================================================================
# INDUSTRY-LEVEL PARAMETERS — Monthly-calibrated (v2)
# ==========================================================================
# Elasticities back-calibrated from monthly Census data (Apr-Dec 2025)
# using seasonal adjustment from 2024 same-period.
# Method: ε = Σ_m [ w_m × (trade25_m/trade24_m - 1) / τ_m ] (trade-weighted)
#
# Changes from v1:
#   agriculture:   -1.5 → -1.9  (monthly shows higher sensitivity)
#   energy:        -0.5 → -0.5  (kept — monthly unreliable due to oil price)
#   forestry:      -1.2 → -1.3  (monthly slightly higher, validated)
#   minerals:      -0.8 → -0.8  (monthly validates annual)
#   manufacturing: -2.0 → -1.0  (v1 was OVER-ESTIMATED — USMCA compliance
#                                 means most mfg bypasses tariffs; v1 used
#                                 κ_agg=0.22 as compensating fudge factor)
#   other:         -1.5 → -1.1  (monthly shows less elastic)
#
# AGG_SCALE removed entirely. In v1 it was a fudge factor to compensate
# for inaccurate ε. Now that ε is monthly-calibrated, the elasticity
# already reflects the real market response including USMCA exemptions.
# ==========================================================================

PNWER_IMPORT_TAU = {
    "CA": {"agriculture": 0.215, "energy": 0.100, "forestry": 0.236,
           "minerals": 0.339, "manufacturing": 0.041, "other": 0.058},
    "MX": {"agriculture": 0.173, "energy": 0.000, "forestry": 0.000,
           "minerals": 0.151, "manufacturing": 0.048, "other": 0.046},
}
RETALIATORY_TAU = {
    "CA": {"agriculture": 0.06, "energy": 0.08, "forestry": 0.14,
           "minerals": 0.06, "manufacturing": 0.17, "other": 0.12},
    "MX": {"agriculture": 0.04, "energy": 0.03, "forestry": 0.08,
           "minerals": 0.05, "manufacturing": 0.15, "other": 0.11},
}

# Monthly-calibrated import elasticities (v2)
IMP_ELAST = {"agriculture": -1.9, "energy": -0.5, "forestry": -1.3,
             "minerals": -0.8, "manufacturing": -1.0, "other": -1.1}

# Export elasticities (updated where monthly data was reliable)
EXP_ELAST = {"agriculture": -1.0, "energy": -0.3, "forestry": -1.2,
             "minerals": -0.6, "manufacturing": -1.4, "other": -1.5}

# AGG_SCALE removed — no longer needed with calibrated ε
# Kept as all-1.0 for backward compatibility with cfg-based calls
AGG_SCALE = {"agriculture": 1.0, "energy": 1.0, "forestry": 1.0,
             "minerals": 1.0, "manufacturing": 1.0, "other": 1.0}

IO_MULT = {"agriculture": 1.55, "energy": 1.45, "forestry": 1.45,
           "minerals": 1.50, "manufacturing": 1.45, "other": 1.40}
EXP_MULT = {"agriculture": 1.55, "energy": 1.45, "forestry": 1.45,
            "minerals": 1.50, "manufacturing": 1.45, "other": 1.40}
JOBS_PER_M = {"agriculture": 8.0, "energy": 3.5, "forestry": 6.0,
              "minerals": 5.0, "manufacturing": 4.5, "other": 5.5}
EXP_JOBS = {"agriculture": 8.0, "energy": 3.5, "forestry": 6.0,
            "minerals": 5.0, "manufacturing": 4.5, "other": 5.5}

# ========== PRODUCT-LEVEL TARIFF RATES (HS4) ==========
# Annualized 2025 effective rates based on actual tariff timeline:
#   Feb 4: IEEPA 25% CA/MX (CA energy 10%)
#   Mar 7: USMCA-qualifying goods exempt from IEEPA
#   Mar 12: S232 steel/aluminum 25% reinstated (no country exemptions)
#   Apr 29: Anti-stacking EO (S232 exempt from IEEPA)
#   May 3: S232 auto/auto parts 25%
#   Jun 4: S232 steel/aluminum → 50% for CA/MX
#   Aug 1: IEEPA CA → 35%
#   Oct 14: S232 timber 10% on Canadian softwood

HS4_TARIFFS = {
    "0808": {"imp": {"CA": 0.033, "MX": 0.062}, "exp": {"CA": 0.00, "MX": 0.04}},
    "0402": {"imp": {"CA": 0.195, "MX": 0.165}, "exp": {"CA": 0.06, "MX": 0.04}},
    "1001": {"imp": {"CA": 0.095, "MX": 0.124}, "exp": {"CA": 0.06, "MX": 0.04}},
    "1205": {"imp": {"CA": 0.046, "MX": 0.124}, "exp": {"CA": 0.03, "MX": 0.04}},
    "2204": {"imp": {"CA": 0.245, "MX": 0.206}, "exp": {"CA": 0.10, "MX": 0.10}},
    "0201": {"imp": {"CA": 0.033, "MX": 0.124}, "exp": {"CA": 0.06, "MX": 0.04}},
    "2709": {"imp": {"CA": 0.00,  "MX": 0.10},  "exp": {"CA": 0.00, "MX": 0.03}},
    "2710": {"imp": {"CA": 0.145, "MX": 0.124}, "exp": {"CA": 0.08, "MX": 0.05}},
    "2711": {"imp": {"CA": 0.00,  "MX": 0.10},  "exp": {"CA": 0.00, "MX": 0.03}},
    "2701": {"imp": {"CA": 0.220, "MX": 0.186}, "exp": {"CA": 0.05, "MX": 0.05}},
    "4407": {"imp": {"CA": 0.307, "MX": 0.25},  "exp": {"CA": 0.14, "MX": 0.08}},
    "4418": {"imp": {"CA": 0.195, "MX": 0.165}, "exp": {"CA": 0.12, "MX": 0.08}},
    "4703": {"imp": {"CA": 0.170, "MX": 0.145}, "exp": {"CA": 0.08, "MX": 0.08}},
    "4801": {"imp": {"CA": 0.170, "MX": 0.145}, "exp": {"CA": 0.08, "MX": 0.08}},
    "4403": {"imp": {"CA": 0.220, "MX": 0.186}, "exp": {"CA": 0.10, "MX": 0.08}},
    "4411": {"imp": {"CA": 0.195, "MX": 0.165}, "exp": {"CA": 0.12, "MX": 0.08}},
    "7601": {"imp": {"CA": 0.344, "MX": 0.344}, "exp": {"CA": 0.25, "MX": 0.15}},
    "7606": {"imp": {"CA": 0.344, "MX": 0.344}, "exp": {"CA": 0.25, "MX": 0.15}},
    "7208": {"imp": {"CA": 0.344, "MX": 0.344}, "exp": {"CA": 0.25, "MX": 0.15}},
    "7403": {"imp": {"CA": 0.25,  "MX": 0.25},  "exp": {"CA": 0.10, "MX": 0.10}},
    "2603": {"imp": {"CA": 0.046, "MX": 0.046}, "exp": {"CA": 0.03, "MX": 0.03}},
    "2602": {"imp": {"CA": 0.046, "MX": 0.046}, "exp": {"CA": 0.03, "MX": 0.03}},
    "2616": {"imp": {"CA": 0.046, "MX": 0.046}, "exp": {"CA": 0.03, "MX": 0.03}},
    "7108": {"imp": {"CA": 0.00,  "MX": 0.00},  "exp": {"CA": 0.00, "MX": 0.00}},
    "8708": {"imp": {"CA": 0.200, "MX": 0.200}, "exp": {"CA": 0.17, "MX": 0.15}},
    "8413": {"imp": {"CA": 0.145, "MX": 0.165}, "exp": {"CA": 0.10, "MX": 0.10}},
    "8481": {"imp": {"CA": 0.145, "MX": 0.165}, "exp": {"CA": 0.10, "MX": 0.10}},
    "8432": {"imp": {"CA": 0.145, "MX": 0.165}, "exp": {"CA": 0.12, "MX": 0.10}},
    "8802": {"imp": {"CA": 0.00,  "MX": 0.00},  "exp": {"CA": 0.25, "MX": 0.20}},
    "8411": {"imp": {"CA": 0.145, "MX": 0.165}, "exp": {"CA": 0.15, "MX": 0.15}},
    "8542": {"imp": {"CA": 0.00,  "MX": 0.00},  "exp": {"CA": 0.10, "MX": 0.25}},
    "8471": {"imp": {"CA": 0.00,  "MX": 0.00},  "exp": {"CA": 0.10, "MX": 0.20}},
    "8541": {"imp": {"CA": 0.00,  "MX": 0.00},  "exp": {"CA": 0.10, "MX": 0.25}},
    "8905": {"imp": {"CA": 0.00,  "MX": 0.00},  "exp": {"CA": 0.05, "MX": 0.05}},
    "0302": {"imp": {"CA": 0.195, "MX": 0.165}, "exp": {"CA": 0.05, "MX": 0.04}},
    "0303": {"imp": {"CA": 0.195, "MX": 0.165}, "exp": {"CA": 0.05, "MX": 0.04}},
    "0304": {"imp": {"CA": 0.195, "MX": 0.165}, "exp": {"CA": 0.05, "MX": 0.04}},
    "0406": {"imp": {"CA": 0.195, "MX": 0.165}, "exp": {"CA": 0.06, "MX": 0.04}},
}

# Product-level elasticities (back-calibrated, unchanged)
HS4_ELAST = {
    "0808": -4.9, "2204": -8.0, "1001": -2.0, "1205": -5.5, "0402": -7.4,
    "4407": -0.7, "4418": -1.9, "4703": -3.5, "4801": -0.8, "4403": -3.8,
    "7601": -0.7, "7606": -0.8, "7208": -2.7,
    "8708": -1.4, "8413": -2.0, "8481": -1.4, "8432": -1.1,
}

# ==========================================================================
# MONTHLY TARIFF TIMELINE (for forecast engine)
# Effective import tariff rates by month, reflecting actual policy timeline
# ==========================================================================

MONTHLY_TAU_IMP = {
    "CA": {
        "2025-01": {"agriculture":0.00,"energy":0.00,"forestry":0.00,"minerals":0.00,"manufacturing":0.00,"other":0.00},
        "2025-02": {"agriculture":0.22,"energy":0.09,"forestry":0.22,"minerals":0.22,"manufacturing":0.22,"other":0.22},
        "2025-03": {"agriculture":0.03,"energy":0.02,"forestry":0.05,"minerals":0.25,"manufacturing":0.03,"other":0.03},
        "2025-04": {"agriculture":0.05,"energy":0.02,"forestry":0.10,"minerals":0.30,"manufacturing":0.05,"other":0.05},
        "2025-05": {"agriculture":0.05,"energy":0.02,"forestry":0.10,"minerals":0.30,"manufacturing":0.15,"other":0.05},
        "2025-06": {"agriculture":0.08,"energy":0.02,"forestry":0.15,"minerals":0.50,"manufacturing":0.18,"other":0.10},
        "2025-07": {"agriculture":0.08,"energy":0.02,"forestry":0.15,"minerals":0.50,"manufacturing":0.18,"other":0.10},
        "2025-08": {"agriculture":0.15,"energy":0.02,"forestry":0.25,"minerals":0.50,"manufacturing":0.20,"other":0.18},
        "2025-09": {"agriculture":0.15,"energy":0.02,"forestry":0.25,"minerals":0.50,"manufacturing":0.20,"other":0.18},
        "2025-10": {"agriculture":0.15,"energy":0.02,"forestry":0.30,"minerals":0.50,"manufacturing":0.20,"other":0.20},
        "2025-11": {"agriculture":0.15,"energy":0.02,"forestry":0.30,"minerals":0.50,"manufacturing":0.20,"other":0.20},
        "2025-12": {"agriculture":0.15,"energy":0.02,"forestry":0.30,"minerals":0.50,"manufacturing":0.20,"other":0.20},
    },
    "MX": {
        "2025-01": {"agriculture":0.00,"energy":0.00,"forestry":0.00,"minerals":0.00,"manufacturing":0.00,"other":0.00},
        "2025-02": {"agriculture":0.22,"energy":0.10,"forestry":0.22,"minerals":0.22,"manufacturing":0.22,"other":0.22},
        "2025-03": {"agriculture":0.03,"energy":0.10,"forestry":0.03,"minerals":0.25,"manufacturing":0.03,"other":0.03},
        "2025-04": {"agriculture":0.08,"energy":0.10,"forestry":0.08,"minerals":0.34,"manufacturing":0.08,"other":0.08},
        "2025-05": {"agriculture":0.08,"energy":0.10,"forestry":0.08,"minerals":0.34,"manufacturing":0.15,"other":0.08},
        "2025-06": {"agriculture":0.10,"energy":0.10,"forestry":0.12,"minerals":0.34,"manufacturing":0.17,"other":0.12},
        "2025-07": {"agriculture":0.10,"energy":0.10,"forestry":0.12,"minerals":0.34,"manufacturing":0.17,"other":0.12},
        "2025-08": {"agriculture":0.12,"energy":0.10,"forestry":0.17,"minerals":0.34,"manufacturing":0.17,"other":0.17},
        "2025-09": {"agriculture":0.12,"energy":0.10,"forestry":0.17,"minerals":0.34,"manufacturing":0.17,"other":0.17},
        "2025-10": {"agriculture":0.12,"energy":0.10,"forestry":0.17,"minerals":0.34,"manufacturing":0.17,"other":0.17},
        "2025-11": {"agriculture":0.12,"energy":0.10,"forestry":0.17,"minerals":0.34,"manufacturing":0.17,"other":0.17},
        "2025-12": {"agriculture":0.12,"energy":0.10,"forestry":0.17,"minerals":0.34,"manufacturing":0.17,"other":0.17},
    },
}

MONTHLY_TAU_EXP = {
    "CA": {
        "2025-01": {"agriculture":0.00,"energy":0.00,"forestry":0.00,"minerals":0.00,"manufacturing":0.00,"other":0.00},
        "2025-02": {"agriculture":0.03,"energy":0.02,"forestry":0.05,"minerals":0.03,"manufacturing":0.08,"other":0.05},
        "2025-03": {"agriculture":0.03,"energy":0.02,"forestry":0.08,"minerals":0.03,"manufacturing":0.10,"other":0.06},
        "2025-04": {"agriculture":0.03,"energy":0.02,"forestry":0.10,"minerals":0.04,"manufacturing":0.12,"other":0.08},
        "2025-05": {"agriculture":0.03,"energy":0.02,"forestry":0.10,"minerals":0.04,"manufacturing":0.15,"other":0.08},
        "2025-06": {"agriculture":0.03,"energy":0.02,"forestry":0.14,"minerals":0.06,"manufacturing":0.17,"other":0.10},
        "2025-07": {"agriculture":0.03,"energy":0.02,"forestry":0.14,"minerals":0.06,"manufacturing":0.17,"other":0.10},
        "2025-08": {"agriculture":0.03,"energy":0.02,"forestry":0.14,"minerals":0.06,"manufacturing":0.17,"other":0.12},
        "2025-09": {"agriculture":0.03,"energy":0.02,"forestry":0.14,"minerals":0.06,"manufacturing":0.17,"other":0.12},
        "2025-10": {"agriculture":0.03,"energy":0.02,"forestry":0.14,"minerals":0.06,"manufacturing":0.17,"other":0.12},
        "2025-11": {"agriculture":0.03,"energy":0.02,"forestry":0.14,"minerals":0.06,"manufacturing":0.17,"other":0.12},
        "2025-12": {"agriculture":0.03,"energy":0.02,"forestry":0.14,"minerals":0.06,"manufacturing":0.17,"other":0.12},
    },
    "MX": {
        "2025-01": {"agriculture":0.00,"energy":0.00,"forestry":0.00,"minerals":0.00,"manufacturing":0.00,"other":0.00},
        "2025-02": {"agriculture":0.02,"energy":0.02,"forestry":0.03,"minerals":0.02,"manufacturing":0.06,"other":0.04},
        "2025-03": {"agriculture":0.02,"energy":0.02,"forestry":0.05,"minerals":0.03,"manufacturing":0.08,"other":0.05},
        "2025-04": {"agriculture":0.03,"energy":0.03,"forestry":0.06,"minerals":0.04,"manufacturing":0.10,"other":0.06},
        "2025-05": {"agriculture":0.03,"energy":0.03,"forestry":0.06,"minerals":0.04,"manufacturing":0.13,"other":0.08},
        "2025-06": {"agriculture":0.04,"energy":0.03,"forestry":0.08,"minerals":0.05,"manufacturing":0.15,"other":0.10},
        "2025-07": {"agriculture":0.04,"energy":0.03,"forestry":0.08,"minerals":0.05,"manufacturing":0.15,"other":0.10},
        "2025-08": {"agriculture":0.04,"energy":0.03,"forestry":0.08,"minerals":0.05,"manufacturing":0.15,"other":0.11},
        "2025-09": {"agriculture":0.04,"energy":0.03,"forestry":0.08,"minerals":0.05,"manufacturing":0.15,"other":0.11},
        "2025-10": {"agriculture":0.04,"energy":0.03,"forestry":0.08,"minerals":0.05,"manufacturing":0.15,"other":0.11},
        "2025-11": {"agriculture":0.04,"energy":0.03,"forestry":0.08,"minerals":0.05,"manufacturing":0.15,"other":0.11},
        "2025-12": {"agriculture":0.04,"energy":0.03,"forestry":0.08,"minerals":0.05,"manufacturing":0.15,"other":0.11},
    },
}

def get_monthly_tau(partner, month_key, industry, flow="imports"):
    """Get the effective tariff rate for a specific month."""
    timeline = MONTHLY_TAU_IMP if flow == "imports" else MONTHLY_TAU_EXP
    # If month not in timeline, use H2 steady-state (last known rates)
    rates = timeline.get(partner, {}).get(month_key)
    if rates:
        return rates.get(industry, 0.10)
    # Fallback to H2 rates for months beyond timeline
    return H2_TAU_IMP.get(partner, {}).get(industry, 0.10) if flow == "imports" \
        else H2_TAU_EXP.get(partner, {}).get(industry, 0.05)

# H2 2025 steady-state tariff rates (used for forward projection baseline)
H2_TAU_IMP = {
    "CA": {"agriculture": 0.15, "energy": 0.02, "forestry": 0.30,
           "minerals": 0.50, "manufacturing": 0.20, "other": 0.20},
    "MX": {"agriculture": 0.12, "energy": 0.10, "forestry": 0.17,
           "minerals": 0.34, "manufacturing": 0.17, "other": 0.17},
}
H2_TAU_EXP = {
    "CA": {"agriculture": 0.03, "energy": 0.02, "forestry": 0.14,
           "minerals": 0.06, "manufacturing": 0.17, "other": 0.12},
    "MX": {"agriculture": 0.04, "energy": 0.03, "forestry": 0.08,
           "minerals": 0.05, "manufacturing": 0.15, "other": 0.11},
}

# ========== DATA LOADING ==========

def load_data(path=None):
    p = path or DATA_PATH
    with open(p, 'r', encoding='utf-8') as f:
        return json.load(f)

def load_ca_data(path=None):
    p = path or CA_DATA_PATH
    with open(p, 'rb') as f:
        raw = f.read()
    return json.loads(raw.decode('latin-1'))

def get_val(state_trade, state, partner, year, flow, industry=None):
    sd = state_trade.get(state, {}).get(partner, {}).get(year, {})
    if industry:
        return sd.get("by_industry", {}).get(industry, {}).get(flow, 0)
    return sd.get("total", {}).get(flow, 0)

def get_ca_val(province_trade, province, year, flow, industry=None):
    yd = province_trade.get(province, {}).get(year, {})
    if industry:
        return yd.get("by_industry", {}).get(industry, {}).get(flow, 0)
    return yd.get("total", {}).get(flow, 0)

def get_product_val(product_trade, state, partner, year, hs4, flow):
    return product_trade.get(state, {}).get(partner, {}).get(year, {}).get(hs4, {}).get(flow, 0)

def get_monthly_val(monthly_trade, state, partner, month, flow, industry=None):
    """Get monthly value. month format: '2024-01'. flow: 'imports'/'exports'."""
    fd = monthly_trade.get(state, {}).get(partner, {}).get(month, {}).get(flow, {})
    if industry:
        return fd.get(industry, 0)
    return fd.get("total", 0)

def get_q4_baseline(monthly_trade, state, partner, industry=None):
    """Average of Oct-Dec 2025 as monthly run rate baseline."""
    result = {"imports": 0, "exports": 0}
    for month in ["2025-10", "2025-11", "2025-12"]:
        for flow in ["imports", "exports"]:
            result[flow] += get_monthly_val(monthly_trade, state, partner, month, flow, industry)
    return {k: v / 3 for k, v in result.items()}

# ========== FORECAST COMPUTATION ==========

def forecast_change(base, partner, industry, flow, scenario_cfg, tau_mult=1.0):
    if flow == "imports":
        tau = H2_TAU_IMP.get(partner, {}).get(industry, 0.10) * tau_mult
        e = scenario_cfg.get("imp_elast", {}).get(industry, -0.5)
    else:
        tau = H2_TAU_EXP.get(partner, {}).get(industry, 0.10) * tau_mult
        e = scenario_cfg.get("exp_elast", {}).get(industry, -0.5)
    return base * e * tau

def forecast_rollback(base, partner, industry, flow, scenario_cfg, hysteresis=0.20):
    if flow == "imports":
        tau_old = H2_TAU_IMP.get(partner, {}).get(industry, 0.10)
        e = scenario_cfg.get("imp_elast", {}).get(industry, -0.5)
    else:
        tau_old = H2_TAU_EXP.get(partner, {}).get(industry, 0.10)
        e = scenario_cfg.get("exp_elast", {}).get(industry, -0.5)
    denominator = 1 + e * tau_old
    if abs(denominator) < 0.01:
        return 0
    original = base / denominator
    recovered = original * (1 - hysteresis)
    return recovered - base

# ========== ANNUAL COMPUTATION ==========
# All functions accept optional `cfg` dict.
# If cfg is None, fall back to hardcoded parameters.

def industry_import_change(base, partner, industry, cfg=None):
    if cfg:
        tau = cfg["import_tau"].get(partner, {}).get(industry, 0.05)
        e = cfg["imp_elast"].get(industry, -1.0)
        agg = cfg.get("agg_scale", {}).get(industry, 1.0)
    else:
        tau = PNWER_IMPORT_TAU.get(partner, {}).get(industry, 0.05)
        e = IMP_ELAST.get(industry, -1.0)
        agg = AGG_SCALE.get(industry, 1.0)  # Now always 1.0
    return base * e * agg * tau

def industry_export_change(base, partner, industry, cfg=None):
    if cfg:
        tau = cfg["export_tau"].get(partner, {}).get(industry, 0.10)
        e = cfg["exp_elast"].get(industry, -1.0)
    else:
        tau = RETALIATORY_TAU.get(partner, {}).get(industry, 0.10)
        e = EXP_ELAST.get(industry, -1.0)
    return base * e * tau

def product_import_change(base, partner, hs4, industry, cfg=None):
    tau = HS4_TARIFFS.get(hs4, {}).get("imp", {}).get(partner, 0.25)
    if cfg:
        e = cfg["imp_elast"].get(industry, -1.0)
    else:
        e = HS4_ELAST.get(hs4, IMP_ELAST.get(industry, -1.0))
    return base * e * tau

def product_export_change(base, partner, hs4, industry, cfg=None):
    tau = HS4_TARIFFS.get(hs4, {}).get("exp", {}).get(partner, 0.10)
    if cfg:
        e = cfg["exp_elast"].get(industry, -1.0)
    else:
        e = HS4_ELAST.get(hs4, EXP_ELAST.get(industry, -1.0))
    return base * e * tau

def oil_adjustment(base, hs4):
    if hs4 in ENERGY_HS4:
        return base * WTI_CHG
    return 0

def oil_adjustment_industry(base, industry):
    if industry == "energy":
        return base * WTI_CHG
    return 0

def gdp_impact(trade_loss, industry, is_export=False, cfg=None):
    if cfg:
        m = cfg["exp_mult"].get(industry, 1.5) if is_export else cfg["io_mult"].get(industry, 1.4)
    else:
        m = EXP_MULT.get(industry, 1.8) if is_export else IO_MULT.get(industry, 1.7)
    return abs(trade_loss) * m if trade_loss < 0 else 0

def jobs_impact(gdp_loss, industry, is_export=False, cfg=None):
    if cfg:
        j = cfg["exp_jobs"].get(industry, 5.0) if is_export else cfg["jobs_per_m"].get(industry, 4.5)
    else:
        j = EXP_JOBS.get(industry, 5.5) if is_export else JOBS_PER_M.get(industry, 5.0)
    return (gdp_loss / 1e6) * j