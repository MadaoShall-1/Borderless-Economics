"""
PNWER Refresh Pipeline — Latest-Month Data Refresh
----------------------------------------------------
Fetches the latest available month of trade data from the Census Bureau
and appends/updates it in pnwer_analysis_data_v9.json.

Uses monthly_collector.py (standalone) — does NOT depend on
census_data_collector.py, so it can run independently of the
full historical collection pipeline.

Data refreshed per call:
  A. State industry-level  (25 states × CA/MX)
  B. State product-level   (PNWER 5 states × CA/MX, HS4)
  C. National-level        (7 countries)

All historical data is preserved. Monthly snapshots are stored under
  data["monthly_trade"][state][partner]["YYYY-MM"]
so each refresh adds one new month key (or overwrites if re-run).

Usage:
    python refresh_pipeline.py
    python refresh_pipeline.py --data-path ../data/pnwer_analysis_data_v9.json

Or as a library:
    from refresh_pipeline import refresh_latest_month
    result = refresh_latest_month()
"""

import json
import os
import sys
import datetime
import argparse
from pathlib import Path

# Import from the Data Collector folder (sibling directory)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Data Collector"))
from monthly_collector import (
    detect_latest_month,
    fetch_monthly_industry,
    fetch_monthly_hs4,
    fetch_monthly_national,
    ALL_STATES,
    PNWER_STATES,
    COUNTRIES,
)

import time

# ============================================================================
# Configuration
# ============================================================================

DEFAULT_DATA_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "Data", "pnwer_analysis_data_v9.json"
)


# ============================================================================
# Core Refresh Logic
# ============================================================================

def refresh_latest_month(
    data_path: str = DEFAULT_DATA_PATH,
    on_progress=None,
) -> dict:
    """
    Detect the latest Census month with data, fetch it, and merge into
    the existing v9 JSON. All historical / previously-refreshed data is
    preserved exactly as-is.

    Args:
        data_path:    Path to the main JSON data file.
        on_progress:  Optional callback(step: str, current: int, total: int)

    Returns:
        {
          "status":          "success" | "partial" | "error",
          "timestamp":       ISO datetime string,
          "month_refreshed": "YYYY-MM",
          "records_updated": int,
          "errors":          [str, ...]
        }
    """
    started_at = datetime.datetime.now()
    errors = []
    records_updated = 0

    # ------------------------------------------------------------------
    # 0. Detect latest available Census month
    # ------------------------------------------------------------------
    print("\n  Detecting latest Census month...")
    year, month = detect_latest_month()
    month_key = f"{year}-{month:02d}"
    print(f"  Target: {month_key}\n")

    # ------------------------------------------------------------------
    # 1. Load existing data — NEVER discard historical records
    # ------------------------------------------------------------------
    try:
        with open(data_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return {
            "status": "error",
            "timestamp": started_at.isoformat(),
            "month_refreshed": month_key,
            "records_updated": 0,
            "errors": [f"Data file not found: {data_path}. Run full collection first."],
        }
    except json.JSONDecodeError as e:
        return {
            "status": "error",
            "timestamp": started_at.isoformat(),
            "month_refreshed": month_key,
            "records_updated": 0,
            "errors": [f"JSON parse error: {str(e)}"],
        }

    # Ensure monthly_trade top-level key exists
    if "monthly_trade" not in data:
        data["monthly_trade"] = {}

    # Unified progress counter across all 3 parts
    total_requests = len(ALL_STATES) * 2 + len(PNWER_STATES) * 2 + len(COUNTRIES)
    global_current = 0

    # ------------------------------------------------------------------
    # 2. Part A — Monthly industry-level: 25 states × CA + MX
    # ------------------------------------------------------------------
    for state in ALL_STATES:
        for cty_code, partner in [("1220", "CA"), ("2010", "MX")]:
            global_current += 1
            step_label = f"Industry: {state} ↔ {partner} ({month_key})"
            if on_progress:
                on_progress(step_label, global_current, total_requests)

            try:
                exports = fetch_monthly_industry(state, cty_code, year, month, is_export=True)
                imports = fetch_monthly_industry(state, cty_code, year, month, is_export=False)

                if exports is None and imports is None:
                    errors.append(f"No data: {state}/{partner} industry — skipped")
                    continue

                exp_total = exports["total"] if exports else 0
                imp_total = imports["total"] if imports else 0
                exp_ind   = exports["by_industry"] if exports else {}
                imp_ind   = imports["by_industry"] if imports else {}

                all_industries = set(exp_ind.keys()) | set(imp_ind.keys())
                by_industry = {}
                for ind in all_industries:
                    by_industry[ind] = {
                        "exports": exp_ind.get(ind, 0),
                        "imports": imp_ind.get(ind, 0),
                    }

                # Store under monthly_trade → state → partner → YYYY-MM
                data["monthly_trade"].setdefault(state, {})
                data["monthly_trade"][state].setdefault(partner, {})
                data["monthly_trade"][state][partner][month_key] = {
                    "exports": {"total": exp_total, **{k: v["exports"] for k, v in by_industry.items()}},
                    "imports": {"total": imp_total, **{k: v["imports"] for k, v in by_industry.items()}},
                }
                records_updated += 1

            except Exception as e:
                errors.append(f"Industry {state}/{partner}: {str(e)}")

            time.sleep(0.1)

    # ------------------------------------------------------------------
    # 3. Part B — Monthly product-level HS4: PNWER 5 states × CA + MX
    # ------------------------------------------------------------------
    # Store under monthly_products → state → partner → YYYY-MM
    if "monthly_products" not in data:
        data["monthly_products"] = {}

    for state in PNWER_STATES:
        for cty_code, partner in [("1220", "CA"), ("2010", "MX")]:
            global_current += 1
            step_label = f"Products: {state} ↔ {partner} ({month_key})"
            if on_progress:
                on_progress(step_label, global_current, total_requests)

            try:
                exp_hs4 = fetch_monthly_hs4(state, cty_code, year, month, is_export=True)
                imp_hs4 = fetch_monthly_hs4(state, cty_code, year, month, is_export=False)

                all_hs4 = set(exp_hs4.keys()) | set(imp_hs4.keys())
                yr_data = {
                    hs4: {
                        "exports": exp_hs4.get(hs4, 0),
                        "imports": imp_hs4.get(hs4, 0),
                    }
                    for hs4 in all_hs4
                }

                data["monthly_products"].setdefault(state, {})
                data["monthly_products"][state].setdefault(partner, {})
                data["monthly_products"][state][partner][month_key] = yr_data
                records_updated += 1

            except Exception as e:
                errors.append(f"HS4 {state}/{partner}: {str(e)}")

            time.sleep(0.1)

    # ------------------------------------------------------------------
    # 4. Part C — Monthly national-level: all tracked countries
    # ------------------------------------------------------------------
    if "monthly_national" not in data:
        data["monthly_national"] = {}

    for cty_code, cty_info in COUNTRIES.items():
        code = cty_info["code"]
        global_current += 1
        step_label = f"National: US ↔ {code} ({month_key})"
        if on_progress:
            on_progress(step_label, global_current, total_requests)

        try:
            exp = fetch_monthly_national(cty_code, year, month, is_export=True)
            imp = fetch_monthly_national(cty_code, year, month, is_export=False)

            if exp is None and imp is None:
                errors.append(f"No data: national/{code} — skipped")
                continue

            exp_total = exp["total"] if exp else 0
            imp_total = imp["total"] if imp else 0
            exp_ind   = exp["by_industry"] if exp else {}
            imp_ind   = imp["by_industry"] if imp else {}

            data["monthly_national"].setdefault(code, {
                "name": cty_info["name"],
                "group": cty_info["group"],
                "months": {},
            })
            data["monthly_national"][code]["months"][month_key] = {
                "exports": exp_total,
                "imports": imp_total,
                "exports_by_industry": exp_ind,
                "imports_by_industry": imp_ind,
                "total_trade": exp_total + imp_total,
                "balance": exp_total - imp_total,
            }
            records_updated += 1

        except Exception as e:
            errors.append(f"National {code}: {str(e)}")

        time.sleep(0.15)

    # ------------------------------------------------------------------
    # 5. Update metadata
    # ------------------------------------------------------------------
    completed_at = datetime.datetime.now()
    data["metadata"]["last_refreshed"] = completed_at.isoformat()
    data["metadata"]["refresh_month"] = month_key
    data["metadata"]["refresh_duration_seconds"] = (
        completed_at - started_at
    ).total_seconds()

    # Track all months that have been refreshed
    refreshed_months = data["metadata"].get("refreshed_months", [])
    if month_key not in refreshed_months:
        refreshed_months.append(month_key)
        refreshed_months.sort()
    data["metadata"]["refreshed_months"] = refreshed_months

    # ------------------------------------------------------------------
    # 6. Atomic write
    # ------------------------------------------------------------------
    tmp_path = data_path + ".tmp"
    try:
        Path(data_path).parent.mkdir(parents=True, exist_ok=True)
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, data_path)
    except Exception as e:
        errors.append(f"File write failed: {str(e)}")
        return {
            "status": "error",
            "timestamp": completed_at.isoformat(),
            "month_refreshed": month_key,
            "records_updated": records_updated,
            "errors": errors,
        }

    status = "success" if not errors else "partial"
    return {
        "status": status,
        "timestamp": completed_at.isoformat(),
        "month_refreshed": month_key,
        "records_updated": records_updated,
        "errors": errors,
    }


