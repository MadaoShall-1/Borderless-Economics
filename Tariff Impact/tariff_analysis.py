"""
PNWER Bilateral Tariff Impact Model — Core
Shared parameters, computation logic, and data loading.
Import this from run_industry.py and run_product.py.
"""

import json
import os
from pathlib import Path

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join("data/pnwer_analysis_data_v9.json")

PNWER_STATES = ["WA", "OR", "ID", "MT", "AK"]
STATE_NAMES = {"WA": "Washington", "OR": "Oregon", "ID": "Idaho", "MT": "Montana", "AK": "Alaska"}
INDUSTRIES = ["agriculture", "energy", "forestry", "minerals", "manufacturing", "other"]

WTI_2024 = 77.13
WTI_2025 = 65.00
WTI_CHG = (WTI_2025 - WTI_2024) / WTI_2024
ENERGY_HS4 = {"2709", "2710", "2711", "2701"}

# ========== INDUSTRY-LEVEL PARAMETERS ==========

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
IMP_ELAST = {"agriculture": -1.5, "energy": -0.5, "forestry": -1.2,
             "minerals": -0.8, "manufacturing": -2.0, "other": -1.5}
EXP_ELAST = {"agriculture": -1.2, "energy": -0.3, "forestry": -1.0,
             "minerals": -0.6, "manufacturing": -1.5, "other": -1.2}
AGG_SCALE = {"agriculture": 0.85, "energy": 0.80, "forestry": 0.90,
             "minerals": 0.85, "manufacturing": 0.22, "other": 0.40}
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
# Sources: CBP IEEPA FAQ, CRS IN12519, EO 14289, Proclamation 10896

