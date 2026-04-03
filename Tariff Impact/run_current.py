"""
PNWER Dashboard — Current Tariff Impact (Monthly)
Shows latest month's tariff impact using H2 elasticities.
For dashboard "current impact" view.
"""

import json
import os
from tariff_model import *
from tariff_model import US_CONFIG

def run(latest_months=3):
    """
    Compute current tariff impact using latest N months average.
    Default: 3 months (Oct-Dec 2025) for stability.
    """
    data = load_data()
    mt = data["monthly_trade"]
    cfg = US_CONFIG

    states = cfg["regions"]
    partners = cfg["partners"]
    h2_imp = cfg["imp_elast_h2"]
    h2_exp = cfg["exp_elast_h2"]

    # Find latest available months
    sample = mt.get("WA", {}).get("CA", {})
    all_months = sorted(sample.keys())
    months_2025 = [m for m in all_months if m.startswith("2025")]
    latest = months_2025[-latest_months:]  # last N months of 2025

    print("\n" + "=" * 80)
    print(f"  PNWER CURRENT TARIFF IMPACT (Monthly)")
    print(f"  Period: {latest[0]} to {latest[-1]} (avg)")
    print(f"  Elasticities: H2 2025 settled, oil-stripped")
    print("=" * 80)

    # Per state: compute latest monthly avg, YoY change, model prediction
    totals = {"base24": 0, "current25": 0, "model": 0, "actual": 0, "gdp": 0, "jobs": 0}
    by_state = {}
    by_ind = {ind: {"base24": 0, "current25": 0, "model": 0, "actual": 0} for ind in INDUSTRIES}
    monthly_trend = {}  # for chart: all 2025 months

    for state in states:
        st = {"base24": 0, "current25": 0, "model": 0, "actual": 0, "gdp": 0, "jobs": 0}

        for partner in partners:
            for ind in INDUSTRIES:
                # Latest months average
                sum_24 = 0; sum_25 = 0; n = 0
                for month in latest:
                    m24 = month.replace("2025", "2024")
                    sum_25 += get_monthly_val(mt, state, partner, month, "imports", ind)
                    sum_25 += get_monthly_val(mt, state, partner, month, "exports", ind)
                    sum_24 += get_monthly_val(mt, state, partner, m24, "imports", ind)
                    sum_24 += get_monthly_val(mt, state, partner, m24, "exports", ind)
                    n += 1

                avg_24 = sum_24 / n if n > 0 else 0
                avg_25 = sum_25 / n if n > 0 else 0
                actual_chg = avg_25 - avg_24

                # Model: what tariff predicts for this monthly base
                bl = get_q4_baseline(mt, state, partner, ind)
                imp_chg = forecast_change(bl["imports"], partner, ind, "imports",
                                          {"imp_elast": h2_imp, "exp_elast": h2_exp})
                exp_chg = forecast_change(bl["exports"], partner, ind, "exports",
                                          {"imp_elast": h2_imp, "exp_elast": h2_exp})
                model_chg = imp_chg + exp_chg

                st["base24"] += avg_24; st["current25"] += avg_25
                st["actual"] += actual_chg; st["model"] += model_chg

                by_ind[ind]["base24"] += avg_24; by_ind[ind]["current25"] += avg_25
                by_ind[ind]["actual"] += actual_chg; by_ind[ind]["model"] += model_chg

                # GDP/jobs from model
                for chg, flow in [(imp_chg, "imports"), (exp_chg, "exports")]:
                    if chg < 0:
                        g = gdp_impact(chg, ind, flow == "exports", cfg=cfg)
                        j = jobs_impact(g, ind, flow == "exports", cfg=cfg)
                        st["gdp"] += g; st["jobs"] += j

        by_state[state] = st
        for k in totals:
            totals[k] += st.get(k, 0)

    # Monthly annualized = monthly × 12
    ann = lambda x: x * 12

    print(f"\n  Latest monthly avg (annualized):")
    print(f"  2024 baseline:  ${ann(totals['base24'])/1e9:.1f}B/yr")
    print(f"  Current 2025:   ${ann(totals['current25'])/1e9:.1f}B/yr")
    print(f"  Actual YoY chg: ${ann(totals['actual'])/1e6:+,.0f}M/yr")
    print(f"  Model tariff:   ${ann(totals['model'])/1e6:+,.0f}M/yr")
    print(f"  GDP at risk:    ${ann(totals['gdp'])/1e6:,.0f}M/yr")
    print(f"  Jobs at risk:   {ann(totals['jobs']):,.0f}/yr")

    print(f"\n  BY STATE (monthly avg, annualized)")
    print(f"  {'State':<15} {'2024':>8} {'2025':>8} {'YoY Chg':>9} {'Model':>9} {'GDP':>9} {'Jobs':>7}")
    for state in states:
        d = by_state[state]
        print(f"  {cfg['region_names'][state]:<15} ${ann(d['base24'])/1e9:>6.1f}B ${ann(d['current25'])/1e9:>6.1f}B"
              f" ${ann(d['actual'])/1e6:>+7,.0f}M ${ann(d['model'])/1e6:>+7,.0f}M"
              f" ${ann(d['gdp'])/1e6:>7,.0f}M {ann(d['jobs']):>6,.0f}")

    print(f"\n  BY INDUSTRY (monthly avg, annualized)")
    print(f"  {'Industry':<15} {'2024':>8} {'2025':>8} {'YoY Chg':>9} {'Model':>9} {'Chg%':>6}")
    for ind in INDUSTRIES:
        d = by_ind[ind]
        pct = ann(d['actual']) / ann(d['base24']) * 100 if d['base24'] > 0 else 0
        print(f"  {ind:<15} ${ann(d['base24'])/1e6:>6,.0f}M ${ann(d['current25'])/1e6:>6,.0f}M"
              f" ${ann(d['actual'])/1e6:>+7,.0f}M ${ann(d['model'])/1e6:>+7,.0f}M {pct:>+5.1f}%")

    # Monthly trend (all 2025 months) — YoY + MoM for chart
    print(f"\n  MONTHLY TREND (total bilateral, $M)")
    print(f"  {'Month':>7} {'2024':>8} {'2025':>8} {'YoY':>7} {'YoY%':>6} {'MoM':>7} {'MoM%':>6}")
    prev_25 = None
    for m_idx in range(1, 13):
        m24 = f"2024-{m_idx:02d}"; m25 = f"2025-{m_idx:02d}"
        t24 = 0; t25 = 0
        for state in states:
            for partner in partners:
                for flow in ["imports", "exports"]:
                    t24 += get_monthly_val(mt, state, partner, m24, flow)
                    t25 += get_monthly_val(mt, state, partner, m25, flow)
        yoy = t25 - t24
        yoy_pct = yoy / t24 * 100 if t24 > 0 else 0
        mom = t25 - prev_25 if prev_25 is not None else 0
        mom_pct = mom / prev_25 * 100 if prev_25 and prev_25 > 0 else 0
        mom_str = f"${mom/1e6:>+5,.0f}M {mom_pct:>+5.1f}%" if prev_25 is not None else "       N/A    N/A"
        print(f"  {m25:>7} ${t24/1e6:>6,.0f}M ${t25/1e6:>6,.0f}M ${yoy/1e6:>+5,.0f}M {yoy_pct:>+5.1f}% {mom_str}")
        monthly_trend[m25] = {
            "trade_2024": round(t24), "trade_2025": round(t25),
            "yoy_change": round(yoy), "yoy_pct": round(yoy_pct, 1),
            "mom_change": round(mom) if prev_25 is not None else None,
            "mom_pct": round(mom_pct, 1) if prev_25 is not None else None,
        }
        prev_25 = t25

    # Industry-level monthly trend (for dashboard drilldown)
    industry_monthly = {}
    for ind in INDUSTRIES:
        industry_monthly[ind] = {}
        prev = None
        for m_idx in range(1, 13):
            m24 = f"2024-{m_idx:02d}"; m25 = f"2025-{m_idx:02d}"
            t24 = 0; t25 = 0
            for state in states:
                for partner in partners:
                    for flow in ["imports", "exports"]:
                        t24 += get_monthly_val(mt, state, partner, m24, flow, ind)
                        t25 += get_monthly_val(mt, state, partner, m25, flow, ind)
            yoy = t25 - t24
            yoy_pct = yoy / t24 * 100 if t24 > 0 else 0
            mom = t25 - prev if prev is not None else 0
            mom_pct = mom / prev * 100 if prev and prev > 0 else 0
            industry_monthly[ind][m25] = {
                "trade_2024": round(t24), "trade_2025": round(t25),
                "yoy_change": round(yoy), "yoy_pct": round(yoy_pct, 1),
                "mom_change": round(mom) if prev is not None else None,
                "mom_pct": round(mom_pct, 1) if prev is not None else None,
            }
            prev = t25

    print("=" * 80)

    # JSON output
    output = {
        "metadata": {
            "type": "current_impact",
            "period": f"{latest[0]} to {latest[-1]} average",
            "elasticities": "H2 2025 settled, oil-stripped",
            "annualized": "monthly × 12",
        },
        "summary": {
            "baseline_2024_annualized": round(ann(totals["base24"])),
            "current_2025_annualized": round(ann(totals["current25"])),
            "actual_yoy_annualized": round(ann(totals["actual"])),
            "model_tariff_annualized": round(ann(totals["model"])),
            "gdp_at_risk_annualized": round(ann(totals["gdp"])),
            "jobs_at_risk_annualized": round(ann(totals["jobs"])),
        },
        "by_state": {s: {k: round(ann(v)) for k, v in d.items()} for s, d in by_state.items()},
        "by_industry": {i: {k: round(ann(v)) for k, v in d.items()} for i, d in by_ind.items()},
        "monthly_trend": monthly_trend,
        "industry_monthly_trend": industry_monthly,
    }

    out_path = os.path.join(JSON_OUT, "us_current_impact.json")
    os.makedirs(JSON_OUT, exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"\n  → JSON saved: {out_path}")


if __name__ == "__main__":
    run()