"""
PNWER Tariff Impact — Canadian Province Product-Level Analysis
Uses StatCan NAPCS data as "products" within each industry.
No HS4 for CA (StatCan doesn't provide HS4 by province in this table),
so we use NAPCS sub-categories as the product breakdown.
"""

import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from tariff_model import *
from tariff_model import CA_CONFIG

COLORS = {
    "agriculture": ["#97C459", "#639922"],
    "energy": ["#FAC775", "#BA7517", "#854F0B"],
    "forestry": ["#5DCAA5", "#1D9E75"],
    "minerals": ["#B4B2A9", "#5F5E5A", "#2C2C2A"],
    "manufacturing": ["#85B7EB", "#378ADD", "#185FA5", "#0D3F7A"],
    "other": ["#E8A0BF", "#C56C9B"],
}
OTHERS_COLOR = "#D3D1C7"

# NAPCS sub-categories → which industry they map to
NAPCS_TO_INDUSTRY = {
    "farm_fish": "agriculture",
    "energy": "energy",
    "ores": "minerals",
    "metals": "minerals",
    "chemical": "other",
    "forestry": "forestry",
    "machinery": "manufacturing",
    "electronics": "manufacturing",
    "vehicles": "manufacturing",
    "aircraft": "manufacturing",
    "consumer": "other",
    "special": "other",
}

NAPCS_NAMES = {
    "farm_fish": "Farm & fishing",
    "energy": "Energy products",
    "ores": "Metal ores",
    "metals": "Metal products",
    "chemical": "Chemicals & plastics",
    "forestry": "Forestry & building",
    "machinery": "Machinery & equipment",
    "electronics": "Electronics",
    "vehicles": "Motor vehicles & parts",
    "aircraft": "Aircraft & transport equip.",
    "consumer": "Consumer goods",
    "special": "Special transactions",
}