HS4_TARIFFS = {
    # Agriculture — IEEPA, USMCA compliance varies
    "0808": {"imp": {"CA": 0.033, "MX": 0.062}, "exp": {"CA": 0.00, "MX": 0.04}},   # Apples: ~95% USMCA CA
    "0402": {"imp": {"CA": 0.195, "MX": 0.165}, "exp": {"CA": 0.06, "MX": 0.04}},   # Dairy: ~30% USMCA (TRQ)
    "1001": {"imp": {"CA": 0.095, "MX": 0.124}, "exp": {"CA": 0.06, "MX": 0.04}},   # Wheat: ~70% USMCA
    "1205": {"imp": {"CA": 0.046, "MX": 0.124}, "exp": {"CA": 0.03, "MX": 0.04}},   # Canola: ~90% USMCA
    "2204": {"imp": {"CA": 0.245, "MX": 0.206}, "exp": {"CA": 0.10, "MX": 0.10}},   # Wine: ~10% USMCA
    "0201": {"imp": {"CA": 0.033, "MX": 0.124}, "exp": {"CA": 0.06, "MX": 0.04}},   # Beef: ~95% USMCA
    # Energy — pipeline USMCA or IEEPA
    "2709": {"imp": {"CA": 0.00,  "MX": 0.10},  "exp": {"CA": 0.00, "MX": 0.03}},   # Crude: pipeline 100% USMCA
    "2710": {"imp": {"CA": 0.145, "MX": 0.124}, "exp": {"CA": 0.08, "MX": 0.05}},   # Refined: ~50% USMCA
    "2711": {"imp": {"CA": 0.00,  "MX": 0.10},  "exp": {"CA": 0.00, "MX": 0.03}},   # Gas: pipeline 100% USMCA
    "2701": {"imp": {"CA": 0.220, "MX": 0.186}, "exp": {"CA": 0.05, "MX": 0.05}},   # Coal: ~20% USMCA
    # Forestry — IEEPA/S232 timber + CVD
    "4407": {"imp": {"CA": 0.307, "MX": 0.25},  "exp": {"CA": 0.14, "MX": 0.08}},   # Lumber: S232 timber Oct + CVD 14.5%, ~30% USMCA
    "4418": {"imp": {"CA": 0.195, "MX": 0.165}, "exp": {"CA": 0.12, "MX": 0.08}},   # Builders woodwork: ~30% USMCA
    "4703": {"imp": {"CA": 0.170, "MX": 0.145}, "exp": {"CA": 0.08, "MX": 0.08}},   # Woodpulp: ~40% USMCA
    "4801": {"imp": {"CA": 0.170, "MX": 0.145}, "exp": {"CA": 0.08, "MX": 0.08}},   # Newsprint: ~40% USMCA
    "4403": {"imp": {"CA": 0.220, "MX": 0.186}, "exp": {"CA": 0.10, "MX": 0.08}},   # Logs: ~20% USMCA
    "4411": {"imp": {"CA": 0.195, "MX": 0.165}, "exp": {"CA": 0.12, "MX": 0.08}},   # Fibreboard: ~30% USMCA
    # Minerals — S232 50% (from Jun 4), no IEEPA stacking
    "7601": {"imp": {"CA": 0.344, "MX": 0.344}, "exp": {"CA": 0.25, "MX": 0.15}},   # Aluminum: S232 annualized
    "7606": {"imp": {"CA": 0.344, "MX": 0.344}, "exp": {"CA": 0.25, "MX": 0.15}},   # Al plates: S232
    "7208": {"imp": {"CA": 0.344, "MX": 0.344}, "exp": {"CA": 0.25, "MX": 0.15}},   # Steel: S232
    "7403": {"imp": {"CA": 0.25,  "MX": 0.25},  "exp": {"CA": 0.10, "MX": 0.10}},   # Copper: S232 copper Aug 1
    "2603": {"imp": {"CA": 0.046, "MX": 0.046}, "exp": {"CA": 0.03, "MX": 0.03}},   # Copper ore
    "2602": {"imp": {"CA": 0.046, "MX": 0.046}, "exp": {"CA": 0.03, "MX": 0.03}},   # Manganese ore
    "2616": {"imp": {"CA": 0.046, "MX": 0.046}, "exp": {"CA": 0.03, "MX": 0.03}},   # Precious ore
    "7108": {"imp": {"CA": 0.00,  "MX": 0.00},  "exp": {"CA": 0.00, "MX": 0.00}},   # Gold: duty free
    # Manufacturing — S232 auto or IEEPA
    "8708": {"imp": {"CA": 0.200, "MX": 0.200}, "exp": {"CA": 0.17, "MX": 0.15}},   # Auto parts: S232 auto 25% from May, ~60% USMCA pre-May
    "8413": {"imp": {"CA": 0.145, "MX": 0.165}, "exp": {"CA": 0.10, "MX": 0.10}},   # Pumps: ~50% USMCA CA
    "8481": {"imp": {"CA": 0.145, "MX": 0.165}, "exp": {"CA": 0.10, "MX": 0.10}},   # Valves: ~50% USMCA CA
    "8432": {"imp": {"CA": 0.145, "MX": 0.165}, "exp": {"CA": 0.12, "MX": 0.10}},   # Ag machinery: ~50% USMCA CA
    "8802": {"imp": {"CA": 0.00,  "MX": 0.00},  "exp": {"CA": 0.25, "MX": 0.20}},   # Aircraft: ITA exempt
    "8411": {"imp": {"CA": 0.145, "MX": 0.165}, "exp": {"CA": 0.15, "MX": 0.15}},   # Turbojets
    "8542": {"imp": {"CA": 0.00,  "MX": 0.00},  "exp": {"CA": 0.10, "MX": 0.25}},   # IC: ITA exempt
    "8471": {"imp": {"CA": 0.00,  "MX": 0.00},  "exp": {"CA": 0.10, "MX": 0.20}},   # Computers: ITA exempt
    "8541": {"imp": {"CA": 0.00,  "MX": 0.00},  "exp": {"CA": 0.10, "MX": 0.25}},   # Semiconductors: ITA
    "8905": {"imp": {"CA": 0.00,  "MX": 0.00},  "exp": {"CA": 0.05, "MX": 0.05}},   # Vessels
    # Legacy (kept for backward compatibility)
    "0302": {"imp": {"CA": 0.195, "MX": 0.165}, "exp": {"CA": 0.05, "MX": 0.04}},
    "0303": {"imp": {"CA": 0.195, "MX": 0.165}, "exp": {"CA": 0.05, "MX": 0.04}},
    "0304": {"imp": {"CA": 0.195, "MX": 0.165}, "exp": {"CA": 0.05, "MX": 0.04}},
    "0406": {"imp": {"CA": 0.195, "MX": 0.165}, "exp": {"CA": 0.06, "MX": 0.04}},
}

