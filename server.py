"""
PNWER Dashboard API Server
Run from D:\\Tariff:  uvicorn server:app --reload --port 8000

Endpoints:
  GET  /api/health              → {"status": "ok"}
  POST /api/refresh             → Fetch latest Census month, update v9 JSON
  GET  /api/forecast?ca=15&mx=12 → Run monthly forecast with given tariff rates
"""

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import sys, os, json, time, datetime
from pathlib import Path

# Add paths — adjust to your actual folder names
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(SCRIPT_DIR, "Data Collector"))
sys.path.insert(0, os.path.join(SCRIPT_DIR, "Tariff Impact"))
sys.path.insert(0, SCRIPT_DIR)

from monthly_collector import (
    detect_latest_month,
    fetch_monthly_industry,
    fetch_monthly_hs4,
    PNWER_STATES,
)

app = FastAPI(title="PNWER Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Write directly into dashboard src/data/
DATA_PATH = os.path.join(SCRIPT_DIR, "pnwer-dashboard", "src", "data", "pnwer_analysis_data_v9.json")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ═══════════════════════════════════════════════════
# REFRESH — Pull latest Census month (PNWER only)
# ═══════════════════════════════════════════════════
@app.post("/api/refresh")
def refresh():
    started_at = datetime.datetime.now()
    errors = []
    records_updated = 0

    year, month = detect_latest_month()
    month_key = f"{year}-{month:02d}"

    try:
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return {"status": "error", "month_refreshed": month_key, "errors": ["Data file not found"]}

    if "monthly_trade" not in data:
        data["monthly_trade"] = {}
    if "monthly_products" not in data:
        data["monthly_products"] = {}

    # Part A — Industry: 5 states × CA/MX
    for state in PNWER_STATES:
        for cty_code, partner in [("1220", "CA"), ("2010", "MX")]:
            try:
                exports = fetch_monthly_industry(state, cty_code, year, month, is_export=True)
                imports = fetch_monthly_industry(state, cty_code, year, month, is_export=False)
                if exports is None and imports is None:
                    errors.append(f"No data: {state}/{partner} industry"); continue
                exp_total = exports["total"] if exports else 0
                imp_total = imports["total"] if imports else 0
                exp_ind = exports["by_industry"] if exports else {}
                imp_ind = imports["by_industry"] if imports else {}
                all_inds = set(exp_ind.keys()) | set(imp_ind.keys())
                by_industry = {ind: {"exports": exp_ind.get(ind, 0), "imports": imp_ind.get(ind, 0)} for ind in all_inds}
                data["monthly_trade"].setdefault(state, {}).setdefault(partner, {})
                data["monthly_trade"][state][partner][month_key] = {
                    "exports": {"total": exp_total, **{k: v["exports"] for k, v in by_industry.items()}},
                    "imports": {"total": imp_total, **{k: v["imports"] for k, v in by_industry.items()}},
                }
                records_updated += 1
            except Exception as e:
                errors.append(f"Industry {state}/{partner}: {str(e)}")
            time.sleep(0.1)

    # Part B — Products: 5 states × CA/MX
    for state in PNWER_STATES:
        for cty_code, partner in [("1220", "CA"), ("2010", "MX")]:
            try:
                exp_hs4 = fetch_monthly_hs4(state, cty_code, year, month, is_export=True)
                imp_hs4 = fetch_monthly_hs4(state, cty_code, year, month, is_export=False)
                all_hs4 = set(exp_hs4.keys()) | set(imp_hs4.keys())
                yr_data = {hs4: {"exports": exp_hs4.get(hs4, 0), "imports": imp_hs4.get(hs4, 0)} for hs4 in all_hs4}
                data["monthly_products"].setdefault(state, {}).setdefault(partner, {})
                data["monthly_products"][state][partner][month_key] = yr_data
                records_updated += 1
            except Exception as e:
                errors.append(f"HS4 {state}/{partner}: {str(e)}")
            time.sleep(0.1)

    # Metadata
    completed_at = datetime.datetime.now()
    data["metadata"]["last_refreshed"] = completed_at.isoformat()
    data["metadata"]["refresh_month"] = month_key
    data["metadata"]["refresh_duration_seconds"] = (completed_at - started_at).total_seconds()
    rm = data["metadata"].get("refreshed_months", [])
    if month_key not in rm: rm.append(month_key); rm.sort()
    data["metadata"]["refreshed_months"] = rm

    # Atomic write
    tmp_path = DATA_PATH + ".tmp"
    try:
        Path(DATA_PATH).parent.mkdir(parents=True, exist_ok=True)
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, DATA_PATH)
    except Exception as e:
        errors.append(f"Write failed: {str(e)}")

    # Auto-run forecast after refresh
    forecast_result = None
    try:
        from run_forecast import forecast_next_month, save_forecast
        forecast_result = forecast_next_month(data=data)
        if "error" not in forecast_result:
            save_forecast(forecast_result)
    except Exception as e:
        errors.append(f"Forecast: {str(e)}")

    return {
        "status": "success" if not errors else "partial",
        "timestamp": completed_at.isoformat(),
        "month_refreshed": month_key,
        "records_updated": records_updated,
        "duration_seconds": round((completed_at - started_at).total_seconds(), 1),
        "forecast": forecast_result.get("metadata", {}) if forecast_result else None,
        "errors": errors,
    }


# ═══════════════════════════════════════════════════
# FORECAST — Run prediction with custom tariff rates
# ═══════════════════════════════════════════════════
@app.get("/api/forecast")
def forecast(
    ca: float = Query(default=None, description="CA tariff rate (%)"),
    mx: float = Query(default=None, description="MX tariff rate (%)"),
):
    try:
        from run_forecast import forecast_next_month, save_forecast
        result = forecast_next_month(tariff_ca=ca, tariff_mx=mx)
        if "error" not in result:
            save_forecast(result)
        return result
    except Exception as e:
        return {"error": str(e)}


# ═══════════════════════════════════════════════════
# REPORT — Proxy to Anthropic API (avoids CORS)
# ═══════════════════════════════════════════════════
from fastapi import Request

@app.post("/api/report")
async def generate_report(request: Request):
    try:
        import httpx
        body = await request.json()

        # Try Groq first (free), then Anthropic as fallback
        groq_key = os.environ.get("GROQ_API_KEY", "")
        anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")

        async with httpx.AsyncClient(timeout=120) as client:
            if groq_key:
                # Convert Anthropic format → Groq/OpenAI format
                messages = []
                if body.get("system"):
                    messages.append({"role": "system", "content": body["system"]})
                messages.extend(body.get("messages", []))

                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {groq_key}",
                    },
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": messages,
                        "max_tokens": body.get("max_tokens", 4000),
                        "temperature": 0.3,
                        # Force strict JSON output so the frontend parser never
                        # has to strip prose/markdown around the object.
                        "response_format": {"type": "json_object"},
                    },
                )
                data = resp.json()
                # Convert Groq response → Anthropic format (so frontend works)
                if "choices" in data and data["choices"]:
                    text = data["choices"][0]["message"]["content"]
                    return {"content": [{"type": "text", "text": text}]}
                elif "error" in data:
                    return {"error": data["error"]}
                return data

            elif anthropic_key:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "Content-Type": "application/json",
                        "x-api-key": anthropic_key,
                        "anthropic-version": "2023-06-01",
                    },
                    json=body,
                )
                return resp.json()

            else:
                return {"error": "No API key set. Run: $env:GROQ_API_KEY='gsk_...' or $env:ANTHROPIC_API_KEY='sk-ant-...'"}

    except Exception as e:
        return {"error": str(e)}