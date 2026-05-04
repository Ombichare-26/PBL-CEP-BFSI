import pdfplumber
import json
import requests
import re
try:
    from bs4 import BeautifulSoup
except Exception:
    BeautifulSoup = None
try:
    from playwright.sync_api import sync_playwright
except Exception:
    sync_playwright = None
from difflib import SequenceMatcher
from collections import defaultdict

# =========================================================
# CONFIG
# =========================================================

import sys

PDF_PATH = sys.argv[1] if len(sys.argv) >= 2 else None
AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt"
_AMFI_DATA_CACHE = None

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

HEADERS = {
    "User-Agent": "Mozilla/5.0"
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
# VALUE RESEARCH RISK LOOKUP
# =========================================================

def normalize_risk_label(value: str):
    if not value:
        return ""
    normalized = value.strip().lower().replace("-", " ")
    mapping = {
        "low": "LOW",
        "moderate": "MODERATE",
        "high": "HIGH",
        "very high": "VERY_HIGH",
        "moderately high": "MODERATELY_HIGH",
    }
    return mapping.get(normalized, "")

def google_search_value_research_url_requests(scheme_name: str):
    if BeautifulSoup is None:
        return None

    query = requests.utils.quote(f"{scheme_name} riskometer")
    url = f"https://www.google.com/search?q={query}&hl=en"

    try:
        res = requests.get(url, headers=HEADERS, timeout=20)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, "html.parser")

        for link in soup.find_all("a", href=True):
            href = link["href"]
            if href.startswith("/url?q="):
                candidate = requests.utils.unquote(href.split("/url?q=", 1)[1].split("&", 1)[0])
            else:
                candidate = href

            if "valueresearchonline.com/funds/" in candidate:
                return candidate
    except Exception:
        return None

    return None

def extract_risk_from_value_research_requests(url: str):
    if BeautifulSoup is None or not url:
        return None

    try:
        res = requests.get(url, headers=HEADERS, timeout=20)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, "html.parser")
        text = " ".join(soup.stripped_strings).lower()

        patterns = [
            (r"this fund has\s+(very high|moderately high|high|moderate|low)\s+risk", None),
            (r"riskometer(?:\s+image)?\s+(very high|moderately high|high|moderate|low)", None),
        ]

        for pattern, _unused in patterns:
            match = re.search(pattern, text)
            if match:
                return normalize_risk_label(match.group(1))
    except Exception:
        return None

    return None

