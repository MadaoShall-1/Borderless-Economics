"""
PNWER Refresh Pipeline — 2025 Current-Year Data Refresh
--------------------------------------------------------
Refreshes ONLY the 2025 data slice in pnwer_analysis_data_v9.json.
Preserves all historical data (2017–2024) unchanged.

Usage:
    from refresh_pipeline import refresh_current_year
    result = refresh_current_year()

Or run standalone:
    python refresh_pipeline.py
"""

import json
import time
import datetime
import sys
import os
from pathlib import Path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'Data Collector'))

# Import all fetch functions and config from the existing collector
from census_data_collector import (
    fetch_state_trade_industry,
    fetch_state_trade_hs4,
    fetch_national_trade,
    ALL_STATES,
    PNWER_STATES,
    COUNTRIES,
    STATE_FOCUS_HS4,
    ALL_FOCUS_HS4,
)

# ============================================================================
# Configuration
# ============================================================================

DATA_PATH = os.path.join("../data/pnwer_analysis_data_v9.json")
REFRESH_YEAR = datetime.datetime.now().year  # automatically 2026, 2027, etc.

# Dynamically resolve the latest available Census Bureau month.
# Census data has a ~5-6 week lag, so we target 2 months back to ensure
# the data has been published. This is safer than targeting current month.
def get_latest_census_month() -> str:
    today = datetime.datetime.now()
    # Go back 2 months to account for Census publication lag
    target = today.replace(day=1) - datetime.timedelta(days=1)   # last month
    target = target.replace(day=1) - datetime.timedelta(days=1)  # 2 months back
    return target.strftime("%m")  # zero-padded month string, e.g. "01"


# ============================================================================
# Core Refresh Logic
# ============================================================================

