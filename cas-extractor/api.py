from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import tempfile
import json
import os
import sys
import requests
from datetime import datetime, timedelta
app = FastAPI()



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

@app.post("/extract-cas")
async def extract_cas(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        # Get the directory where this script is located
        script_dir = os.path.dirname(os.path.abspath(__file__))
        cas_extractor_path = os.path.join(script_dir, "cas_extractor.py")
        
        result = subprocess.run(
            [sys.executable, cas_extractor_path, tmp_path],
            capture_output=True,
            text=True,
            check=True,
            cwd=script_dir  # Set working directory to script location
        )

        os.remove(tmp_path)

        return json.loads(result.stdout)

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Python interpreter not found: {e}. Please ensure Python is installed and in PATH."
        )
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=500,
            detail=f"CAS extraction failed: {e.stderr or e.stdout or 'Unknown error'}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )
@app.get("/fund-history/{amfi_code}")
async def get_fund_history(amfi_code: str, period: str = "1m"):
    try:
        url = f"https://api.mfapi.in/mf/{amfi_code}"
        res = requests.get(url, timeout=10)

        if res.status_code != 200:
            raise HTTPException(status_code=404, detail="Fund not found")

        data = res.json()
        historical = data.get("data", [])

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

        return {
            "data": filtered,
            "currentNav": latest_nav,
            "dayChange": round(day_change, 2)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))