# import pdfplumber
# import pandas as pd

# PDF_PATH = "cas_summary_report_2026_01_14_175808.pdf"
# OUTPUT_CSV = "portfolio_holdings.csv"

# def extract_tables_from_pdf(pdf_path):
#     all_rows = []

#     with pdfplumber.open(pdf_path) as pdf:
#         for page_no, page in enumerate(pdf.pages, start=1):
#             tables = page.extract_tables()

#             if not tables:
#                 continue

#             for table in tables:
#                 # remove empty rows
#                 table = [row for row in table if row and any(cell and cell.strip() for cell in row)]

#                 # check if it looks like holdings table
#                 header_text = " ".join([str(x) for x in table[0] if x])
#                 if ("Scheme" in header_text or "Scheme Name" in header_text) and ("NAV" in header_text or "Units" in header_text):
#                     for row in table[1:]:
#                         all_rows.append(row)

#     return all_rows

# if __name__ == "__main__":
#     rows = extract_tables_from_pdf(PDF_PATH)

#     if not rows:
#         print("❌ No portfolio table found. PDF formatting may require custom extraction.")
#     else:
#         df = pd.DataFrame(rows)
#         df.to_csv(OUTPUT_CSV, index=False)
#         print(f"✅ Extracted rows: {len(df)}")
#         print(f"✅ Saved CSV to: {OUTPUT_CSV}")
#         print(df.head())

















# import pdfplumber
# import json

# PDF_PATH = "cas_summary_report_2026_01_14_175808.pdf"
# OUTPUT_JSON = "portfolio_holdings.json"

# def extract_tables_from_pdf(pdf_path):
#     extracted = []

#     with pdfplumber.open(pdf_path) as pdf:
#         for page_no, page in enumerate(pdf.pages, start=1):
#             tables = page.extract_tables()

#             if not tables:
#                 continue

#             for table in tables:
#                 # remove empty rows
#                 table = [
#                     row for row in table
#                     if row and any(cell and cell.strip() for cell in row)
#                 ]

#                 if not table:
#                     continue

#                 header_text = " ".join([str(x) for x in table[0] if x])

#                 # holdings table check
#                 if ("Scheme" in header_text) and ("Units" in header_text or "NAV" in header_text):
#                     for row in table[1:]:
#                         try:
#                             scheme_name = row[1].strip()
#                             units_raw = row[3].strip()

#                             units = float(units_raw.replace(",", ""))

#                             extracted.append({
#                                 "scheme_name": scheme_name,
#                                 "units": units
#                             })

#                         except Exception:
#                             continue

#     return extracted


# if __name__ == "__main__":
#     data = extract_tables_from_pdf(PDF_PATH)

#     if not data:
#         print("❌ No portfolio data extracted.")
#     else:
#         with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
#             json.dump(data, f, indent=2)

#         print(f"✅ Extracted rows: {len(data)}")
#         print(f"✅ Saved JSON to: {OUTPUT_JSON}")
#         print("\nPreview:")
#         print(json.dumps(data[:3], indent=2))












# import pdfplumber
# import json
# import requests
# import re
# import time

# PDF_PATH = "cas_summary_report_2026_01_14_175808.pdf"
# OUTPUT_JSON = "portfolio_holdings.json"
# AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt"

# STOPWORDS = {
#     "plan", "option", "growth", "dividend",
#     "regular", "direct", "fund"
# }


# # -----------------------------
# # PDF EXTRACTION PART
# # -----------------------------
# def extract_tables_from_pdf(pdf_path):
#     extracted = []

#     with pdfplumber.open(pdf_path) as pdf:
#         for page in pdf.pages:
#             tables = page.extract_tables()

#             if not tables:
#                 continue

#             for table in tables:
#                 table = [
#                     row for row in table
#                     if row and any(cell and cell.strip() for cell in row)
#                 ]

#                 if not table:
#                     continue

#                 header_text = " ".join([str(x) for x in table[0] if x])

#                 if ("Scheme" in header_text) and ("Units" in header_text or "NAV" in header_text):
#                     for row in table[1:]:
#                         try:
#                             scheme_name = row[1].strip()
#                             units_raw = row[3].strip()
#                             units = float(units_raw.replace(",", ""))

#                             extracted.append({
#                                 "scheme_name": scheme_name,
#                                 "units": units
#                             })

#                         except Exception:
#                             continue

#     return extracted


# # -----------------------------
# # AMFI MATCHING PART
# # -----------------------------
# def normalize_tokens(text: str):
#     text = text.lower().replace("–", "-").replace("—", "-")
#     tokens = re.split(r"[^a-z0-9]+", text)
#     tokens = [t for t in tokens if t and t not in STOPWORDS]
#     return set(tokens)


# def fetch_amfi_data():
#     res = requests.get(AMFI_URL)
#     res.raise_for_status()
#     return res.text.splitlines()


# def get_amfi_details(user_scheme_name, amfi_lines):
#     user_tokens = normalize_tokens(user_scheme_name)
#     user_is_direct = "direct" in user_scheme_name.lower()

