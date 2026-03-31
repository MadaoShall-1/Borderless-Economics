"""
PNWER Dashboard — Backend API
------------------------------
FastAPI server exposing trade data and the /api/refresh endpoint.

Run:
    uvicorn api:app --reload --port 8000

Endpoints:
    GET  /api/data          → serves pnwer_analysis_data_v9.json
    POST /api/refresh       → triggers 2025 data refresh (non-blocking)
    GET  /api/refresh/status → polls refresh job status
    GET  /api/health        → health check
"""

import threading
import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import os

from refresh_pipeline import refresh_current_year

# ============================================================================
# App Setup
# ============================================================================

app = FastAPI(title="PNWER Trade Impact API", version="1.0.0")

# Allow React dev server (port 5173 for Vite) and production origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # CRA dev server (if applicable)
        "*",                       # Remove in production; replace with real domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = os.environ.get("PNWER_DATA_PATH", "../data/pnwer_analysis_data_v9.json")

# ============================================================================
# In-Memory Refresh State
# Tracks whether a refresh job is running and its last result.
# Persists for the lifetime of the server process.
# ============================================================================

refresh_state = {
    "running": False,
    "started_at": None,
    "progress": {
        "step": None,
        "current": 0,
        "total": 0,
        "percent": 0,
    },
    "last_result": None,   # populated after each completed run
}
refresh_lock = threading.Lock()


def _run_refresh():
    """
    Worker function executed in a background thread.
    Updates refresh_state throughout the run so the frontend
    can poll /api/refresh/status for live progress.
    """
    def on_progress(step: str, current: int, total: int):
        refresh_state["progress"] = {
            "step": step,
            "current": current,
            "total": total,
            "percent": round(current / total * 100) if total > 0 else 0,
        }

    try:
        result = refresh_current_year(data_path=DATA_PATH, on_progress=on_progress)
    except Exception as e:
        result = {
            "status": "error",
            "timestamp": datetime.datetime.now().isoformat(),
            "month_refreshed": None,
            "records_updated": 0,
            "errors": [f"Unhandled exception: {str(e)}"],
        }
    finally:
        with refresh_lock:
            refresh_state["running"] = False
            refresh_state["started_at"] = None
            refresh_state["last_result"] = result
            refresh_state["progress"] = {
                "step": "Complete" if result["status"] != "error" else "Failed",
                "current": 0,
                "total": 0,
                "percent": 100 if result["status"] == "success" else 0,
            }


# ============================================================================
# Endpoints
# ============================================================================

@app.get("/api/health")
def health():
    data_exists = Path(DATA_PATH).exists()
    return {
        "status": "ok",
        "data_file_exists": data_exists,
        "refresh_running": refresh_state["running"],
    }


@app.get("/api/data")
def get_data():
    """
    Serves the full pnwer_analysis_data_v9.json to the frontend.
    This is what the React dashboard loads on mount and re-fetches
    after a successful refresh.
    """
    try:
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return JSONResponse(content=data)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Data file not found at {DATA_PATH}. "
                   "Run the full collector first (python census_data_collector.py).",
        )
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Data file is corrupted: {str(e)}",
        )


@app.post("/api/refresh")
def trigger_refresh():
    """
    Starts a background refresh of 2025 data.

    Returns 409 if a refresh is already running — prevents double-triggering.
    Returns 202 Accepted immediately; poll /api/refresh/status for progress.
    """
    with refresh_lock:
        if refresh_state["running"]:
            return JSONResponse(
                status_code=409,
                content={
                    "status": "already_running",
                    "message": "A refresh is already in progress. "
                               "Poll /api/refresh/status for updates.",
                    "started_at": refresh_state["started_at"],
                },
            )

        refresh_state["running"] = True
        refresh_state["started_at"] = datetime.datetime.now().isoformat()
        refresh_state["last_result"] = None
        refresh_state["progress"] = {
            "step": "Starting...",
            "current": 0,
            "total": 100,
            "percent": 0,
        }

    thread = threading.Thread(target=_run_refresh, daemon=True)
    thread.start()

    return JSONResponse(
        status_code=202,
        content={
            "status": "started",
            "message": "Refresh started. Poll /api/refresh/status every 5 seconds.",
            "started_at": refresh_state["started_at"],
        },
    )


@app.get("/api/refresh/status")
def get_refresh_status():
    """
    Returns the current state of the refresh job.

    Frontend should poll this every 5 seconds after triggering a refresh.
    When running=false AND last_result is populated, the job is done.

    Response shape:
    {
      "running": bool,
      "started_at": str | null,
      "progress": {
        "step": str,
        "current": int,
        "total": int,
        "percent": int        ← use this to drive the progress bar
      },
      "last_result": {
        "status": "success" | "partial" | "error",
        "timestamp": str,
        "month_refreshed": str,
        "records_updated": int,
        "errors": [str]
      } | null
    }
    """
    return JSONResponse(content=refresh_state)