def lookup_riskometer_with_playwright(scheme_name: str):
    if sync_playwright is None:
        return None

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            query = f"{scheme_name} riskometer"
            google_url = f"https://www.google.com/search?q={requests.utils.quote(query)}&hl=en"
            page.goto(google_url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(1500)

            vr_url = None
            for link in page.locator("a").all():
                href = link.get_attribute("href")
                if not href:
                    continue
                if href.startswith("/url?q="):
                    href = requests.utils.unquote(href.split("/url?q=", 1)[1].split("&", 1)[0])
                if "valueresearchonline.com/funds/" in href:
                    vr_url = href
                    break

            if not vr_url:
                browser.close()
                return {
                    "risk_level": "",
                    "risk_source_type": "",
                    "risk_source_url": "",
                    "risk_lookup_status": "SEARCH_NOT_FOUND",
                    "risk_lookup_query": scheme_name,
                }

            page.goto(vr_url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)
            body_text = page.locator("body").inner_text(timeout=10000)
            browser.close()

            patterns = [
                r"Riskometer\s+(Very High|Moderately High|High|Moderate|Low)",
                r"This fund has\s+(Very High|Moderately High|High|Moderate|Low)\s+risk",
            ]

            for pattern in patterns:
                match = re.search(pattern, body_text, flags=re.IGNORECASE)
                if match:
                    return {
                        "risk_level": normalize_risk_label(match.group(1)),
                        "risk_source_type": "VALUE_RESEARCH",
                        "risk_source_url": vr_url,
                        "risk_lookup_status": "FOUND",
                        "risk_lookup_query": scheme_name,
                    }

            return {
                "risk_level": "",
                "risk_source_type": "",
                "risk_source_url": vr_url,
                "risk_lookup_status": "PAGE_FOUND_RISK_NOT_EXTRACTED",
                "risk_lookup_query": scheme_name,
            }
    except Exception:
        return None

def lookup_riskometer_from_google(scheme_name: str):
    playwright_result = lookup_riskometer_with_playwright(scheme_name)
    if playwright_result:
        return playwright_result

    vr_url = google_search_value_research_url_requests(scheme_name)
    if not vr_url:
        return {
            "risk_level": "",
            "risk_source_type": "",
            "risk_source_url": "",
            "risk_lookup_status": "SEARCH_NOT_FOUND",
            "risk_lookup_query": scheme_name,
        }

    risk_level = extract_risk_from_value_research_requests(vr_url)
    if not risk_level:
        return {
            "risk_level": "",
            "risk_source_type": "",
            "risk_source_url": vr_url,
            "risk_lookup_status": "PAGE_FOUND_RISK_NOT_EXTRACTED",
            "risk_lookup_query": scheme_name,
        }

    return {
        "risk_level": risk_level,
        "risk_source_type": "VALUE_RESEARCH",
        "risk_source_url": vr_url,
        "risk_lookup_status": "FOUND",
        "risk_lookup_query": scheme_name,
    }

# =========================================================
# AMFI DATA LOADING
# =========================================================

def fetch_amfi_data():
    global _AMFI_DATA_CACHE
    if _AMFI_DATA_CACHE is not None:
        return _AMFI_DATA_CACHE

    try:
        res = requests.get(AMFI_URL, headers=HEADERS, timeout=20)
        res.raise_for_status()
    except Exception as e:
        print(f"❌ Error fetching AMFI data: {e}")
        return []

    schemes = []
    lines = res.text.splitlines()
    for line in lines:
        if not line or line.startswith("Scheme Code") or ";" not in line:
            continue

        parts = line.split(";")
        if len(parts) < 5:
            continue

        try:
            name = parts[3].strip()
            nav_str = parts[4].strip()
            nav = float(nav_str) if nav_str and nav_str.lower() != "n.a." else 0.0

            schemes.append({
                "amfi_code": parts[0].strip(),
                "amfi_name": name,
                "nav": nav,
                "norm": normalize(name),
                "tokens": tokenize(name),
                "core": strip_plan_words(name)
            })
        except (ValueError, IndexError):
            continue

    _AMFI_DATA_CACHE = schemes
    return schemes

# =========================================================
# AMFI MATCHING ENGINE (ROBUST)
# =========================================================

def get_amfi_details(user_scheme, amfi_data, threshold=0.45):
    user_norm = normalize(user_scheme)
    user_tokens = tokenize(user_scheme)
    if not user_tokens:
        return None
        
    user_plan = extract_plan(user_tokens)

    # Phase 1: Fast Filtering using Token Overlap (Jaccard-ish)
    scored_candidates = []
    for s in amfi_data:
        intersection = len(user_tokens & s["tokens"])
        if intersection == 0:
            continue
            
        union = len(user_tokens | s["tokens"])
        overlap = intersection / union
        
        # Initial filter: must have at least one significant token in common
        if overlap > 0.05:
            scored_candidates.append({**s, "overlap": overlap})

    if not scored_candidates:
        return None

    # Sort by overlap and take top N for expensive fuzzy matching
    scored_candidates.sort(key=lambda x: x["overlap"], reverse=True)
    top_candidates = scored_candidates[:50] # Only take top 50 for SequenceMatcher

    # Phase 2: Detailed Fuzzy Matching
    final_candidates = []
    for c in top_candidates:
        sim = similarity(user_norm, c["norm"])
        score = (0.60 * c["overlap"]) + (0.40 * sim)

        if score >= threshold:
            final_candidates.append({**c, "score": score})

    if not final_candidates:
        return None

    grouped = defaultdict(list)
    for c in final_candidates:
        grouped[c["core"]].append(c)

    best = None
    best_score = 0

    for group in grouped.values():
        if user_plan:
            filtered_group = [
                g for g in group
                if user_plan in normalize(g["amfi_name"])
            ]
            if filtered_group:
                group = filtered_group

        # Choose highest NAV within the best name group
        chosen = max(group, key=lambda x: (x["nav"], x["score"]))

        if chosen["score"] > best_score:
            best_score = chosen["score"]
            best = chosen

    if not best:
        return None

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

def build_default_risk_info(scheme_name: str):
    return {
        "risk_level": "",
        "risk_source_type": "",
        "risk_source_url": "",
        "risk_lookup_status": "SKIPPED",
        "risk_lookup_query": scheme_name,
    }

def extract_portfolio(pdf_path: str, include_risk_lookup: bool = False):
    portfolio = extract_tables_from_pdf(pdf_path)
    if not portfolio:
        return []

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
            lookup_target = amfi["amfi_name"]
        else:
            holding["amfi_code"] = "NOT_FOUND"
            holding["category"] = "OTHER"
            holding["confidence"] = 0.0
            lookup_target = scheme

        risk_info = (
            lookup_riskometer_from_google(lookup_target)
            if include_risk_lookup
            else build_default_risk_info(lookup_target)
        )

        holding["risk_level"] = risk_info["risk_level"]
        holding["risk_source_type"] = risk_info["risk_source_type"]
        holding["risk_source_url"] = risk_info["risk_source_url"]
        holding["risk_lookup_status"] = risk_info["risk_lookup_status"]
        holding["risk_lookup_query"] = risk_info["risk_lookup_query"]

    return portfolio

if __name__ == "__main__":
    if not PDF_PATH:
        print("PDF path not provided", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(extract_portfolio(PDF_PATH)))
