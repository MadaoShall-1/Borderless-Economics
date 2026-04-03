"""
PNWER Trade Analysis Data Collector v9
升级: HS4 产品级关税分析 + 原有行业级分析

新增:
1. PNWER 5州拉取 HS4 级别的产品贸易数据 (对 CA/MX)
2. 保留原有 HS2→行业 汇总 (25州全部)
3. 输出包含 product-level 和 industry-level 两层
"""

import requests
import json
import time
from pathlib import Path
import datetime

# ============================================================================
# 配置
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
# HS2 → 产业映射 (保持不变)
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
# 数据采集 — 原有行业级 (HS2 汇总)
# ============================================================================

def fetch_state_trade_industry(state, country_code, year, month, is_export=True):
    """HS2 级别 → 汇总到 6 个行业 (所有 25 州用)"""
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
# 数据采集 — 新增产品级 (HS4 明细, 仅 PNWER 5 州 × CA/MX)
# ============================================================================

def fetch_state_trade_hs4(state, country_code, year, month, is_export=True):
    """HS4 级别产品明细 — 返回每个 HS4 的贸易额"""
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
                        # 取前 4 位作为 HS4
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
# 全美国家级数据
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
# 主采集流程
# ============================================================================

def collect_all():
    print("""
    ╔══════════════════════════════════════════════════════════════╗
    ║       PNWER Trade Data Collector v9                         ║
    ║       行业级 (25州) + 产品级 HS4 (PNWER 5州)                  ║
    ╚══════════════════════════════════════════════════════════════╝
    """)

    # ================================================================
    # Part 1: 行业级数据 (所有 25 州, 和 v8 一样)
    # ================================================================
    print("=" * 60)
    print(f"[Part 1] 行业级数据 ({len(ALL_STATES)} 州 × 2 国 × {len(YEARS)} 年)")
    n_req = len(ALL_STATES) * 2 * len(YEARS) * 2
    print(f"  预计请求: {n_req}, 耗时 ~{n_req * 0.15 / 60:.0f} 分钟")
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

    print(f"\n  Part 1 完成!")

    # ================================================================
    # Part 2: 产品级 HS4 数据 (仅 PNWER 5 州 × CA/MX)
    # ================================================================
    print("\n" + "=" * 60)
    n_hs4 = len(PNWER_STATES) * 2 * len(YEARS) * 2
    print(f"[Part 2] 产品级 HS4 数据 (PNWER 5 州 × 2 国 × {len(YEARS)} 年)")
    print(f"  关注产品: {len(ALL_FOCUS_HS4)} 个 HS4 代码")
    print(f"  预计请求: {n_hs4}, 耗时 ~{n_hs4 * 0.15 / 60:.0f} 分钟")
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

    print(f"\n  Part 2 完成!")

    # ================================================================
    # Part 3: 国家级数据 (含行业拆分)
    # ================================================================
    print("\n" + "=" * 60)
    print(f"[Part 3] 国家级数据 ({len(COUNTRIES)} 国 × {len(YEARS)} 年)")
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

    print(f"\n  Part 3 完成!")

    return state_data, product_data, national_data


# ============================================================================
# 数据采集 — 月度行业级 (PNWER 5 州 × CA/MX, 2024-2025)
# ============================================================================

MONTHLY_YEARS = [2024, 2025]
MONTHLY_MONTHS = list(range(1, 13))  # 1-12

