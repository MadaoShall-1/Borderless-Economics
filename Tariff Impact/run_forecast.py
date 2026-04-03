"""
PNWER Monthly Rolling Forecast
-------------------------------
Uses the latest available Census month as baseline,
predicts next month's trade by industry and product.

Inputs:
  - pnwer_analysis_data_v9.json (monthly_trade + monthly_products from refresh)
  - tariff_model.py (elasticities, tariff rates, GDP/jobs multipliers)
  - config.json (scenario parameters)

Outputs:
  - monthly_forecast.json → pnwer-dashboard/src/data/

Usage:
    python run_forecast.py
    python run_forecast.py --tariff-ca 25 --tariff-mx 20

Or as library:
    from run_forecast import forecast_next_month
    result = forecast_next_month(tariff_ca=15, tariff_mx=12)
"""

import json
import os
import argparse
import datetime
from tariff_model import (
    load_data, INDUSTRIES, PNWER_STATES, STATE_NAMES,
    get_monthly_val, get_product_val,
    H2_TAU_IMP, H2_TAU_EXP,
    HS4_TARIFFS, HS4_ELAST,
    IMP_ELAST, EXP_ELAST, AGG_SCALE,
    IO_MULT, EXP_MULT, JOBS_PER_M, EXP_JOBS,
    gdp_impact, jobs_impact,
    JSON_OUT, US_CONFIG,
)

PARTNERS = [("1220", "CA"), ("2010", "MX")]
MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Focus HS4 products
FOCUS_HS4 = {
    "0808": {"name": "Apples & Pears",      "ind": "agriculture"},
    "0402": {"name": "Dairy",               "ind": "agriculture"},
    "1001": {"name": "Wheat",               "ind": "agriculture"},
    "1205": {"name": "Canola",              "ind": "agriculture"},
    "0201": {"name": "Beef",                "ind": "agriculture"},
    "2709": {"name": "Crude Oil",           "ind": "energy"},
    "2710": {"name": "Refined Petroleum",   "ind": "energy"},
    "2711": {"name": "Natural Gas",         "ind": "energy"},
    "4407": {"name": "Lumber",              "ind": "forestry"},
    "4418": {"name": "Builders Woodwork",   "ind": "forestry"},
    "4703": {"name": "Woodpulp",            "ind": "forestry"},
    "7601": {"name": "Aluminum",            "ind": "minerals"},
    "7208": {"name": "Steel",               "ind": "minerals"},
    "8708": {"name": "Auto Parts",          "ind": "manufacturing"},
    "8413": {"name": "Pumps",               "ind": "manufacturing"},
    "8481": {"name": "Valves",              "ind": "manufacturing"},
    "8432": {"name": "Ag Machinery",        "ind": "manufacturing"},
}


def detect_latest_month_key(data):
    """Find the most recent month key in monthly_trade data."""
    mt = data.get("monthly_trade", {})
    all_months = set()
    for state in PNWER_STATES:
        for _, partner in PARTNERS:
            months = mt.get(state, {}).get(partner, {})
            all_months.update(months.keys())
    if not all_months:
        return None
    return sorted(all_months)[-1]


def get_prev_month_key(month_key):
    """Given '2026-02', return '2026-01'. Given '2026-01', return '2025-12'."""
    year, month = int(month_key.split("-")[0]), int(month_key.split("-")[1])
    if month == 1:
        return f"{year - 1}-12"
    return f"{year}-{month - 1:02d}"


def get_next_month_key(month_key):
    """Given '2026-02', return '2026-03'. Given '2025-12', return '2026-01'."""
    year, month = int(month_key.split("-")[0]), int(month_key.split("-")[1])
    if month == 12:
        return f"{year + 1}-01"
    return f"{year}-{month + 1:02d}"