# ========== PRODUCT-LEVEL ELASTICITIES (back-calibrated) ==========
# Back-calibrated from 2024→2025 actual trade changes using corrected
# annualized tariff rates. Cross-state trade-weighted averages.
# NOTE: These are effective demand response parameters, NOT Armington σ.
# They incorporate USMCA exemption absorption, S232 pre-pricing, and
# supply chain lock-in effects. See parameter_comparison.md for
# comparison with Broda & Weinstein (2006) literature values.

HS4_ELAST = {
    "0808": -4.9,   # Apples: perishable, seasonal, many origin substitutes
    "2204": -8.0,   # Wine: luxury good, extreme substitutability
    "1001": -2.0,   # Wheat: commodity, moderate substitution
    "1205": -5.5,   # Canola: can switch to soy/other oilseeds
    "0402": -7.4,   # Dairy: TRQ-constrained, perishable
    "4407": -0.7,   # Lumber: very inelastic, construction locked, USMCA exemptions
    "4418": -1.9,   # Builders woodwork: moderate
    "4703": -3.5,   # Woodpulp: can switch suppliers globally
    "4801": -0.8,   # Newsprint: declining industry, few alternatives
    "4403": -3.8,   # Logs: can redirect to domestic mills
    "7601": -0.7,   # Aluminum: S232 priced in, long-term smelter contracts
    "7606": -0.8,   # Al plates: slightly more elastic than ingots
    "7208": -2.7,   # Steel: more substitutable than aluminum
    "8708": -1.4,   # Auto parts: S232 auto 25% from May, USMCA chains
    "8413": -2.0,   # Pumps: moderate-high
    "8481": -1.4,   # Valves: moderate
    "8432": -1.1,   # Ag machinery: lower than expected (USMCA absorption)
}

# ========== DATA LOADING ==========

def load_data(path=None):
    p = path or DATA_PATH
    with open(p, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def get_val(state_trade, state, partner, year, flow, industry=None):
    sd = state_trade.get(state, {}).get(partner, {}).get(year, {})
    if industry:
        return sd.get("by_industry", {}).get(industry, {}).get(flow, 0)
    return sd.get("total", {}).get(flow, 0)

def get_product_val(product_trade, state, partner, year, hs4, flow):
    return product_trade.get(state, {}).get(partner, {}).get(year, {}).get(hs4, {}).get(flow, 0)

# ========== COMPUTATION ==========

def industry_import_change(base, partner, industry):
    tau = PNWER_IMPORT_TAU.get(partner, {}).get(industry, 0.05)
    e = IMP_ELAST.get(industry, -1.0)
    agg = AGG_SCALE.get(industry, 0.5)
    return base * e * agg * tau

def industry_export_change(base, partner, industry):
    tau = RETALIATORY_TAU.get(partner, {}).get(industry, 0.10)
    e = EXP_ELAST.get(industry, -1.0)
    return base * e * tau

def product_import_change(base, partner, hs4, industry):
    tau = HS4_TARIFFS.get(hs4, {}).get("imp", {}).get(partner, 0.25)
    e = HS4_ELAST.get(hs4, IMP_ELAST.get(industry, -1.0))
    return base * e * tau

def product_export_change(base, partner, hs4, industry):
    tau = HS4_TARIFFS.get(hs4, {}).get("exp", {}).get(partner, 0.10)
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

def gdp_impact(trade_loss, industry, is_export=False):
    m = EXP_MULT.get(industry, 1.8) if is_export else IO_MULT.get(industry, 1.7)
    return abs(trade_loss) * m if trade_loss < 0 else 0

def jobs_impact(gdp_loss, industry, is_export=False):
    j = EXP_JOBS.get(industry, 5.5) if is_export else JOBS_PER_M.get(industry, 5.0)
    return (gdp_loss / 1e6) * j