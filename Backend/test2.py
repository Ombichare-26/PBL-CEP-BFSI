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












import pdfplumber
import json
import requests
import re
import time

PDF_PATH = "cas_summary_report_2026_01_14_175808.pdf"
OUTPUT_JSON = "portfolio_holdings.json"
AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt"

STOPWORDS = {
    "plan", "option", "growth", "dividend",
    "regular", "direct", "fund"
}


# -----------------------------
# PDF EXTRACTION PART
# -----------------------------
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

                header_text = " ".join([str(x) for x in table[0] if x])

                if ("Scheme" in header_text) and ("Units" in header_text or "NAV" in header_text):
                    for row in table[1:]:
                        try:
                            scheme_name = row[1].strip()
                            units_raw = row[3].strip()
                            units = float(units_raw.replace(",", ""))

                            extracted.append({
                                "scheme_name": scheme_name,
                                "units": units
                            })

                        except Exception:
                            continue

    return extracted


# -----------------------------
# AMFI MATCHING PART
# -----------------------------
def normalize_tokens(text: str):
    text = text.lower().replace("–", "-").replace("—", "-")
    tokens = re.split(r"[^a-z0-9]+", text)
    tokens = [t for t in tokens if t and t not in STOPWORDS]
    return set(tokens)


def fetch_amfi_data():
    res = requests.get(AMFI_URL)
    res.raise_for_status()
    return res.text.splitlines()


def get_amfi_details(user_scheme_name, amfi_lines):
    user_tokens = normalize_tokens(user_scheme_name)
    user_is_direct = "direct" in user_scheme_name.lower()

    best_match = None
    best_score = 0

    for line in amfi_lines:
        if not line or line.startswith("Scheme Code"):
            continue

        parts = line.split(";")
        if len(parts) < 4:
            continue

        amfi_code = parts[0].strip()
        amfi_name = parts[3].strip()

        amfi_tokens = normalize_tokens(amfi_name)
        amfi_is_direct = "direct" in amfi_name.lower()

        # Direct/Regular consistency check
        if user_is_direct != amfi_is_direct:
            continue

        common_tokens = user_tokens.intersection(amfi_tokens)
        score = len(common_tokens)

        if score > best_score:
            best_score = score
            best_match = {
                "amfi_code": amfi_code,
                "amfi_name": amfi_name
            }

    return best_match


# -----------------------------
# CATEGORY DETECTION
# -----------------------------

# Step 1: From PDF name
def get_category_from_name(scheme_name: str):
    name = scheme_name.lower()

    if "etf" in name:
        return "ETF"
    elif "flexi cap" in name or "flexi" in name:
        return "FLEXI"
    elif "small cap" in name or "smallcap" in name:
        return "SMALL"
    else:
        return "OTHER"


# Step 2: From official AMFI name
def get_category_from_amfi(amfi_name: str):
    name = amfi_name.lower()

    if "etf" in name:
        return "ETF"
    elif "flexi cap" in name:
        return "FLEXI"
    elif "small cap" in name:
        return "SMALL"
    else:
        return "OTHER"


# -----------------------------
# MAIN EXECUTION
# -----------------------------
if __name__ == "__main__":

    print("📄 Extracting portfolio from PDF...")
    portfolio = extract_tables_from_pdf(PDF_PATH)

    if not portfolio:
        print("❌ No portfolio data extracted.")
        exit()

    print(f"✅ Extracted {len(portfolio)} schemes")

    print("🌐 Fetching AMFI data...")
    amfi_lines = fetch_amfi_data()

    print("🔍 Matching AMFI codes and validating category...")

    for holding in portfolio:
        scheme_name = holding["scheme_name"]

        # Step 1: Detect from PDF name
        category_from_name = get_category_from_name(scheme_name)

        # Step 2: Get AMFI details
        amfi_details = get_amfi_details(scheme_name, amfi_lines)

        if amfi_details:
            amfi_code = amfi_details["amfi_code"]
            amfi_name = amfi_details["amfi_name"]

            # Step 3: Detect from AMFI official name
            category_from_amfi = get_category_from_amfi(amfi_name)

            # Step 4: Confirm both match
            if category_from_name == category_from_amfi:
                final_category = category_from_amfi
            else:
                final_category = "OTHER"

            holding["amfi_code"] = amfi_code
            holding["category"] = final_category

            print(
                f"{scheme_name} → "
                f"Name:{category_from_name} | "
                f"AMFI:{category_from_amfi} → "
                f"FINAL:{final_category}"
            )

        else:
            holding["amfi_code"] = "NOT_FOUND"
            holding["category"] = "OTHER"
            print(f"{scheme_name} → AMFI NOT FOUND → FINAL: OTHER")

        time.sleep(0.05)

    # Save final JSON
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(portfolio, f, indent=2)

    print(f"\n✅ Final portfolio saved to {OUTPUT_JSON}")