def fetch_state_trade_monthly(state, country_code, year, month, is_export=True):
    """月度 HS2 级别 → 汇总到 6 个行业 (用 ALL_VAL_MO / GEN_VAL_MO)"""
    api_url = STATE_EXPORT_API if is_export else STATE_IMPORT_API
    val_field = "ALL_VAL_MO" if is_export else "GEN_VAL_MO"
    hs_field = "E_COMMODITY" if is_export else "I_COMMODITY"

    params = {
        "get": f"STATE,CTY_CODE,{hs_field},{val_field}",
        "time": f"{year}-{month:02d}",
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
        return None
    except Exception:
        return None


def collect_monthly():
    """Part 4: 月度数据 (PNWER 5 州 × CA/MX × 24 个月)"""
    n_req = len(PNWER_STATES) * 2 * len(MONTHLY_YEARS) * 12 * 2
    print("\n" + "=" * 60)
    print(f"[Part 4] 月度数据 (PNWER 5 州 × 2 国 × 24 个月)")
    print(f"  预计请求: {n_req}, 耗时 ~{n_req * 0.6 / 60:.0f} 分钟")
    print("=" * 60)

    monthly_data = {}
    current = 0
    failed = 0

    for state in PNWER_STATES:
        monthly_data[state] = {}
        for cty_code, partner in [("1220", "CA"), ("2010", "MX")]:
            monthly_data[state][partner] = {}
            for year in MONTHLY_YEARS:
                for month in MONTHLY_MONTHS:
                    month_key = f"{year}-{month:02d}"

                    current += 1
                    print(f"\r  [{current}/{n_req}] {state} → {partner} {month_key} exp", end="", flush=True)
                    exports = fetch_state_trade_monthly(state, cty_code, year, month, is_export=True)

                    current += 1
                    print(f"\r  [{current}/{n_req}] {state} ← {partner} {month_key} imp", end="", flush=True)
                    imports = fetch_state_trade_monthly(state, cty_code, year, month, is_export=False)

                    if exports is None and imports is None:
                        failed += 1
                        continue

                    monthly_data[state][partner][month_key] = {
                        "exports": {
                            "total": exports["total"] if exports else 0,
                            **(exports["by_industry"] if exports else {})
                        },
                        "imports": {
                            "total": imports["total"] if imports else 0,
                            **(imports["by_industry"] if imports else {})
                        }
                    }
                    time.sleep(0.5)

    print(f"\n  Part 4 完成! (failed: {failed})")
    return monthly_data


def build_and_save(state_data, product_data, national_data, monthly_data=None):
    output = {
        "metadata": {
            "version": "9.1",
            "description": "PNWER Trade Analysis — Industry + Product + Monthly",
            "source": "U.S. Census Bureau API (statehs endpoint)",
            "generated_at": datetime.datetime.now().isoformat(),
            "years": YEARS,
            "notes": [
                "25 州行业级: 5 PNWER + 20 对照 (HS2 → 6 行业)",
                "5 州产品级: PNWER only × CA/MX (HS4 重点产品)",
                "5 州月度级: PNWER × CA/MX × 2024-2025 (HS2 → 6 行业, 月度)",
                "国家级含行业拆分 (用于 Layer 1 DID)",
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

    if monthly_data:
        output["monthly_trade"] = monthly_data

    path = "data/pnwer_analysis_data_v9.json"
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\n  保存: {path}")

    # 也保存 v8 兼容版本 (不含 product_trade, 保持后向兼容)
    v8_compat = {k: v for k, v in output.items() if k != "product_trade"}
    v8_path = "data/pnwer_analysis_data_v8.json"
    with open(v8_path, 'w', encoding='utf-8') as f:
        json.dump(v8_compat, f, indent=2, ensure_ascii=False)
    print(f"  保存 v8 兼容: {v8_path}")

    return output


def print_product_summary(product_data):
    print("\n" + "=" * 75)
    print("产品级数据摘要 (per-state, CA bilateral, 2024 vs 2025)")
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
    monthly_data = collect_monthly()
    output = build_and_save(state_data, product_data, national_data, monthly_data)
    print_product_summary(product_data)

    # Save monthly as standalone file (for dashboard/trend analysis)
    monthly_path = "data/us_monthly_trade.json"
    Path(monthly_path).parent.mkdir(parents=True, exist_ok=True)
    with open(monthly_path, 'w', encoding='utf-8') as f:
        json.dump({
            "metadata": {
                "source": "U.S. Census Bureau API (statehs, monthly)",
                "generated_at": datetime.datetime.now().isoformat(),
                "states": PNWER_STATES,
                "partners": ["CA", "MX"],
                "months": [f"{y}-{m:02d}" for y in MONTHLY_YEARS for m in range(1,13)],
            },
            "monthly_trade": monthly_data
        }, f, indent=2, ensure_ascii=False)
    print(f"  月度独立文件: {monthly_path}")

    total_req = len(ALL_STATES)*2*len(YEARS)*2 + len(PNWER_STATES)*2*len(YEARS)*2 + len(COUNTRIES)*len(YEARS)*2
    monthly_req = len(PNWER_STATES) * 2 * len(MONTHLY_YEARS) * 12 * 2
    print(f"\n{'='*60}")
    print(f"  v9.1 采集完成!")
    print(f"  年度请求数: {total_req}")
    print(f"  月度请求数: {monthly_req}")
    print(f"  行业级: {len(ALL_STATES)} 州 × 2 国 × {len(YEARS)} 年")
    print(f"  产品级: {len(PNWER_STATES)} 州 × 2 国 × {len(YEARS)} 年 × {len(ALL_FOCUS_HS4)} HS4")
    print(f"  月度级: {len(PNWER_STATES)} 州 × 2 国 × {len(MONTHLY_YEARS)*12} 个月")
    print(f"  国家级: {len(COUNTRIES)} 国 × {len(YEARS)} 年")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()