# ============================================================================
# Standalone run
# ============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PNWER Monthly Data Refresh")
    parser.add_argument(
        "--data-path",
        default=DEFAULT_DATA_PATH,
        help="Path to pnwer_analysis_data_v9.json",
    )
    args = parser.parse_args()

    def print_progress(step, current, total):
        bar_len = 30
        filled = int(bar_len * current / total)
        bar = "█" * filled + "░" * (bar_len - filled)
        print(f"\r  [{bar}] {current}/{total}  {step:<55}", end="", flush=True)

    print("\n╔═══════════════════════════════════════════════════════════╗")
    print("║   PNWER Refresh Pipeline — Latest Month Data              ║")
    print("╚═══════════════════════════════════════════════════════════╝")

    result = refresh_latest_month(
        data_path=args.data_path,
        on_progress=print_progress,
    )

    # Each progress unit involves 2 API calls (export + import)
    total_units = len(ALL_STATES) * 2 + len(PNWER_STATES) * 2 + len(COUNTRIES)
    total_requests = total_units * 2  # actual HTTP requests
    print(f"\n\n{'='*60}")
    print(f"  Status:           {result['status'].upper()}")
    print(f"  Completed:        {result['timestamp']}")
    print(f"  Month refreshed:  {result['month_refreshed']}")
    print(f"  Records updated:  {result['records_updated']}")
    print(f"  API requests:     ~{total_requests}")
    if result["errors"]:
        print(f"  Errors ({len(result['errors'])}):")
        for err in result["errors"][:10]:
            print(f"    ⚠  {err}")
        if len(result["errors"]) > 10:
            print(f"    ... and {len(result['errors']) - 10} more")
    print(f"{'='*60}\n")