#     best_match = None
#     best_score = 0

#     for line in amfi_lines:
#         if not line or line.startswith("Scheme Code"):
#             continue

#         parts = line.split(";")
#         if len(parts) < 4:
#             continue

#         amfi_code = parts[0].strip()
#         amfi_name = parts[3].strip()

#         amfi_tokens = normalize_tokens(amfi_name)
#         amfi_is_direct = "direct" in amfi_name.lower()

#         # Direct/Regular consistency check
#         if user_is_direct != amfi_is_direct:
#             continue

#         common_tokens = user_tokens.intersection(amfi_tokens)
#         score = len(common_tokens)

#         if score > best_score:
#             best_score = score
#             best_match = {
#                 "amfi_code": amfi_code,
#                 "amfi_name": amfi_name
#             }

#     return best_match


# # -----------------------------
# # CATEGORY DETECTION
# # -----------------------------

# # Step 1: From PDF name
# def get_category_from_name(scheme_name: str):
#     name = scheme_name.lower()

#     if "etf" in name:
#         return "ETF"
#     elif "flexi cap" in name or "flexi" in name:
#         return "FLEXI"
#     elif "small cap" in name or "smallcap" in name:
#         return "SMALL"
#     else:
#         return "OTHER"


# # Step 2: From official AMFI name
# def get_category_from_amfi(amfi_name: str):
#     name = amfi_name.lower()

#     if "etf" in name:
#         return "ETF"
#     elif "flexi cap" in name:
#         return "FLEXI"
#     elif "small cap" in name:
#         return "SMALL"
#     else:
#         return "OTHER"


# # -----------------------------
# # MAIN EXECUTION
# # -----------------------------
# if __name__ == "__main__":

#     print("📄 Extracting portfolio from PDF...")
#     portfolio = extract_tables_from_pdf(PDF_PATH)

#     if not portfolio:
#         print("❌ No portfolio data extracted.")
#         exit()

#     print(f"✅ Extracted {len(portfolio)} schemes")

#     print("🌐 Fetching AMFI data...")
#     amfi_lines = fetch_amfi_data()

#     print("🔍 Matching AMFI codes and validating category...")

#     for holding in portfolio:
#         scheme_name = holding["scheme_name"]

#         # Step 1: Detect from PDF name
#         category_from_name = get_category_from_name(scheme_name)

#         # Step 2: Get AMFI details
#         amfi_details = get_amfi_details(scheme_name, amfi_lines)

#         if amfi_details:
#             amfi_code = amfi_details["amfi_code"]
#             amfi_name = amfi_details["amfi_name"]

#             # Step 3: Detect from AMFI official name
#             category_from_amfi = get_category_from_amfi(amfi_name)

#             # Step 4: Confirm both match
#             if category_from_name == category_from_amfi:
#                 final_category = category_from_amfi
#             else:
#                 final_category = "OTHER"

#             holding["amfi_code"] = amfi_code
#             holding["category"] = final_category

#             print(
#                 f"{scheme_name} → "
#                 f"Name:{category_from_name} | "
#                 f"AMFI:{category_from_amfi} → "
#                 f"FINAL:{final_category}"
#             )

#         else:
#             holding["amfi_code"] = "NOT_FOUND"
#             holding["category"] = "OTHER"
#             print(f"{scheme_name} → AMFI NOT FOUND → FINAL: OTHER")

#         time.sleep(0.05)

#     # Save final JSON
#     with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
#         json.dump(portfolio, f, indent=2)

#     print(f"\n✅ Final portfolio saved to {OUTPUT_JSON}")



import pdfplumber
import json
import requests
import re
import time
from difflib import SequenceMatcher
from collections import defaultdict

# =========================================================
# CONFIG
# =========================================================

import sys

if len(sys.argv) < 2:
    print("PDF path not provided", file=sys.stderr)
    sys.exit(1)

PDF_PATH = sys.argv[1]
AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt"

# -----------------------------
# NORMALIZATION CONFIG
# -----------------------------

STOPWORDS = {
    "mutual","fund","scheme","open","ended",
    "plan","option","growth","gr","op","pl",
    "dividend","income","funds",
    "monthly","quarterly","weekly","daily",
    "annual","half","yearly","fortnightly",
    "idcw","bonus","distribution","cum",
    "capital","withdrawal"
}

PLAN_WORDS = {"direct", "regular", "reg", "retail", "institutional"}

REPLACEMENTS = {
    "exchange traded fund": "etf",
    "exchange traded": "etf",
    "bees": "etf",
    "tax advg": "elss",
    "tax advantage": "elss",
    "flexicap": "flexi cap",
    "multiasset": "multi asset",
    "contra fund": "contra",
    "banking & psu": "banking psu",
    "banking and psu": "banking psu",
}

def is_etf(tokens: set) -> bool:
    return (
        "etf" in tokens
        or "bees" in tokens
        or ("exchange" in tokens and "traded" in tokens)
    )

# =========================================================
# PDF EXTRACTION
# =========================================================

