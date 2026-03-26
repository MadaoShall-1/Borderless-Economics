"""
PNWER Five-State Industry Impact — Individual Donut Charts
Generates one PNG per state: charts/donut_wa.png, donut_or.png, etc.
"""

import json
import os
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(SCRIPT_DIR, "data", "pnwer_analysis_data_v8.json")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "charts")
os.makedirs(OUTPUT_DIR, exist_ok=True)

STATES = ["WA", "OR", "ID", "MT", "AK"]
STATE_NAMES = {"WA": "Washington", "OR": "Oregon", "ID": "Idaho", "MT": "Montana", "AK": "Alaska"}
INDUSTRIES = ["agriculture", "energy", "forestry", "minerals", "manufacturing", "other"]
INDUSTRY_LABELS = ["Agriculture", "Energy", "Forestry", "Minerals", "Manufacturing", "Other"]
COLORS = ["#639922", "#BA7517", "#1D9E75", "#5F5E5A", "#378ADD", "#D4537E"]

with open(DATA_PATH, "r", encoding="utf-8") as f:
    st = json.load(f).get("state_trade", {})

for s in STATES:
    losses = []
    trade_24, trade_25 = 0, 0
    for ind in INDUSTRIES:
        v24, v25 = 0, 0
        for p in ["CA", "MX"]:
            for flow in ["imports", "exports"]:
                v24 += st[s][p].get("2024", {}).get("by_industry", {}).get(ind, {}).get(flow, 0)
                v25 += st[s][p].get("2025", {}).get("by_industry", {}).get(ind, {}).get(flow, 0)
        trade_24 += v24
        trade_25 += v25
        losses.append(max(0, -(v25 - v24)))

    total_loss = sum(losses)
    pct = (trade_25 - trade_24) / trade_24 * 100 if trade_24 > 0 else 0

    filtered_vals, filtered_labels, filtered_colors = [], [], []
    for i, v in enumerate(losses):
        if v > 0:
            filtered_vals.append(v)
            filtered_labels.append(INDUSTRY_LABELS[i])
            filtered_colors.append(COLORS[i])

    fig, ax = plt.subplots(figsize=(6, 6))

    if not filtered_vals:
        ax.text(0.5, 0.5, "No decline", ha="center", va="center", fontsize=14, color="#888")
        ax.axis("off")
    else:
        wedges, _ = ax.pie(
            filtered_vals,
            colors=filtered_colors,
            startangle=90,
            wedgeprops=dict(width=0.38, edgecolor="white", linewidth=2),
        )

        loss_m = round(total_loss / 1e6)
        trade_25_b = round(trade_25 / 1e9, 1)
        ax.text(0, 0.06, f"-${loss_m:,}M", ha="center", va="center",
                fontsize=18, fontweight="bold", color="#c0392b")
        ax.text(0, -0.12, f"2025: ${trade_25_b}B", ha="center", va="center",
                fontsize=11, color="#666")

        legend_lines = []
        for i, v in enumerate(filtered_vals):
            p = v / total_loss * 100
            vm = round(v / 1e6)
            legend_lines.append(f"{filtered_labels[i]}: ${vm:,}M ({p:.0f}%)")

        ax.legend(wedges, legend_lines, loc="center left", bbox_to_anchor=(1.0, 0.5),
                  fontsize=10, frameon=False, handlelength=1.2, handleheight=1.2)

    trade_b = round(trade_24 / 1e9, 1)
    ax.set_title(f"{STATE_NAMES[s]}  ({pct:+.1f}%)\n2024 bilateral trade: ${trade_b}B",
                 fontsize=14, fontweight="bold", pad=16)

    out = os.path.join(OUTPUT_DIR, f"donut_{s.lower()}.png")
    plt.savefig(out, dpi=150, bbox_inches="tight", facecolor="white", transparent=False)
    plt.close()
    print(f"Saved: {out}")