def forecast_next_month(tariff_ca=None, tariff_mx=None, data=None):
    """
    Core forecast function.

    Args:
        tariff_ca: Effective CA tariff rate (0-50%). None = use current H2 rates.
        tariff_mx: Effective MX tariff rate (0-50%). None = use current H2 rates.
        data: Pre-loaded data dict. If None, loads from disk.

    Returns dict with:
        - metadata (baseline month, predicted month, tariff rates)
        - by_industry: { ind: { current_imp, current_exp, predicted, delta, gdp, jobs, ... } }
        - by_product: { hs4: { current_imp, current_exp, predicted, delta, ... } }
        - totals: { current, predicted, delta, gdp, jobs }
    """
    if data is None:
        data = load_data()

    mt = data.get("monthly_trade", {})
    mp = data.get("monthly_products", {})

    # Detect latest month
    latest_mk = detect_latest_month_key(data)
    if not latest_mk:
        return {"error": "No monthly data available. Run refresh first."}

    prev_mk = get_prev_month_key(latest_mk)
    next_mk = get_next_month_key(latest_mk)
    cfg = US_CONFIG

    # ══════════════════════════════════════════════════════════════
    # INDUSTRY FORECAST
    # ══════════════════════════════════════════════════════════════
    ind_results = {}
    totals = {"current": 0, "predicted": 0, "delta": 0, "gdp": 0, "jobs": 0}

    for ind in INDUSTRIES:
        # Aggregate current month across states × partners
        cur_imp = cur_exp = prev_imp = prev_exp = 0
        for state in PNWER_STATES:
            for _, partner in PARTNERS:
                cur_imp += get_monthly_val(mt, state, partner, latest_mk, "imports", ind)
                cur_exp += get_monthly_val(mt, state, partner, latest_mk, "exports", ind)
                prev_imp += get_monthly_val(mt, state, partner, prev_mk, "imports", ind)
                prev_exp += get_monthly_val(mt, state, partner, prev_mk, "exports", ind)

        current = cur_imp + cur_exp
        previous = prev_imp + prev_exp

        # MoM momentum (damped 30%)
        mom_delta = 0
        if previous > 0:
            mom_delta = (current - previous) * 0.3

        # Tariff effect delta
        imp_delta = 0
        exp_delta = 0
        for _, partner in PARTNERS:
            # Current tariff effect (already embedded in the data)
            cur_tau_imp = H2_TAU_IMP.get(partner, {}).get(ind, 0.10)
            cur_tau_exp = H2_TAU_EXP.get(partner, {}).get(ind, 0.05)

            # Partner share of this industry (approximate from current data)
            p_share_imp = cur_imp / max(cur_imp, 1)  # simplified; actual split would need per-partner data
            p_share_exp = cur_exp / max(cur_exp, 1)

            if tariff_ca is not None and partner == "CA":
                new_tau_imp = tariff_ca / 100
                new_tau_exp = tariff_ca / 100 * 0.4  # retaliation ~ 40% of import tariff
            elif tariff_mx is not None and partner == "MX":
                new_tau_imp = tariff_mx / 100
                new_tau_exp = tariff_mx / 100 * 0.4
            else:
                new_tau_imp = cur_tau_imp
                new_tau_exp = cur_tau_exp

            e_imp = IMP_ELAST.get(ind, -1.0)
            e_exp = EXP_ELAST.get(ind, -1.0)
            agg = AGG_SCALE.get(ind, 0.5)

            # Per-partner monthly import/export base (from current month)
            p_imp = get_monthly_val(mt, PNWER_STATES[0], partner, latest_mk, "imports", ind)
            p_exp = get_monthly_val(mt, PNWER_STATES[0], partner, latest_mk, "exports", ind)
            # Sum across all states for this partner
            for state in PNWER_STATES[1:]:
                p_imp += get_monthly_val(mt, state, partner, latest_mk, "imports", ind)
                p_exp += get_monthly_val(mt, state, partner, latest_mk, "exports", ind)

            # Delta = new_effect - current_effect
            imp_delta += p_imp * e_imp * agg * (new_tau_imp - cur_tau_imp)
            exp_delta += p_exp * e_exp * (new_tau_exp - cur_tau_exp)

        tariff_delta = imp_delta + exp_delta
        predicted = max(0, current + mom_delta + tariff_delta)
        delta = predicted - current

        # GDP and jobs
        total_gdp = 0
        total_jobs_ind = 0
        if delta < 0:
            # Split loss into import/export components for proper multiplier
            imp_loss = delta * (cur_imp / max(current, 1))
            exp_loss = delta * (cur_exp / max(current, 1))
            g_imp = gdp_impact(imp_loss, ind, is_export=False, cfg=cfg)
            g_exp = gdp_impact(exp_loss, ind, is_export=True, cfg=cfg)
            total_gdp = g_imp + g_exp
            total_jobs_ind = jobs_impact(g_imp, ind, is_export=False, cfg=cfg) + \
                             jobs_impact(g_exp, ind, is_export=True, cfg=cfg)

        ind_results[ind] = {
            "current_imp": round(cur_imp),
            "current_exp": round(cur_exp),
            "current": round(current),
            "predicted": round(predicted),
            "delta": round(delta),
            "pct_change": round(delta / current * 100, 1) if current > 0 else 0,
            "gdp_risk": round(total_gdp),
            "jobs_risk": round(total_jobs_ind),
        }
        totals["current"] += current
        totals["predicted"] += predicted
        totals["delta"] += delta
        totals["gdp"] += total_gdp
        totals["jobs"] += total_jobs_ind

    # ══════════════════════════════════════════════════════════════
    # PRODUCT FORECAST
    # ══════════════════════════════════════════════════════════════
    prod_results = {}

    for hs4, meta in FOCUS_HS4.items():
        ind = meta["ind"]

        # Real monthly product data from monthly_products
        cur_imp = cur_exp = prev_imp_p = prev_exp_p = 0
        for state in PNWER_STATES:
            for _, partner in PARTNERS:
                pd_cur = mp.get(state, {}).get(partner, {}).get(latest_mk, {}).get(hs4, {})
                pd_prev = mp.get(state, {}).get(partner, {}).get(prev_mk, {}).get(hs4, {})
                cur_imp += pd_cur.get("imports", 0)
                cur_exp += pd_cur.get("exports", 0)
                prev_imp_p += pd_prev.get("imports", 0)
                prev_exp_p += pd_prev.get("exports", 0)

        current = cur_imp + cur_exp
        previous = prev_imp_p + prev_exp_p

        # MoM momentum
        mom_delta = (current - previous) * 0.3 if previous > 0 else 0

        # Per-partner tariff delta using HS4-specific rates
        tariff_delta = 0
        for _, partner in PARTNERS:
            p_imp = p_exp = 0
            for state in PNWER_STATES:
                pd_cur = mp.get(state, {}).get(partner, {}).get(latest_mk, {}).get(hs4, {})
                p_imp += pd_cur.get("imports", 0)
                p_exp += pd_cur.get("exports", 0)

            # Current HS4 tariff rates
            cur_tau_imp = HS4_TARIFFS.get(hs4, {}).get("imp", {}).get(partner, 0.10)
            cur_tau_exp = HS4_TARIFFS.get(hs4, {}).get("exp", {}).get(partner, 0.05)

            # New rates (if custom tariff provided)
            if partner == "CA" and tariff_ca is not None:
                # Scale HS4 rate proportionally: new = current × (user_rate / current_avg)
                cur_avg = 0.15  # current H2 avg for CA
                scale = tariff_ca / 100 / max(cur_avg, 0.01)
                new_tau_imp = cur_tau_imp * scale
                new_tau_exp = cur_tau_exp * scale
            elif partner == "MX" and tariff_mx is not None:
                cur_avg = 0.12
                scale = tariff_mx / 100 / max(cur_avg, 0.01)
                new_tau_imp = cur_tau_imp * scale
                new_tau_exp = cur_tau_exp * scale
            else:
                new_tau_imp = cur_tau_imp
                new_tau_exp = cur_tau_exp

            e = HS4_ELAST.get(hs4, IMP_ELAST.get(ind, -1.0))
            tariff_delta += p_imp * e * (new_tau_imp - cur_tau_imp)
            tariff_delta += p_exp * e * (new_tau_exp - cur_tau_exp)

        predicted = max(0, current + mom_delta + tariff_delta)

        prod_results[hs4] = {
            "name": meta["name"],
            "industry": ind,
            "current_imp": round(cur_imp),
            "current_exp": round(cur_exp),
            "current": round(current),
            "predicted": round(predicted),
            "delta": round(predicted - current),
            "pct_change": round((predicted - current) / current * 100, 1) if current > 0 else 0,
        }

    # Round totals
    totals = {k: round(v) for k, v in totals.items()}

    # Parse month info
    latest_year = int(latest_mk.split("-")[0])
    latest_month = int(latest_mk.split("-")[1])
    next_year = int(next_mk.split("-")[0])
    next_month_num = int(next_mk.split("-")[1])

    output = {
        "metadata": {
            "generated_at": datetime.datetime.now().isoformat(),
            "baseline_month": latest_mk,
            "baseline_label": f"{MONTH_NAMES[latest_month - 1]} {latest_year}",
            "predicted_month": next_mk,
            "predicted_label": f"{MONTH_NAMES[next_month_num - 1]} {next_year}",
            "tariff_ca": tariff_ca if tariff_ca is not None else "current H2 rates",
            "tariff_mx": tariff_mx if tariff_mx is not None else "current H2 rates",
            "model": "CES/Armington with H2 2025 calibrated elasticities",
            "momentum": "30% damped MoM",
        },
        "totals": totals,
        "by_industry": ind_results,
        "by_product": prod_results,
    }

    return output


