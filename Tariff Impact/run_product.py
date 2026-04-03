"""
PNWER Tariff Impact — Product-Level Analysis
HS4 product detail within each industry, with donut charts showing product vs others.
Oil price adjustment is handled in run_industry.py only (to avoid double-counting).
"""

import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from tariff_model import *

def run():
    data = load_data()
    st = data["state_trade"]
    pt = data["product_trade"]
    fp = data["focus_products"]

    out_dir = os.path.join(SCRIPT_DIR, "charts", "products")
    os.makedirs(out_dir, exist_ok=True)

    COLORS = {
        "agriculture": ["#97C459", "#639922", "#3B6D11"],
        "energy": ["#FAC775", "#BA7517", "#854F0B"],
        "forestry": ["#5DCAA5", "#1D9E75", "#0F6E56"],
        "minerals": ["#B4B2A9", "#5F5E5A", "#2C2C2A"],
        "manufacturing": ["#85B7EB", "#378ADD", "#185FA5"],
    }
    OTHERS_COLOR = "#D3D1C7"

    print("\n" + "=" * 80)
    print("  PNWER TARIFF IMPACT — PRODUCT LEVEL (HS4)")
    print("  Note: Oil price effect excluded (reported in industry-level decomposition)")
    print("=" * 80)

    grand = {}  # unused, kept for compatibility

    for s in PNWER_STATES:
        state_fp = fp.get(s, {})
        print(f"\n  {STATE_NAMES[s]}")
        print(f"  {'-'*65}")
        print(f"  {'HS4':<6} {'Product':<22} {'τ%':>4} {'Base':>8} {'Model':>8} {'Actual':>8}")

        ind_chart_data = {}

        for ind in INDUSTRIES:
            if ind == "other":
                continue
            hs4_map = state_fp.get(ind, {})
            if not hs4_map:
                continue

            # Industry net change from state_trade (across all partners)
            ind_net_change = 0
            for p in ["CA", "MX"]:
                i24 = get_val(st, s, p, "2024", "imports", ind)
                i25 = get_val(st, s, p, "2025", "imports", ind)
                e24 = get_val(st, s, p, "2024", "exports", ind)
                e25 = get_val(st, s, p, "2025", "exports", ind)
                ind_net_change += (i25 + e25) - (i24 + e24)
            ind_total_loss = max(0, -ind_net_change)

            product_losses = {}

            for hs4, pname in hs4_map.items():
                prod_loss = 0
                prod_model = 0
                prod_actual = 0
                prod_base = 0

                for p in ["CA", "MX"]:
                    i24 = get_product_val(pt, s, p, "2024", hs4, "imports")
                    i25 = get_product_val(pt, s, p, "2025", hs4, "imports")
                    if i24 > 0:
                        m = product_import_change(i24, p, hs4, ind)
                        a = i25 - i24
                        prod_model += m; prod_actual += a; prod_base += i24

                    e24 = get_product_val(pt, s, p, "2024", hs4, "exports")
                    e25 = get_product_val(pt, s, p, "2025", hs4, "exports")
                    if e24 > 0:
                        m = product_export_change(e24, p, hs4, ind)
                        a = e25 - e24
                        prod_model += m; prod_actual += a; prod_base += e24

                    chg_i = (i25 - i24) if i24 > 0 else 0
                    chg_e = (e25 - e24) if e24 > 0 else 0
                    prod_loss += chg_i + chg_e

                prod_loss_final = max(0, -prod_loss) if prod_loss < 0 else 0

                if prod_base > 1e6:
                    tau_avg = 0
                    for p in ["CA", "MX"]:
                        tau_avg += HS4_TARIFFS.get(hs4, {}).get("imp", {}).get(p, 0)
                    tau_avg /= 2
                    print(f"  {hs4:<6} {pname[:20]:<22} {tau_avg*100:>3.0f}%"
                          f" {prod_base/1e6:>7.0f}M"
                          f" {prod_model/1e6:>+7.0f}M"
                          f" {prod_actual/1e6:>+7.0f}M")

                if prod_loss_final > 0:
                    product_losses[hs4] = prod_loss_final

            sum_prod_loss = sum(product_losses.values())
            others = max(0, ind_total_loss - sum_prod_loss)

            if ind_total_loss > 1e6:
                ind_chart_data[ind] = {
                    "products": product_losses,
                    "others": others,
                    "total": ind_total_loss,
                }

        # ======== Donut charts ========
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
            for i, (hs4, loss) in enumerate(sorted_prods):
                vals.append(loss)
                pname = state_fp.get(ind, {}).get(hs4, hs4)
                pct = loss / cd["total"] * 100 if cd["total"] > 0 else 0
                labels.append(f"{pname} ${loss/1e6:.0f}M ({pct:.0f}%)")
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

        fig.suptitle(f"{STATE_NAMES[s]} — Product Breakdown by Industry",
                     fontsize=14, fontweight="bold", y=1.02)
        plt.tight_layout()

        out_path = os.path.join(out_dir, f"products_{s.lower()}.png")
        plt.savefig(out_path, dpi=150, bbox_inches="tight", facecolor="white")
        plt.close()
        print(f"  → Saved: {out_path}")

    print(f"\n{'='*80}")
    print(f"  Product-level analysis complete. Per-state donut charts saved.")
    print(f"{'='*80}")

if __name__ == "__main__":
    run()