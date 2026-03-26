"""
PNWER Tariff Impact — Industry-Level Analysis
Runs the bilateral model at 6-industry granularity with oil price decomposition.
"""

from tariff_analysis import *

def run():
    data = load_data()
    st = data["state_trade"]

    totals = {"imp_m": 0, "exp_m": 0, "imp_oil": 0, "exp_oil": 0,
              "imp_act": 0, "exp_act": 0, "gdp": 0, "jobs": 0,
              "t24": 0, "t25": 0}
    by_state = {}
    by_ind = {ind: {"imp_base": 0, "imp_m": 0, "imp_act": 0,
                    "exp_base": 0, "exp_m": 0, "exp_act": 0} for ind in INDUSTRIES}

    for s in PNWER_STATES:
        sd = {"imp_m": 0, "exp_m": 0, "imp_act": 0, "exp_act": 0,
              "gdp": 0, "jobs": 0, "t24": 0, "t25": 0}
        for p in ["CA", "MX"]:
            for ind in INDUSTRIES:
                i24 = get_val(st, s, p, "2024", "imports", ind)
                i25 = get_val(st, s, p, "2025", "imports", ind)
                e24 = get_val(st, s, p, "2024", "exports", ind)
                e25 = get_val(st, s, p, "2025", "exports", ind)

                im = industry_import_change(i24, p, ind) if i24 > 0 else 0
                em = industry_export_change(e24, p, ind) if e24 > 0 else 0
                ig = gdp_impact(im, ind, False)
                eg = gdp_impact(em, ind, True)

                sd["imp_m"] += im; sd["exp_m"] += em
                sd["imp_act"] += (i25 - i24); sd["exp_act"] += (e25 - e24)
                sd["gdp"] += ig + eg
                sd["jobs"] += jobs_impact(ig, ind, False) + jobs_impact(eg, ind, True)
                sd["t24"] += i24 + e24; sd["t25"] += i25 + e25

                by_ind[ind]["imp_base"] += i24; by_ind[ind]["imp_m"] += im
                by_ind[ind]["imp_act"] += (i25 - i24)
                by_ind[ind]["exp_base"] += e24; by_ind[ind]["exp_m"] += em
                by_ind[ind]["exp_act"] += (e25 - e24)

        by_state[s] = sd
        for k in totals:
            totals[k] += sd.get(k, 0)

    # Oil
    oil_imp, oil_exp = 0, 0
    for s in PNWER_STATES:
        for p in ["CA", "MX"]:
            oil_imp += oil_adjustment_industry(get_val(st, s, p, "2024", "imports", "energy"), "energy")
            oil_exp += oil_adjustment_industry(get_val(st, s, p, "2024", "exports", "energy"), "energy")

    tariff = (totals["imp_m"] + totals["exp_m"]) / 1e9
    oil = (oil_imp + oil_exp) / 1e9
    actual = (totals["t25"] - totals["t24"]) / 1e9
    residual = actual - tariff - oil

    # Print
    print("\n" + "=" * 80)
    print("  PNWER BILATERAL TARIFF IMPACT — INDUSTRY LEVEL")
    print("=" * 80)
    print(f"\n  Bilateral trade: ${totals['t24']/1e9:.1f}B → ${totals['t25']/1e9:.1f}B ({actual/totals['t24']*1e9*100:.1f}%)")
    print(f"  GDP at risk: ${totals['gdp']/1e6:,.0f}M | Jobs: {totals['jobs']:,.0f}")

    print(f"\n  DECOMPOSITION")
    print(f"  ┌─────────────────────────────────────────────────┐")
    print(f"  │ Tariff effect      ${tariff:>+6.1f}B   ({abs(tariff/actual)*100:.0f}%)       │")
    print(f"  │ Oil price (WTI {WTI_CHG*100:+.1f}%)  ${oil:>+6.1f}B   ({abs(oil/actual)*100:.0f}%)       │")
    print(f"  │ Residual            ${residual:>+6.1f}B   ({abs(residual/actual)*100:.0f}%)       │")
    print(f"  │─────────────────────────────────────────────────│")
    print(f"  │ Actual total        ${actual:>+6.1f}B   (100%)      │")
    print(f"  └─────────────────────────────────────────────────┘")

    print(f"\n  BY INDUSTRY")
    print(f"  {'':15} {'Imp Base':>8} {'Imp Mdl':>8} {'Imp Act':>8} {'Exp Base':>8} {'Exp Mdl':>8} {'Exp Act':>8}")
    for ind in INDUSTRIES:
        d = by_ind[ind]
        print(f"  {ind:<15} ${d['imp_base']/1e6:>6,.0f}M {d['imp_m']/1e6:>+7,.0f}M {d['imp_act']/1e6:>+7,.0f}M"
              f" ${d['exp_base']/1e6:>6,.0f}M {d['exp_m']/1e6:>+7,.0f}M {d['exp_act']/1e6:>+7,.0f}M")

    print(f"\n  BY STATE")
    print(f"  {'':12} {'Trade24':>10} {'ImpChg':>8} {'ExpChg':>8} {'GDP':>9} {'Jobs':>7}")
    for s in PNWER_STATES:
        d = by_state[s]
        print(f"  {STATE_NAMES[s]:<12} ${d['t24']/1e6:>8,.0f}M {d['imp_act']/1e6:>+7,.0f}M {d['exp_act']/1e6:>+7,.0f}M"
              f" ${d['gdp']/1e6:>7,.0f}M {d['jobs']:>6,.0f}")

    print("=" * 80)

if __name__ == "__main__":
    run()