def extract_tables_from_pdf(pdf_path):
    extracted = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            if not tables:
                continue

            for table in tables:
                table = [
                    row for row in table
                    if row and any(cell and cell.strip() for cell in row)
                ]

                if not table:
                    continue

                header_text = " ".join(str(x) for x in table[0] if x)

                if ("Scheme" in header_text) and ("Units" in header_text or "NAV" in header_text):
                    for row in table[1:]:
                        try:
                            extracted.append({
                                "scheme_name": row[1].strip(),
                                "units": float(row[3].replace(",", ""))
                            })
                        except Exception:
                            continue
    return extracted

# =========================================================
# NORMALIZATION + TOKENIZATION
# =========================================================

def normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[–—/(),.-]", " ", text)
    for k, v in REPLACEMENTS.items():
        text = text.replace(k, v)
    return re.sub(r"\s+", " ", text).strip()

def tokenize(text: str) -> set:
    return {
        t for t in normalize(text).split()
        if t not in STOPWORDS and len(t) > 1
    }

def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()

def extract_plan(tokens: set):
    if "direct" in tokens:
        return "direct"
    if "regular" in tokens or "reg" in tokens:
        return "regular"
    return None

def strip_plan_words(text: str):
    return " ".join(
        w for w in normalize(text).split()
        if w not in PLAN_WORDS
    )

# =========================================================
# AMFI DATA LOADING
# =========================================================

def fetch_amfi_data():
    res = requests.get(AMFI_URL)
    res.raise_for_status()

    schemes = []
    for line in res.text.splitlines():
        if not line or line.startswith("Scheme Code"):
            continue

        parts = line.split(";")
        if len(parts) < 5:
            continue

        schemes.append({
            "amfi_code": parts[0].strip(),
            "amfi_name": parts[3].strip(),
            "nav": float(parts[4]) if parts[4] else 0.0,
            "norm": normalize(parts[3]),
            "tokens": tokenize(parts[3]),
            "core": strip_plan_words(parts[3])
        })
    return schemes

# =========================================================
# AMFI MATCHING ENGINE (ROBUST)
# =========================================================

def get_amfi_details(user_scheme, amfi_data, threshold=0.62):
    user_norm = normalize(user_scheme)
    user_tokens = tokenize(user_scheme)
    user_plan = extract_plan(user_tokens)

    candidates = []

    for s in amfi_data:
        overlap = len(user_tokens & s["tokens"]) / max(1, len(user_tokens | s["tokens"]))
        sim = similarity(user_norm, s["norm"])
        score = (0.65 * overlap) + (0.35 * sim)

        if score >= threshold:
            candidates.append({**s, "score": score})

    if not candidates:
        return None

    grouped = defaultdict(list)
    for c in candidates:
        grouped[c["core"]].append(c)

    best = None
    best_score = 0

    for group in grouped.values():

        # Respect Direct/Regular if explicitly mentioned
        if user_plan:
            group = [
                g for g in group
                if user_plan in normalize(g["amfi_name"])
            ] or group

        # Choose highest NAV (Direct wins naturally)
        chosen = max(group, key=lambda x: (x["nav"], x["score"]))

        if chosen["score"] > best_score:
            best_score = chosen["score"]
            best = chosen

    return {
        "amfi_code": best["amfi_code"],
        "amfi_name": best["amfi_name"],
        "nav": best["nav"],
        "confidence": round(best_score, 3)
    }

# =========================================================
# CATEGORY DETECTION (UNCHANGED)
# =========================================================

def get_category_from_name(name: str):
    tokens = tokenize(name)

    if is_etf(tokens):
        return "ETF"

    if "flexi" in tokens and "cap" in tokens:
        return "FLEXI"

    if "small" in tokens and "cap" in tokens:
        return "SMALL"

    return "OTHER"


def get_category_from_amfi(name: str):
    tokens = tokenize(name)

    if is_etf(tokens):
        return "ETF"

    if "flexi" in tokens and "cap" in tokens:
        return "FLEXI"

    if "small" in tokens and "cap" in tokens:
        return "SMALL"

    return "OTHER"

# =========================================================
# MAIN EXECUTION
# =========================================================

if __name__ == "__main__":

    portfolio = extract_tables_from_pdf(PDF_PATH)
    if not portfolio:
        print(json.dumps([]))
        sys.exit(0)

    amfi_data = fetch_amfi_data()

    for holding in portfolio:
        scheme = holding["scheme_name"]

        cat_pdf = get_category_from_name(scheme)
        amfi = get_amfi_details(scheme, amfi_data)

        if amfi:
            cat_amfi = get_category_from_amfi(amfi["amfi_name"])
            holding["amfi_code"] = amfi["amfi_code"]
            holding["category"] = cat_amfi if cat_pdf == cat_amfi else "OTHER"
            holding["confidence"] = amfi["confidence"]
        else:
            holding["amfi_code"] = "NOT_FOUND"
            holding["category"] = "OTHER"
            holding["confidence"] = 0.0

    print(json.dumps(portfolio))
