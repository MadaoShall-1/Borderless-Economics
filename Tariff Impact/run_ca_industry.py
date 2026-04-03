"""
PNWER Tariff Impact — Canadian Province Industry-Level Analysis
Oil adjustment: residual-based (energy actual - energy tariff model)
"""

import json
import os
from tariff_model import *
from tariff_model import CA_CONFIG

def run():
    ca_data = load_ca_data()
    pt = ca_data["province_trade"]
    cfg = CA_CONFIG
    cad_usd = cfg["cad_usd"]
    provinces = ["BC", "AB", "SK"]

    totals = {"t24": 0, "t25": 0, "model": 0, "oil": 0, "gdp": 0, "jobs": 0}
    by_prov = {}
    by_ind = {ind: {"exp_base": 0, "exp_m": 0, "exp_act": 0,
                    "imp_base": 0, "imp_m": 0, "imp_act": 0} for ind in INDUSTRIES}

    for p in provinces:
        pd = {"t24": 0, "t25": 0, "model": 0, "oil": 0,
              "gdp": 0, "jobs": 0, "exp_act": 0, "imp_act": 0}

        for ind in INDUSTRIES:
            e24 = get_ca_val(pt, p, "2024", "exports", ind)
            e25 = get_ca_val(pt, p, "2025", "exports", ind)
            i24 = get_ca_val(pt, p, "2024", "imports", ind)
            i25 = get_ca_val(pt, p, "2025", "imports", ind)

            em = industry_export_change(e24, "US", ind, cfg=cfg) if e24 > 0 else 0
            im = industry_import_change(i24, "US", ind, cfg=cfg) if i24 > 0 else 0
            eg = gdp_impact(em, ind, True, cfg=cfg)
            ig = gdp_impact(im, ind, False, cfg=cfg)
            ej = jobs_impact(eg, ind, True, cfg=cfg)
            ij = jobs_impact(ig, ind, False, cfg=cfg)

            pd["t24"] += e24 + i24; pd["t25"] += e25 + i25
            pd["model"] += em + im
            pd["gdp"] += eg + ig; pd["jobs"] += ej + ij
            pd["exp_act"] += (e25 - e24); pd["imp_act"] += (i25 - i24)

            by_ind[ind]["exp_base"] += e24; by_ind[ind]["exp_m"] += em
            by_ind[ind]["exp_act"] += (e25 - e24)
            by_ind[ind]["imp_base"] += i24; by_ind[ind]["imp_m"] += im
            by_ind[ind]["imp_act"] += (i25 - i24)

        # Oil: residual-based (energy actual - energy tariff model)
        e24_en = get_ca_val(pt, p, "2024", "exports", "energy")
        e25_en = get_ca_val(pt, p, "2025", "exports", "energy")
        i24_en = get_ca_val(pt, p, "2024", "imports", "energy")
        i25_en = get_ca_val(pt, p, "2025", "imports", "energy")
        energy_tariff = (industry_export_change(e24_en, "US", "energy", cfg=cfg) +
                         industry_import_change(i24_en, "US", "energy", cfg=cfg))
        energy_actual = (e25_en + i25_en) - (e24_en + i24_en)
        pd["oil"] = energy_actual - energy_tariff

        by_prov[p] = pd
        for k in totals:
            totals[k] += pd.get(k, 0)

    tariff = totals["model"] / 1e9
    oil = totals["oil"] / 1e9
    actual = (totals["t25"] - totals["t24"]) / 1e9
    residual = actual - tariff - oil

    # Print
    print("\n" + "=" * 80)
    print("  PNWER CANADIAN PROVINCES — BILATERAL TARIFF IMPACT (CAD)")
    print("  Provinces: BC, AB, SK | Partner: United States")
    print("=" * 80)
    print(f"\n  Bilateral trade: ${totals['t24']/1e9:.1f}B → ${totals['t25']/1e9:.1f}B"
          f" ({actual/totals['t24']*1e9*100:.1f}%)")
    print(f"  GDP at risk: ${totals['gdp']/1e6:,.0f}M CAD (${totals['gdp']*cad_usd/1e6:,.0f}M USD)")
    print(f"  Jobs at risk: {totals['jobs']:,.0f}")

    print(f"\n  DECOMPOSITION (CAD)")
    print(f"  ┌─────────────────────────────────────────────────┐")
    print(f"  │ Tariff effect      ${tariff:>+6.1f}B   ({abs(tariff/actual)*100:.0f}%)       │")
    print(f"  │ Oil/energy price   ${oil:>+6.1f}B   ({abs(oil/actual)*100:.0f}%)       │")
    print(f"  │ Residual            ${residual:>+6.1f}B   ({abs(residual/actual)*100:.0f}%)       │")
    print(f"  │─────────────────────────────────────────────────│")
    print(f"  │ Actual total        ${actual:>+6.1f}B   (100%)      │")
    print(f"  └─────────────────────────────────────────────────┘")

    print(f"\n  BY INDUSTRY (CAD)")
    print(f"  {'':15} {'Exp Base':>8} {'Exp Mdl':>8} {'Exp Act':>8} {'Imp Base':>8} {'Imp Mdl':>8} {'Imp Act':>8}")
    for ind in INDUSTRIES:
        d = by_ind[ind]
        print(f"  {ind:<15} ${d['exp_base']/1e6:>6,.0f}M {d['exp_m']/1e6:>+7,.0f}M {d['exp_act']/1e6:>+7,.0f}M"
              f" ${d['imp_base']/1e6:>6,.0f}M {d['imp_m']/1e6:>+7,.0f}M {d['imp_act']/1e6:>+7,.0f}M")

    print(f"\n  BY PROVINCE")
    print(f"  {'':15} {'Trade24':>10} {'Tariff':>8} {'Oil':>8} {'Actual':>8} {'Resid':>8} {'Res%':>6} {'GDP':>8} {'Jobs':>7}")
    for p in provinces:
        d = by_prov[p]
        act = d["t25"] - d["t24"]
        combined = d["model"] + d["oil"]
        res = act - combined
        pct = abs(res/act)*100 if act != 0 else 0
        print(f"  {cfg['region_names'][p]:<15} ${d['t24']/1e6:>8,.0f}M {d['model']/1e6:>+7,.0f}M"
              f" {d['oil']/1e6:>+7,.0f}M {act/1e6:>+7,.0f}M {res/1e6:>+7,.0f}M {pct:>5.0f}%"
              f" ${d['gdp']/1e6:>6,.0f}M {d['jobs']:>6,.0f}")

    print(f"\n  USD EQUIVALENT (×{cad_usd})")
    print(f"  GDP at risk: ${totals['gdp']*cad_usd/1e6:,.0f}M USD")
    print(f"  Trade loss (tariff): ${totals['model']*cad_usd/1e6:+,.0f}M USD")
    print("=" * 80)

    # JSON output
    results = {
        "side": "CA", "currency": "CAD", "cad_usd": cad_usd,
        "oil_method": "residual-based (energy_actual - energy_tariff_model)",
        "summary": {
            "trade_2024": round(totals["t24"]),
            "trade_2025": round(totals["t25"]),
            "tariff_effect": round(totals["model"]),
            "oil_effect": round(totals["oil"]),
            "actual_change": round(totals["t25"] - totals["t24"]),
            "residual": round((totals["t25"] - totals["t24"]) - totals["model"] - totals["oil"]),
            "gdp_at_risk_cad": round(totals["gdp"]),
            "gdp_at_risk_usd": round(totals["gdp"] * cad_usd),
            "jobs_at_risk": round(totals["jobs"]),
        },
        "by_province": {},
        "by_industry": {},
    }
    for p in provinces:
        d = by_prov[p]
        act = d["t25"] - d["t24"]
        results["by_province"][p] = {
            "name": cfg["region_names"][p],
            "trade_2024": round(d["t24"]), "trade_2025": round(d["t25"]),
            "tariff_effect": round(d["model"]), "oil_effect": round(d["oil"]),
            "actual_change": round(act),
            "residual": round(act - d["model"] - d["oil"]),
            "gdp_at_risk": round(d["gdp"]), "jobs_at_risk": round(d["jobs"]),
        }
    for ind in INDUSTRIES:
        d = by_ind[ind]
        results["by_industry"][ind] = {
            "export_base": round(d["exp_base"]), "export_model": round(d["exp_m"]),
            "export_actual": round(d["exp_act"]),
            "import_base": round(d["imp_base"]), "import_model": round(d["imp_m"]),
            "import_actual": round(d["imp_act"]),
        }
    out_path = os.path.join(SCRIPT_DIR, "ca_industry_results.json")
    with open(out_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\n  → JSON saved: {out_path}")

if __name__ == "__main__":
    run()