def run():
    ca_data = load_ca_data()
    pt = ca_data["province_trade"]
    cfg = CA_CONFIG

    out_dir = os.path.join(SCRIPT_DIR, "charts", "ca_products")
    os.makedirs(out_dir, exist_ok=True)

    print("\n" + "=" * 80)
    print("  PNWER CANADIAN PROVINCES — PRODUCT LEVEL (NAPCS)")
    print("=" * 80)

    for p in ["BC", "AB", "SK"]:
        d24 = pt.get(p, {}).get("2024", {})
        d25 = pt.get(p, {}).get("2025", {})
        bn24 = d24.get("by_napcs", {})
        bn25 = d25.get("by_napcs", {})
        bi24 = d24.get("by_industry", {})
        bi25 = d25.get("by_industry", {})

        print(f"\n  {cfg['region_names'][p]}")
        print(f"  {'-'*65}")
        print(f"  {'NAPCS':<28} {'Exp24':>7} {'Exp25':>7} {'Imp24':>7} {'Imp25':>7} {'NetChg':>8}")

        for napcs_key in sorted(bn24.keys()):
            e24 = bn24.get(napcs_key, {}).get("exports", 0)
            e25 = bn25.get(napcs_key, {}).get("exports", 0)
            i24 = bn24.get(napcs_key, {}).get("imports", 0)
            i25 = bn25.get(napcs_key, {}).get("imports", 0)
            chg = (e25 + i25) - (e24 + i24)
            name = NAPCS_NAMES.get(napcs_key, napcs_key)
            if (e24 + i24) > 1e6:
                print(f"  {name:<28} {e24/1e6:>6.0f}M {e25/1e6:>6.0f}M {i24/1e6:>6.0f}M {i25/1e6:>6.0f}M {chg/1e6:>+7.0f}M")

        # Build donut chart: industry-level losses with NAPCS breakdown
        ind_chart_data = {}

        for ind in INDUSTRIES:
            if ind == "other":
                continue
            e24 = bi24.get(ind, {}).get("exports", 0)
            e25 = bi25.get(ind, {}).get("exports", 0)
            i24 = bi24.get(ind, {}).get("imports", 0)
            i25 = bi25.get(ind, {}).get("imports", 0)
            ind_net = (e25 + i25) - (e24 + i24)
            ind_loss = max(0, -ind_net)

            if ind_loss < 1e6:
                continue

            # Find NAPCS sub-categories in this industry
            napcs_losses = {}
            for napcs_key, mapped_ind in NAPCS_TO_INDUSTRY.items():
                if mapped_ind != ind:
                    continue
                ne24 = bn24.get(napcs_key, {}).get("exports", 0)
                ne25 = bn25.get(napcs_key, {}).get("exports", 0)
                ni24 = bn24.get(napcs_key, {}).get("imports", 0)
                ni25 = bn25.get(napcs_key, {}).get("imports", 0)
                napcs_net = (ne25 + ni25) - (ne24 + ni24)
                if napcs_net < 0:
                    napcs_losses[napcs_key] = abs(napcs_net)

            sum_napcs = sum(napcs_losses.values())
            others = max(0, ind_loss - sum_napcs)

            ind_chart_data[ind] = {
                "products": napcs_losses,
                "others": others,
                "total": ind_loss,
            }

        # Generate donut charts
        n_charts = len(ind_chart_data)
        if n_charts == 0:
            continue

        cols = min(n_charts, 3)
        rows = (n_charts + cols - 1) // cols
        fig, axes = plt.subplots(rows, cols, figsize=(6 * cols, 5.5 * rows))
        if n_charts == 1:
            axes = [axes]
        elif rows == 1:
            axes = list(axes)
        else:
            axes = [ax for row in axes for ax in row]

        chart_idx = 0
        for ind, cd in ind_chart_data.items():
            if chart_idx >= len(axes):
                break
            ax = axes[chart_idx]
            chart_idx += 1

            vals = []
            labels = []
            colors = []
            ind_colors = COLORS.get(ind, ["#999", "#666", "#333"])

            sorted_prods = sorted(cd["products"].items(), key=lambda x: -x[1])
            for i, (nk, loss) in enumerate(sorted_prods):
                vals.append(loss)
                name = NAPCS_NAMES.get(nk, nk)
                pct = loss / cd["total"] * 100 if cd["total"] > 0 else 0
                labels.append(f"{name} ${loss/1e6:.0f}M ({pct:.0f}%)")
                colors.append(ind_colors[min(i, len(ind_colors) - 1)])

            if cd["others"] > 1e6:
                vals.append(cd["others"])
                pct = cd["others"] / cd["total"] * 100
                labels.append(f"Others ${cd['others']/1e6:.0f}M ({pct:.0f}%)")
                colors.append(OTHERS_COLOR)

            wedges, _ = ax.pie(vals, colors=colors, startangle=90,
                               wedgeprops=dict(width=0.38, edgecolor="white", linewidth=1.5))

            total_m = round(cd["total"] / 1e6)
            ax.text(0, 0, f"-${total_m:,}M", ha="center", va="center",
                    fontsize=14, fontweight="bold", color="#c0392b")
            ax.set_title(f"{ind.title()}", fontsize=12, fontweight="bold", pad=12)
            ax.legend(wedges, labels, loc="center left", bbox_to_anchor=(1.0, 0.5),
                      fontsize=8, frameon=False)

        for i in range(chart_idx, len(axes)):
            axes[i].axis("off")

        fig.suptitle(f"{cfg['region_names'][p]} — NAPCS Breakdown by Industry (CAD)",
                     fontsize=14, fontweight="bold", y=1.02)
        plt.tight_layout()

        out_path = os.path.join(out_dir, f"products_{p.lower()}.png")
        plt.savefig(out_path, dpi=150, bbox_inches="tight", facecolor="white")
        plt.close()
        print(f"  → Saved: {out_path}")

    print(f"\n{'='*80}")
    print(f"  CA product-level analysis complete.")
    print(f"{'='*80}")

if __name__ == "__main__":
    run()