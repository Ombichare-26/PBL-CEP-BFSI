from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import tempfile
import json
import os
import sys

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
