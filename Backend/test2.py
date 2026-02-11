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

















import pdfplumber
import json

PDF_PATH = "cas_summary_report_2026_01_14_175808.pdf"
OUTPUT_JSON = "portfolio_holdings.json"

def extract_tables_from_pdf(pdf_path):
    extracted = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()

            if not tables:
                continue

            for table in tables:
                # remove empty rows
                table = [
                    row for row in table
                    if row and any(cell and cell.strip() for cell in row)
                ]

                if not table:
                    continue

                header_text = " ".join([str(x) for x in table[0] if x])

                # holdings table check
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


if __name__ == "__main__":
    data = extract_tables_from_pdf(PDF_PATH)

    if not data:
        print("❌ No portfolio data extracted.")
    else:
        with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        print(f"✅ Extracted rows: {len(data)}")
        print(f"✅ Saved JSON to: {OUTPUT_JSON}")
        print("\nPreview:")
        print(json.dumps(data[:3], indent=2))
