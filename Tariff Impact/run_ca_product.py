"""
PNWER Tariff Impact — Canadian Province Product-Level (NAPCS) Analysis
All 5 provinces: BC, AB, SK, YT, NT
Uses StatCan NAPCS categories (12 product groups).
Outputs: ca_product_results.json → dashboard data dir
"""

import json
import os
from tariff_model import *
from tariff_model import CA_CONFIG

NAPCS_TO_INDUSTRY = {
    "farm_fish": "agriculture", "energy": "energy", "ores": "minerals",
    "metals": "minerals", "chemical": "other", "forestry": "forestry",
    "machinery": "manufacturing", "electronics": "manufacturing",
    "vehicles": "manufacturing", "aircraft": "manufacturing",
    "consumer": "other", "special": "other",
}

NAPCS_NAMES = {
    "farm_fish": "Farm & Fish Products",
    "energy": "Energy Products",
    "ores": "Metal Ores & Minerals",
    "metals": "Metal & Alloy Products",
    "chemical": "Chemicals & Plastics",
    "forestry": "Forestry Products",
    "machinery": "Machinery & Equipment",
    "electronics": "Electronics",
    "vehicles": "Motor Vehicles & Parts",
    "aircraft": "Aircraft & Parts",
    "consumer": "Consumer Goods",
    "special": "Special Transactions",
}

# NAPCS-level tariff rates (effective annualized 2025, US tariffs on CA + CA retaliation)
NAPCS_TAU_EXP = {  # What CA faces exporting to US
    "farm_fish": 0.10, "energy": 0.02, "ores": 0.05, "metals": 0.34,
    "chemical": 0.08, "forestry": 0.25, "machinery": 0.12, "electronics": 0.00,
    "vehicles": 0.20, "aircraft": 0.00, "consumer": 0.10, "special": 0.00,
}
NAPCS_TAU_IMP = {  # CA retaliatory tariffs on US imports
    "farm_fish": 0.08, "energy": 0.02, "ores": 0.03, "metals": 0.15,
    "chemical": 0.10, "forestry": 0.10, "machinery": 0.15, "electronics": 0.05,
    "vehicles": 0.20, "aircraft": 0.00, "consumer": 0.12, "special": 0.00,
}

# NAPCS-level elasticities (from CA config industry ε, refined per-product)
NAPCS_ELAST_EXP = {
    "farm_fish": -1.19, "energy": -0.05, "ores": -0.13, "metals": -0.50,
    "chemical": -0.34, "forestry": -0.50, "machinery": -0.30, "electronics": -0.05,
    "vehicles": -2.00, "aircraft": -0.10, "consumer": -0.34, "special": -0.05,
}
NAPCS_ELAST_IMP = {
    "farm_fish": -0.05, "energy": -3.52, "ores": -0.55, "metals": -0.55,
    "chemical": -0.75, "forestry": -0.76, "machinery": -0.25, "electronics": -0.25,
    "vehicles": -1.50, "aircraft": -0.10, "consumer": -0.75, "special": -0.05,
}


