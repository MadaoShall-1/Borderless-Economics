"""
PNWER Report Generation Server
================================
Generates reports for:
  - Jurisdiction Trade Summary
  - Sector Impact Report

Modes:
  - LLM mode  : set ANTHROPIC_API_KEY → Claude writes the narrative
  - Demo mode : no key needed         → template-based narrative from real data

Requirements:
    pip install fastapi uvicorn anthropic

Run:
    uvicorn report_server:app --reload --port 8001
"""

import json
import os
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="PNWER Report API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEMO_MODE = not bool(os.environ.get("ANTHROPIC_API_KEY"))


# ─────────────────────────────────────────────────────────────────────────────
# Request model
# ─────────────────────────────────────────────────────────────────────────────

class ReportRequest(BaseModel):
    report_type: str
    jurisdiction_id: Optional[str] = None
    sector: Optional[str] = None
    data: dict


# ─────────────────────────────────────────────────────────────────────────────
# Demo mode: template-based narrative (no API key required)
# ─────────────────────────────────────────────────────────────────────────────

def demo_jurisdiction_narrative(jurisdiction_id: str, data: dict) -> dict:
    name = data.get("name", jurisdiction_id)
    trade = data.get("trade", "N/A")
    gdp = data.get("gdpImpact", "N/A")
    jobs = data.get("jobs", 0)
    jobs_fmt = f"{jobs:,}" if isinstance(jobs, int) else str(jobs)
    top_export = data.get("topExport", "N/A")
    sectors = data.get("sectors", {})

    top_sector = max(sectors, key=sectors.get) if sectors else "Manufacturing"
    top_sector_val = sectors.get(top_sector, 0)
    sector_list = ", ".join(f"{k} (${v}B)" for k, v in sectors.items())

    return {
        "executive_overview": (
            f"{name} maintains a bilateral trade portfolio of ${trade}B with Canada and Mexico, "
            f"making it one of the most trade-integrated jurisdictions in the PNWER region. "
            f"The jurisdiction's top export commodity — {top_export} — anchors cross-border supply chains "
            f"that have deepened significantly since the implementation of USMCA in 2020.\n\n"
            f"Under the current 25% tariff regime, econometric modeling projects a GDP contraction of {gdp}% "
            f"for {name}, with approximately {jobs_fmt} trade-supported jobs facing near-term uncertainty. "
            f"The {top_sector} sector, representing ${top_sector_val}B in bilateral flows, carries the highest "
            f"single-sector exposure and warrants targeted policy attention.\n\n"
            f"This report synthesises Census Bureau bilateral trade data, BEA RIMS II multipliers, and "
            f"Difference-in-Differences econometric modelling to quantify tariff exposure across {name}'s "
            f"key industries: {sector_list}."
        ),
        "impact_analysis": (
            f"At a 25% tariff rate, {name} faces a projected trade value decline driven primarily by "
            f"the {top_sector} sector, which accounts for the largest share of bilateral flows at "
            f"${top_sector_val}B. Tariff passthrough rates — estimated at 85–90% for manufactured goods "
            f"and commodities — mean that cost increases will rapidly materialise for downstream buyers "
            f"on both sides of the border.\n\n"
            f"USMCA rules-of-origin provisions offer partial relief: goods meeting USMCA preferential "
            f"origin requirements may qualify for exemption, with approximately 49% of Mexico-origin "
            f"imports eligible. However, Canadian imports face a more constrained exemption pathway, "
            f"leaving {name}'s Canada-facing trade — particularly in energy and agriculture — fully exposed "
            f"to the 25% rate (10% for Canadian energy products)."
        ),
        "risks_recommendations": [
            f"Conduct a rapid USMCA rules-of-origin audit across {name}'s top 50 export HS codes to maximise tariff exemption claims before Q3 2025.",
            f"Establish a {name} trade disruption fund targeting the {top_sector} sector, prioritising firms with >60% revenue exposure to Canada or Mexico.",
            f"Engage federal trade representatives to seek sector-specific carve-outs for {top_export}, given its strategic role in cross-border supply chains.",
            f"Accelerate trade diversification outreach to non-USMCA markets (EU, CPTPP members) to reduce bilateral concentration risk.",
            f"Commission a joint workforce impact study with labour agencies to build an early-warning system for the {jobs_fmt} trade-supported jobs at risk.",
        ],
    }