def save_forecast(output, out_dir=None):
    """Save forecast to JSON."""
    if out_dir is None:
        out_dir = JSON_OUT
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "monthly_forecast.json")
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)
    return out_path


# ============================================================================
# Standalone run
# ============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PNWER Monthly Rolling Forecast")
    parser.add_argument("--tariff-ca", type=float, default=None,
                        help="Custom CA tariff rate (%%). Default: current H2 rates")
    parser.add_argument("--tariff-mx", type=float, default=None,
                        help="Custom MX tariff rate (%%). Default: current H2 rates")
    args = parser.parse_args()

    print("\n" + "=" * 75)
    print("  PNWER Monthly Rolling Forecast")
    print("=" * 75)

    result = forecast_next_month(tariff_ca=args.tariff_ca, tariff_mx=args.tariff_mx)

    if "error" in result:
        print(f"\n  ERROR: {result['error']}")
    else:
        meta = result["metadata"]
        totals = result["totals"]
        print(f"\n  Baseline: {meta['baseline_label']} (Census actual)")
        print(f"  Predict:  {meta['predicted_label']}")
        print(f"  Tariff:   CA={meta['tariff_ca']}  MX={meta['tariff_mx']}")

        print(f"\n  {'Industry':<15} {'Current':>12} {'Predicted':>12} {'Delta':>12} {'Chg%':>7} {'GDP Risk':>12} {'Jobs':>8}")
        print(f"  {'-'*78}")
        for ind, d in result["by_industry"].items():
            print(f"  {ind:<15} ${d['current']/1e6:>10.1f}M ${d['predicted']/1e6:>10.1f}M"
                  f" ${d['delta']/1e6:>+10.1f}M {d['pct_change']:>+6.1f}%"
                  f" ${d['gdp_risk']/1e6:>10.1f}M {d['jobs_risk']:>7,.0f}")
        print(f"  {'TOTAL':<15} ${totals['current']/1e6:>10.1f}M ${totals['predicted']/1e6:>10.1f}M"
              f" ${totals['delta']/1e6:>+10.1f}M"
              f" {totals['delta']/totals['current']*100 if totals['current']>0 else 0:>+6.1f}%"
              f" ${totals['gdp']/1e6:>10.1f}M {totals['jobs']:>7,.0f}")

        print(f"\n  {'HS4':<6} {'Product':<22} {'Current':>10} {'Predicted':>10} {'Delta':>10} {'Chg%':>7}")
        print(f"  {'-'*68}")
        for hs4, d in sorted(result["by_product"].items(), key=lambda x: abs(x[1]["delta"]), reverse=True):
            print(f"  {hs4:<6} {d['name']:<22} ${d['current']/1e6:>8.1f}M ${d['predicted']/1e6:>8.1f}M"
                  f" ${d['delta']/1e6:>+8.1f}M {d['pct_change']:>+6.1f}%")

        path = save_forecast(result)
        print(f"\n  → Saved: {path}")
    print("=" * 75)