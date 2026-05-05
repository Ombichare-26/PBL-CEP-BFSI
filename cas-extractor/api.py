from fastapi import FastAPI, UploadFile, File, HTTPException
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
import requests
from datetime import datetime, timedelta
from math import sqrt
from threading import Lock
from cas_extractor import extract_portfolio

app = FastAPI()
RISK_HISTORY_WINDOW_DAYS = 365 * 5
FUND_HISTORY_CACHE_TTL_SECONDS = 300
_fund_history_cache = {}
_fund_history_cache_lock = Lock()



app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",

        "http://localhost:5174",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import time

@app.post("/extract-cas")
async def extract_cas(file: UploadFile = File(...)):
    start_time = time.time()
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    tmp_path = None
    try:
        print(f" Starting extraction for {file.filename}...")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        results = extract_portfolio(tmp_path, include_risk_lookup=False)
        end_time = time.time()
        print(f" Extraction complete in {end_time - start_time:.2f}s. Found {len(results)} schemes.")
        return results
    except Exception as e:
        print(f" Extraction failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

def normalize_category_risk_score(category: str) -> int:
    value = str(category or "").strip().upper()
    if not value:
        return 3
    if value == "SMALL" or "SMALL CAP" in value or "MICRO CAP" in value:
        return 6
    if any(token in value for token in ["MID CAP", "SECTORAL", "THEMATIC", "FOCUSED", "INTERNATIONAL", "COMMODITY"]):
        return 5
    if value in {"ETF", "FLEXI"} or any(token in value for token in ["FLEXI", "MULTI CAP", "LARGE CAP", "ELSS", "INDEX", "ETF", "VALUE", "CONTRA"]):
        return 4
    if any(token in value for token in ["HYBRID", "BALANCED", "EQUITY SAVINGS", "ARBITRAGE", "MULTI ASSET"]):
        return 3
    if any(token in value for token in ["GILT", "CORPORATE BOND", "BANKING", "PSU", "SHORT DURATION", "MEDIUM DURATION", "DYNAMIC BOND"]):
        return 2
    if any(token in value for token in ["OVERNIGHT", "LIQUID", "MONEY MARKET", "ULTRA SHORT"]):
        return 1
    return 3 if value == "OTHER" else 4

def get_volatility_bucket_score(volatility_pct: float) -> int:
    value = max(0.0, float(volatility_pct or 0))
    if value <= 2:
        return 1
    if value <= 5:
        return 2
    if value <= 10:
        return 3
    if value <= 15:
        return 4
    if value <= 22:
        return 5
    return 6

def get_drawdown_bucket_score(drawdown_pct: float) -> int:
    value = max(0.0, float(drawdown_pct or 0))
    if value <= 2:
        return 1
    if value <= 5:
        return 2
    if value <= 10:
        return 3
    if value <= 20:
        return 4
    if value <= 30:
        return 5
    return 6

def risk_label_from_score(score: int) -> str:
    return {
        1: "LOW",
        2: "LOW_TO_MODERATE",
        3: "MODERATE",
        4: "MODERATELY_HIGH",
        5: "HIGH",
        6: "VERY_HIGH",
    }.get(max(1, min(6, int(round(score)))), "UNKNOWN")

def calculate_annualized_volatility(nav_points: list[float]):
    if len(nav_points) < 3:
        return None
    returns = []
    for index in range(1, len(nav_points)):
        prev_nav = float(nav_points[index - 1] or 0)
        curr_nav = float(nav_points[index] or 0)
        if prev_nav <= 0 or curr_nav <= 0:
            continue
        returns.append((curr_nav - prev_nav) / prev_nav)
    if len(returns) < 2:
        return None
    mean = sum(returns) / len(returns)
    variance = sum((ret - mean) ** 2 for ret in returns) / (len(returns) - 1)
    return round((sqrt(max(variance, 0)) * sqrt(252) * 100), 2)#round off to 2 decimal places and annulize it....

def calculate_max_drawdown(nav_points: list[float]):
    if not nav_points:
        return None
    peak = float(nav_points[0] or 0)
    max_drawdown = 0.0
    for nav in nav_points:
        nav = float(nav or 0)
        if nav <= 0:
            continue
        peak = max(peak, nav)
        if peak > 0:
            max_drawdown = max(max_drawdown, ((peak - nav) / peak) * 100)
    return round(max_drawdown, 2)

def derive_risk_metrics(category: str, nav_points: list[float], source_url: str = "", as_of_date: Optional[str] = None):
    volatility_pct = calculate_annualized_volatility(nav_points)
    max_drawdown_pct = calculate_max_drawdown(nav_points)
    category_score = normalize_category_risk_score(category)
    volatility_score = get_volatility_bucket_score(volatility_pct or 0)
    drawdown_score = get_drawdown_bucket_score(max_drawdown_pct or 0)

    derived_score = round((category_score * 0.4) + (volatility_score * 0.3) + (drawdown_score * 0.3))
    if category_score >= 5 and (volatility_score >= 5 or drawdown_score >= 5):
        derived_score = max(derived_score, 5)
    if category_score <= 2 and volatility_score <= 2 and drawdown_score <= 2:
        derived_score = min(derived_score, 2)

    derived_score = max(1, min(6, derived_score))
    return {
        "category": category,
        "categoryScore": category_score,
        "volatilityPct": volatility_pct,
        "volatilityScore": volatility_score,
        "maxDrawdownPct": max_drawdown_pct,
        "drawdownScore": drawdown_score,
        "derivedRiskScore": derived_score,
        "derivedRiskLevel": risk_label_from_score(derived_score),
        "sourceType": "DERIVED_HISTORY_MODEL",
        "sourceUrl": source_url,
        "asOfDate": as_of_date,
    }


#fund history endpoint with caching and risk metrics 
@app.get("/fund-history/{amfi_code}")
async def get_fund_history(amfi_code: str, period: str = "1m"):
    try:
        cache_key = (str(amfi_code).strip(), str(period).strip().lower())
        now = datetime.utcnow()
        with _fund_history_cache_lock:
            cached_entry = _fund_history_cache.get(cache_key)
            if cached_entry and cached_entry["expires_at"] > now:
                return cached_entry["payload"]

        url = f"https://api.mfapi.in/mf/{amfi_code}"#111234
        res = requests.get(url, timeout=10)

        if res.status_code != 200:
            if res.status_code == 404:
                raise HTTPException(status_code=404, detail="Fund not found")
            else:
                raise HTTPException(
                    status_code=502,
                    detail=f"Upstream Mutual Fund API returned error {res.status_code}. It might be temporarily down."
                )

        data = res.json()
        historical = data.get("data", [])
        meta = data.get("meta", {})

        if not historical:
            return {"data": []}

        # Convert dates properly
        for item in historical:
            item["date_obj"] = datetime.strptime(item["date"], "%d-%m-%Y")

        historical.sort(key=lambda x: x["date_obj"])

        today = datetime.today()

        if period == "1d":
            start_date = today - timedelta(days=1)
        elif period == "1m":
            start_date = today - timedelta(days=30)
        elif period == "3m":
            start_date = today - timedelta(days=90)
        elif period == "1y":
            start_date = today - timedelta(days=365)
        elif period == "5y":
            start_date = today - timedelta(days=365 * 5)
        else:
            start_date = today - timedelta(days=30)

        filtered = [
            {
                "date": item["date_obj"].strftime("%Y-%m-%d"),
                "nav": float(item["nav"])
            }
            for item in historical
            if item["date_obj"] >= start_date
        ]

        # Current NAV
        latest_nav = float(historical[-1]["nav"])

        # Previous day NAV for day change
        if len(historical) > 1:
            prev_nav = float(historical[-2]["nav"])
            day_change = ((latest_nav - prev_nav) / prev_nav) * 100
        else:
            day_change = 0

        category = (
            meta.get("scheme_category")
            or meta.get("scheme_type")
            or ""
        )
        latest_history_date = historical[-1]["date_obj"] if historical else None
        risk_window_start = (
            latest_history_date - timedelta(days=RISK_HISTORY_WINDOW_DAYS)
            if latest_history_date
            else None
        )
        risk_window_history = [
            item for item in historical
            if not risk_window_start or item["date_obj"] >= risk_window_start
        ]

        risk_metrics = derive_risk_metrics(
            category,
            [float(item["nav"]) for item in risk_window_history if item.get("nav")],
            source_url=url,
            as_of_date=latest_history_date.strftime("%Y-%m-%d") if latest_history_date else None,
        )
        risk_metrics["windowStartDate"] = (
            risk_window_history[0]["date_obj"].strftime("%Y-%m-%d")
            if risk_window_history
            else None
        )

        payload = {
            "data": filtered,
            "currentNav": latest_nav,
            "dayChange": round(day_change, 2),
            "riskMetrics": risk_metrics,
        }
        with _fund_history_cache_lock:
            _fund_history_cache[cache_key] = {
                "payload": payload,
                "expires_at": now + timedelta(seconds=FUND_HISTORY_CACHE_TTL_SECONDS),
            }
        return payload

    except HTTPException:
        raise
    except requests.exceptions.RequestException as e:
        print(f"❌ Upstream MF API error for {amfi_code}: {e}")
        raise HTTPException(
            status_code=502,
            detail="Upstream Mutual Fund API is currently unavailable or timed out. Please try again later."
        )
    except Exception as e:
        print(f"❌ Internal server error in fund-history for {amfi_code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
