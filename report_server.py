"""
PNWER Report Generation Server
================================
Generates LLM-powered narrative reports for:
  - Jurisdiction Trade Summary
  - Sector Impact Report

Requirements:
    pip install fastapi uvicorn anthropic

Run:
    uvicorn report_server:app --reload --port 8001

Environment:
    export ANTHROPIC_API_KEY=sk-ant-...
"""

import json
import os
from datetime import datetime
from typing import Optional

import anthropic
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

client = anthropic.Anthropic()  # Reads ANTHROPIC_API_KEY from environment


# ─────────────────────────────────────────────────────────────────────────────
# Request model
# ─────────────────────────────────────────────────────────────────────────────

class ReportRequest(BaseModel):
    report_type: str              # "jurisdiction" or "sector"
    jurisdiction_id: Optional[str] = None
    sector: Optional[str] = None
    data: dict                    # jurisdiction object OR { all_jurisdictions, hs_info }


# ─────────────────────────────────────────────────────────────────────────────
# Prompt builders
# ─────────────────────────────────────────────────────────────────────────────

def build_jurisdiction_prompt(jurisdiction_id: str, data: dict) -> str:
    sectors = data.get("sectors", {})
    sector_text = ", ".join(f"{k}: ${v}B" for k, v in sectors.items())
    jobs = data.get("jobs", 0)
    jobs_fmt = f"{jobs:,}" if isinstance(jobs, int) else str(jobs)

    return f"""You are a senior economic policy analyst writing a professional trade impact report for PNWER (Pacific Northwest Economic Region).

Generate a Jurisdiction Trade Summary for {data.get('name', jurisdiction_id)} ({jurisdiction_id}).

ACTUAL DATA (use these exact numbers):
- Total bilateral trade (2024): ${data.get('trade', 'N/A')}B
- Projected GDP impact at 25% tariff: {data.get('gdpImpact', 'N/A')}%
- Trade-supported jobs: {jobs_fmt}
- Top export commodity: {data.get('topExport', 'N/A')}
- Sector trade breakdown: {sector_text}

Return ONLY a valid JSON object — no markdown fences, no explanation, just JSON — with exactly this structure:
{{
  "executive_overview": "<2–3 paragraphs, ~180 words. Professional executive overview of this jurisdiction's bilateral trade profile and its exposure to 2025 tariff policy. Reference the specific dollar figures and GDP impact.>",
  "impact_analysis": "<1–2 paragraphs, ~120 words. Specific analysis of how the 25% tariff affects this jurisdiction — which sectors are most exposed, supply chain effects, and any USMCA exemption considerations.>",
  "risks_recommendations": [
    "<Specific risk or recommendation 1 — one sentence, actionable>",
    "<Specific risk or recommendation 2>",
    "<Specific risk or recommendation 3>",
    "<Specific risk or recommendation 4>",
    "<Specific risk or recommendation 5>"
  ]
}}

Write in professional policy language. Be specific to {data.get('name', jurisdiction_id)}'s actual data above."""


def build_sector_prompt(sector: str, data: dict) -> str:
    all_j = data.get("all_jurisdictions", [])
    hs = data.get("hs_info", {})

    jur_lines = []
    for j in all_j:
        val = j.get("sectors", {}).get(sector, 0)
        if val > 0:
            jur_lines.append(f"  - {j['name']} ({j['id']}): ${val}B")
    jur_text = "\n".join(jur_lines) if jur_lines else "  - Data unavailable"

    return f"""You are a senior economic policy analyst writing a professional trade impact report for PNWER (Pacific Northwest Economic Region).

Generate a Sector Impact Report for the {sector} sector.

ACTUAL DATA (use these exact numbers):
- HS code range: {hs.get('code', 'N/A')}
- Products analyzed: {hs.get('products', 'N/A'):,} if isinstance(hs.get('products', 0), int) else hs.get('products', 'N/A')
- Total trade at risk (25% tariff): {hs.get('risk', 'N/A')}
- {sector} bilateral trade by PNWER jurisdiction (2024):
{jur_text}

Return ONLY a valid JSON object — no markdown fences, no explanation, just JSON — with exactly this structure:
{{
  "sector_overview": "<2–3 paragraphs, ~180 words. Professional overview of the {sector} sector's role in PNWER cross-border trade, its HS code coverage, and its strategic importance to the regional economy.>",
  "economic_impact": "<1–2 paragraphs, ~120 words. Analysis of tariff impact on this sector across PNWER jurisdictions using the DID/econometric modeling framework — which jurisdictions face the greatest exposure and why.>",
  "policy_recommendations": [
    "<Specific sector-focused recommendation 1 — one sentence, actionable>",
    "<Specific recommendation 2>",
    "<Specific recommendation 3>",
    "<Specific recommendation 4>",
    "<Specific recommendation 5>"
  ]
}}

Write in professional policy language. Be specific to the {sector} sector data above."""


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/report")
async def generate_report(req: ReportRequest):
    if req.report_type not in ("jurisdiction", "sector"):
        raise HTTPException(status_code=400, detail="report_type must be 'jurisdiction' or 'sector'")

    if req.report_type == "jurisdiction" and not req.jurisdiction_id:
        raise HTTPException(status_code=400, detail="jurisdiction_id is required for jurisdiction reports")

    if req.report_type == "sector" and not req.sector:
        raise HTTPException(status_code=400, detail="sector is required for sector reports")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY environment variable is not set. "
                   "Run: export ANTHROPIC_API_KEY=sk-ant-..."
        )

    try:
        if req.report_type == "jurisdiction":
            prompt = build_jurisdiction_prompt(req.jurisdiction_id, req.data)
        else:
            prompt = build_sector_prompt(req.sector, req.data)

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1600,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text.strip()

        # Strip markdown fences if the model wrapped the JSON anyway
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        narrative = json.loads(raw)

        return {
            "report_type": req.report_type,
            "generated_at": datetime.now().isoformat(),
            "narrative": narrative,
        }

    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Claude returned malformed JSON: {str(e)}. Please try again."
        )
    except anthropic.APIError as e:
        raise HTTPException(status_code=500, detail=f"Claude API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.get("/api/health")
def health():
    key_set = bool(os.environ.get("ANTHROPIC_API_KEY"))
    return {
        "status": "ok",
        "service": "PNWER Report API",
        "api_key_configured": key_set,
    }