def refresh_current_year(
    data_path: str = DATA_PATH,
    on_progress=None,
) -> dict:
    """
    Re-fetches 2025 data from the Census Bureau API and merges it into
    the existing pnwer_analysis_data_v9.json. All 2017–2024 data is
    preserved exactly as-is.

    Args:
        data_path:    Path to the JSON data file.
        on_progress:  Optional callback(step: str, current: int, total: int)
                      called during collection — used to stream progress
                      to the frontend via SSE or WebSocket.

    Returns:
        {
          "status":          "success" | "partial" | "error",
          "timestamp":       ISO datetime string,
          "month_refreshed": "MM",
          "records_updated": int,
          "errors":          [str, ...]
        }
    """
    started_at = datetime.datetime.now()
    errors = []
    records_updated = 0
    month = get_latest_census_month()

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
            "month_refreshed": month,
            "records_updated": 0,
            "errors": [f"Data file not found: {data_path}. Run full collection first."],
        }
    except json.JSONDecodeError as e:
        return {
            "status": "error",
            "timestamp": started_at.isoformat(),
            "month_refreshed": month,
            "records_updated": 0,
            "errors": [f"JSON parse error: {str(e)}"],
        }

    # ------------------------------------------------------------------
    # 2. Part A — Industry-level: all 25 states × CA + MX
    # ------------------------------------------------------------------
    total_state_requests = len(ALL_STATES) * 2  # 2 partners per state
    current = 0

    for state in ALL_STATES:
        for cty_code, partner in [("1220", "CA"), ("2010", "MX")]:
            current += 1
            step_label = f"State trade: {state} ↔ {partner} ({REFRESH_YEAR})"

            if on_progress:
                on_progress(step_label, current, total_state_requests)

            try:
                exports = fetch_state_trade_industry(
                    state, cty_code, REFRESH_YEAR, month, is_export=True
                )
                imports = fetch_state_trade_industry(
                    state, cty_code, REFRESH_YEAR, month, is_export=False
                )

                # Validate — skip update if both sides returned zero
                # (likely a Census API timeout or empty response)
                if exports["total"] == 0 and imports["total"] == 0:
                    errors.append(
                        f"Zero data returned for {state}/{partner} — skipping update"
                    )
                    continue

                # Build industry breakdown
                all_industries = set(exports["by_industry"].keys()) | set(
                    imports["by_industry"].keys()
                )
                by_industry = {}
                for ind in all_industries:
                    exp_val = exports["by_industry"].get(ind, 0)
                    imp_val = imports["by_industry"].get(ind, 0)
                    by_industry[ind] = {
                        "exports": exp_val,
                        "imports": imp_val,
                        "balance": exp_val - imp_val,
                    }

                # Safe nested upsert — initialise missing keys
                if state not in data["state_trade"]:
                    data["state_trade"][state] = {}
                if partner not in data["state_trade"][state]:
                    data["state_trade"][state][partner] = {}

                data["state_trade"][state][partner]["2025"] = {
                    "total": {
                        "exports": exports["total"],
                        "imports": imports["total"],
                        "balance": exports["total"] - imports["total"],
                    },
                    "by_industry": by_industry,
                }
                records_updated += 1

            except Exception as e:
                errors.append(f"State trade {state}/{partner}: {str(e)}")

            time.sleep(0.1)

    # ------------------------------------------------------------------
    # 3. Part B — Product-level HS4: PNWER 5 states × CA + MX only
    # ------------------------------------------------------------------
    total_hs4_requests = len(PNWER_STATES) * 2
    current = 0

    for state in PNWER_STATES:
        for cty_code, partner in [("1220", "CA"), ("2010", "MX")]:
            current += 1
            step_label = f"Product (HS4): {state} ↔ {partner} ({REFRESH_YEAR})"

            if on_progress:
                on_progress(step_label, current, total_hs4_requests)

            try:
                exp_hs4 = fetch_state_trade_hs4(
                    state, cty_code, REFRESH_YEAR, month, is_export=True
                )
                imp_hs4 = fetch_state_trade_hs4(
                    state, cty_code, REFRESH_YEAR, month, is_export=False
                )

                all_hs4 = set(exp_hs4.keys()) | set(imp_hs4.keys())
                yr_data = {
                    hs4: {
                        "exports": exp_hs4.get(hs4, 0),
                        "imports": imp_hs4.get(hs4, 0),
                    }
                    for hs4 in all_hs4
                }

                # Safe nested upsert
                if state not in data["product_trade"]:
                    data["product_trade"][state] = {}
                if partner not in data["product_trade"][state]:
                    data["product_trade"][state][partner] = {}

                data["product_trade"][state][partner]["2025"] = yr_data
                records_updated += 1

            except Exception as e:
                errors.append(f"HS4 {state}/{partner}: {str(e)}")

            time.sleep(0.1)

    # ------------------------------------------------------------------
    # 4. Part C — National-level: all tracked countries
    # ------------------------------------------------------------------
    total_nat_requests = len(COUNTRIES)
    current = 0

    for cty_code, cty_info in COUNTRIES.items():
        code = cty_info["code"]
        current += 1
        step_label = f"National trade: US ↔ {code} ({REFRESH_YEAR})"

        if on_progress:
            on_progress(step_label, current, total_nat_requests)

        try:
            exp = fetch_national_trade(cty_code, REFRESH_YEAR, month, is_export=True)
            imp = fetch_national_trade(cty_code, REFRESH_YEAR, month, is_export=False)

            if code not in data["national_trade"]:
                data["national_trade"][code] = {
                    "name": cty_info["name"],
                    "group": cty_info["group"],
                    "years": {},
                }

            data["national_trade"][code]["years"]["2025"] = {
                "exports": exp["total"],
                "imports": imp["total"],
                "exports_by_industry": exp["by_industry"],
                "imports_by_industry": imp["by_industry"],
                "total_trade": exp["total"] + imp["total"],
                "balance": exp["total"] - imp["total"],
            }
            records_updated += 1

        except Exception as e:
            errors.append(f"National {code}: {str(e)}")

        time.sleep(0.15)

    # ------------------------------------------------------------------
    # 5. Update metadata — stamp the refresh, keep everything else
    # ------------------------------------------------------------------
    completed_at = datetime.datetime.now()
    data["metadata"]["last_refreshed"] = completed_at.isoformat()
    data["metadata"]["refresh_month"] = month
    data["metadata"]["refresh_year"] = REFRESH_YEAR
    data["metadata"]["refresh_duration_seconds"] = (
        completed_at - started_at
    ).total_seconds()

    # ------------------------------------------------------------------
    # 6. Atomic write — write to temp file first, then rename
    #    This prevents a partial write from corrupting the live data file.
    # ------------------------------------------------------------------
    tmp_path = data_path + ".tmp"
    try:
        Path(data_path).parent.mkdir(parents=True, exist_ok=True)
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, data_path)  # atomic on same filesystem
    except Exception as e:
        errors.append(f"File write failed: {str(e)}")
        return {
            "status": "error",
            "timestamp": completed_at.isoformat(),
            "month_refreshed": month,
            "records_updated": records_updated,
            "errors": errors,
        }

    status = "success" if not errors else "partial"
    return {
        "status": status,
        "timestamp": completed_at.isoformat(),
        "month_refreshed": month,
        "records_updated": records_updated,
        "errors": errors,
    }


# ============================================================================
# Standalone run
# ============================================================================

if __name__ == "__main__":
    def print_progress(step, current, total):
        bar_len = 30
        filled = int(bar_len * current / total)
        bar = "█" * filled + "░" * (bar_len - filled)
        print(f"\r  [{bar}] {current}/{total}  {step:<50}", end="", flush=True)

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║   PNWER Refresh Pipeline — 2025 Current-Year Data    ║")
    print("╚══════════════════════════════════════════════════════╝\n")

    result = refresh_current_year(on_progress=print_progress)

    print(f"\n\n{'='*60}")
    print(f"  Status:           {result['status'].upper()}")
    print(f"  Completed:        {result['timestamp']}")
    print(f"  Month refreshed:  {result['month_refreshed']}/{REFRESH_YEAR}")
    print(f"  Records updated:  {result['records_updated']}")
    if result["errors"]:
        print(f"  Errors ({len(result['errors'])}):")
        for err in result["errors"]:
            print(f"    ⚠  {err}")
    print(f"{'='*60}\n")