def demo_sector_narrative(sector: str, data: dict) -> dict:
    all_j = data.get("all_jurisdictions", [])
    hs = data.get("hs_info", {})

    products = hs.get("products", 0)
    hs_code = hs.get("code", "N/A")
    risk = hs.get("risk", "N/A")

    jur_with_sector = sorted(
        [(j["name"], j["id"], j.get("sectors", {}).get(sector, 0)) for j in all_j if j.get("sectors", {}).get(sector, 0) > 0],
        key=lambda x: -x[2],
    )
    top_jur = jur_with_sector[0] if jur_with_sector else ("N/A", "N/A", 0)
    jur_summary = ", ".join(f"{name} (${val}B)" for name, _, val in jur_with_sector[:5])
    total_sector_trade = sum(v for _, _, v in jur_with_sector)

    sector_context = {
        "Agriculture": "feeding cross-border food systems and rural economies throughout the Pacific Northwest",
        "Manufacturing": "anchoring industrial supply chains that span both sides of the US-Canada border",
        "Energy": "powering cross-border electricity grids and fossil fuel pipelines critical to regional economic stability",
        "Forestry": "sustaining lumber and wood-product supply chains that underpin construction markets across North America",
    }
    context = sector_context.get(sector, "supporting key PNWER cross-border trade flows")

    return {
        "sector_overview": (
            f"The {sector} sector is one of the foundational pillars of PNWER cross-border trade, {context}. "
            f"Covering {products:,} distinct HS product codes ({hs_code}), the sector generates an estimated "
            f"${total_sector_trade:.1f}B in annual bilateral trade across the region's 10 jurisdictions.\n\n"
            f"The largest {sector} trading jurisdictions within PNWER are {jur_summary}, reflecting the "
            f"geographic concentration of sector activity along established cross-border corridors. "
            f"These flows are deeply integrated with Canadian and Mexican counterpart industries, with "
            f"supply chains often crossing the border multiple times before final delivery.\n\n"
            f"Under current tariff conditions, the sector faces total trade-at-risk exposure of {risk}, "
            f"based on Census Bureau bilateral data and BEA RIMS II economic multiplier modelling. "
            f"The breadth of HS code coverage ({products:,} products) means that tariff effects are "
            f"widely distributed across product categories and trading partners."
        ),
        "economic_impact": (
            f"Difference-in-Differences (DID) modelling — comparing USMCA treatment states against "
            f"non-USMCA control states over 2017–2025 — isolates a statistically significant negative "
            f"treatment effect on {sector} trade following the 2025 tariff imposition. "
            f"{top_jur[0]} ({top_jur[1]}), with ${top_jur[2]}B in {sector} bilateral flows, faces the "
            f"largest absolute exposure within the PNWER region.\n\n"
            f"BEA RIMS II Type II multipliers indicate that each dollar of {sector} trade loss generates "
            f"additional indirect and induced economic contractions in regional supply chains. "
            f"Employment multipliers project meaningful job losses concentrated in rural and border "
            f"communities most dependent on {sector.lower()} activity, with limited short-run substitution "
            f"capacity given existing infrastructure commitments."
        ),
        "policy_recommendations": [
            f"Negotiate a sector-specific {sector} carve-out within USMCA renegotiation talks, citing the sector's deep supply-chain integration across all 10 PNWER jurisdictions.",
            f"Create a PNWER {sector} Trade Adjustment Assistance programme to support firms and workers in the {top_jur[0]} corridor, the highest-exposure jurisdiction.",
            f"Accelerate cross-border {sector.lower()} infrastructure investment to reduce per-unit trade costs and partially offset tariff-driven price increases.",
            f"Establish a real-time {sector} trade monitoring dashboard using Census Bureau IM-145/145 data to track monthly tariff pass-through and alert policymakers to escalating disruption.",
            f"Convene a PNWER {sector} Task Force with state, provincial, and federal representatives to coordinate a unified advocacy position ahead of the July 2026 USMCA review.",
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# LLM mode: Claude-generated narrative
# ─────────────────────────────────────────────────────────────────────────────

def llm_jurisdiction_narrative(jurisdiction_id: str, data: dict) -> dict:
    import anthropic

    sectors = data.get("sectors", {})
    sector_text = ", ".join(f"{k}: ${v}B" for k, v in sectors.items())
    jobs = data.get("jobs", 0)
    jobs_fmt = f"{jobs:,}" if isinstance(jobs, int) else str(jobs)

    prompt = f"""You are a senior economic policy analyst writing a professional trade impact report for PNWER.

Generate a Jurisdiction Trade Summary for {data.get('name', jurisdiction_id)} ({jurisdiction_id}).

ACTUAL DATA:
- Total bilateral trade (2024): ${data.get('trade', 'N/A')}B
- Projected GDP impact at 25% tariff: {data.get('gdpImpact', 'N/A')}%
- Trade-supported jobs: {jobs_fmt}
- Top export commodity: {data.get('topExport', 'N/A')}
- Sector trade breakdown: {sector_text}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{{
  "executive_overview": "2-3 paragraphs, ~180 words, professional executive overview referencing specific figures",
  "impact_analysis": "1-2 paragraphs, ~120 words, specific tariff impact analysis",
  "risks_recommendations": ["actionable item 1", "item 2", "item 3", "item 4", "item 5"]
}}"""

    client = anthropic.Anthropic()
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1600,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1].lstrip("json").strip()
    return json.loads(raw)


def llm_sector_narrative(sector: str, data: dict) -> dict:
    import anthropic

    all_j = data.get("all_jurisdictions", [])
    hs = data.get("hs_info", {})
    jur_lines = "\n".join(
        f"  - {j['name']} ({j['id']}): ${j.get('sectors', {}).get(sector, 0)}B"
        for j in all_j if j.get("sectors", {}).get(sector, 0) > 0
    )

    prompt = f"""You are a senior economic policy analyst writing a PNWER sector impact report.

Generate a Sector Impact Report for the {sector} sector.

ACTUAL DATA:
- HS code range: {hs.get('code', 'N/A')}
- Products analyzed: {hs.get('products', 0):,}
- Total trade at risk (25% tariff): {hs.get('risk', 'N/A')}
- {sector} bilateral trade by PNWER jurisdiction:
{jur_lines}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{{
  "sector_overview": "2-3 paragraphs, ~180 words, professional sector overview",
  "economic_impact": "1-2 paragraphs, ~120 words, economic modelling analysis",
  "policy_recommendations": ["recommendation 1", "recommendation 2", "recommendation 3", "recommendation 4", "recommendation 5"]
}}"""

    client = anthropic.Anthropic()
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1600,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1].lstrip("json").strip()
    return json.loads(raw)


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/report")
async def generate_report(req: ReportRequest):
    if req.report_type not in ("jurisdiction", "sector"):
        raise HTTPException(status_code=400, detail="report_type must be 'jurisdiction' or 'sector'")
    if req.report_type == "jurisdiction" and not req.jurisdiction_id:
        raise HTTPException(status_code=400, detail="jurisdiction_id is required")
    if req.report_type == "sector" and not req.sector:
        raise HTTPException(status_code=400, detail="sector is required")

    try:
        if DEMO_MODE:
            if req.report_type == "jurisdiction":
                narrative = demo_jurisdiction_narrative(req.jurisdiction_id, req.data)
            else:
                narrative = demo_sector_narrative(req.sector, req.data)
        else:
            if req.report_type == "jurisdiction":
                narrative = llm_jurisdiction_narrative(req.jurisdiction_id, req.data)
            else:
                narrative = llm_sector_narrative(req.sector, req.data)

        return {
            "report_type": req.report_type,
            "generated_at": datetime.now().isoformat(),
            "demo_mode": DEMO_MODE,
            "narrative": narrative,
        }

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse LLM response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "PNWER Report API",
        "mode": "demo" if DEMO_MODE else "llm",
        "api_key_configured": not DEMO_MODE,
    }