def run():
    ca_data = load_ca_data()
    pt = ca_data["province_trade"]
    cfg = CA_CONFIG
    cad_usd = cfg["cad_usd"]
    provinces = cfg["regions"]

    by_napcs = {}

    for napcs in NAPCS_NAMES:
        e24 = e25 = i24 = i25 = 0
        for p in provinces:
            e24 += pt.get(p, {}).get("2024", {}).get("by_napcs", {}).get(napcs, {}).get("exports", 0)
            i24 += pt.get(p, {}).get("2024", {}).get("by_napcs", {}).get(napcs, {}).get("imports", 0)
            e25 += pt.get(p, {}).get("2025", {}).get("by_napcs", {}).get(napcs, {}).get("exports", 0)
            i25 += pt.get(p, {}).get("2025", {}).get("by_napcs", {}).get(napcs, {}).get("imports", 0)

        t24 = e24 + i24
        t25 = e25 + i25
        actual_delta = t25 - t24

        # Model: export side + import side
        tau_exp = NAPCS_TAU_EXP.get(napcs, 0.05)
        tau_imp = NAPCS_TAU_IMP.get(napcs, 0.05)
        eps_exp = NAPCS_ELAST_EXP.get(napcs, -0.5)
        eps_imp = NAPCS_ELAST_IMP.get(napcs, -0.5)

        model_exp = e24 * eps_exp * tau_exp if e24 > 0 else 0
        model_imp = i24 * eps_imp * tau_imp if i24 > 0 else 0
        model_delta = model_exp + model_imp

        by_napcs[napcs] = {
            "name": NAPCS_NAMES[napcs],
            "industry": NAPCS_TO_INDUSTRY.get(napcs, "other"),
            "exp_2024": round(e24),
            "imp_2024": round(i24),
            "trade_2024": round(t24),
            "exp_2025": round(e25),
            "imp_2025": round(i25),
            "trade_2025": round(t25),
            "actual_delta": round(actual_delta),
            "actual_pct": round(actual_delta / t24 * 100, 1) if t24 > 0 else 0,
            "model_delta": round(model_delta),
            "model_pct": round(model_delta / t24 * 100, 1) if t24 > 0 else 0,
            "tariff_exp": tau_exp,
            "tariff_imp": tau_imp,
            "elast_exp": eps_exp,
            "elast_imp": eps_imp,
        }

    # Print
    print("\n" + "=" * 95)
    print("  PNWER CA PROVINCES — PRODUCT-LEVEL IMPACT (NAPCS, CAD)")
    print(f"  Provinces: {', '.join(provinces)} | Partner: United States")
    print("=" * 95)
    print(f"\n  {'Product':<24} {'2024':>10} {'2025':>10} {'Actual Δ':>10} {'Δ%':>7} {'Model Δ':>10} {'Acc%':>6}")
    print(f"  {'-'*80}")

    total_t24 = total_t25 = total_actual = total_model = 0
    for napcs in sorted(by_napcs, key=lambda k: abs(by_napcs[k]["actual_delta"]), reverse=True):
        d = by_napcs[napcs]
        acc = d["model_delta"] / d["actual_delta"] * 100 if d["actual_delta"] != 0 else 0
        print(f"  {d['name']:<24} ${d['trade_2024']/1e6:>8,.0f}M ${d['trade_2025']/1e6:>8,.0f}M"
              f" ${d['actual_delta']/1e6:>+8,.0f}M {d['actual_pct']:>+6.1f}%"
              f" ${d['model_delta']/1e6:>+8,.0f}M {acc:>+5.0f}%")
        total_t24 += d["trade_2024"]
        total_t25 += d["trade_2025"]
        total_actual += d["actual_delta"]
        total_model += d["model_delta"]

    pct = total_actual / total_t24 * 100 if total_t24 > 0 else 0
    acc = total_model / total_actual * 100 if total_actual != 0 else 0
    print(f"  {'TOTAL':<24} ${total_t24/1e6:>8,.0f}M ${total_t25/1e6:>8,.0f}M"
          f" ${total_actual/1e6:>+8,.0f}M {pct:>+6.1f}% ${total_model/1e6:>+8,.0f}M {acc:>+5.0f}%")
    print("=" * 95)

    # By province breakdown
    print(f"\n  BY PROVINCE — Top products by impact")
    for p in provinces:
        prov_products = {}
        for napcs in NAPCS_NAMES:
            e24 = pt.get(p, {}).get("2024", {}).get("by_napcs", {}).get(napcs, {}).get("exports", 0)
            i24 = pt.get(p, {}).get("2024", {}).get("by_napcs", {}).get(napcs, {}).get("imports", 0)
            e25 = pt.get(p, {}).get("2025", {}).get("by_napcs", {}).get(napcs, {}).get("exports", 0)
            i25 = pt.get(p, {}).get("2025", {}).get("by_napcs", {}).get(napcs, {}).get("imports", 0)
            delta = (e25 + i25) - (e24 + i24)
            if abs(delta) > 1e6:
                prov_products[napcs] = delta

        if prov_products:
            top = sorted(prov_products.items(), key=lambda x: abs(x[1]), reverse=True)[:3]
            top_str = ", ".join(f"{NAPCS_NAMES[k]} ({v/1e6:+,.0f}M)" for k, v in top)
            print(f"  {cfg['region_names'][p]:<20} {top_str}")

    # JSON output
    os.makedirs(JSON_OUT, exist_ok=True)

    output = {
        "side": "CA",
        "currency": "CAD",
        "cad_usd": cad_usd,
        "provinces": provinces,
        "by_product": by_napcs,
        "totals": {
            "trade_2024": round(total_t24),
            "trade_2025": round(total_t25),
            "actual_delta": round(total_actual),
            "model_delta": round(total_model),
        },
    }

    out_path = os.path.join(JSON_OUT, "ca_product_results.json")
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"\n  → JSON saved: {out_path}")


if __name__ == "__main__":
    run()