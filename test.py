import re
import sys
from urllib.parse import quote, unquote

try:
    from playwright.sync_api import sync_playwright
except Exception as exc:
    print(f"Playwright is not available: {exc}")
    sys.exit(1)

def normalize_risk_label(value: str) -> str:
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


def extract_google_result_url(href: str) -> str | None:
    if not href:
        return None
    if href.startswith("/url?q="):
        return unquote(href.split("/url?q=", 1)[1].split("&", 1)[0])
    if href.startswith("http"):
        return href
    return None


def find_value_research_url(page):
    for link in page.locator("a").all():
        href = link.get_attribute("href")
        candidate = extract_google_result_url(href or "")
        if candidate and "valueresearchonline.com/funds/" in candidate:
            return candidate
    return None


def extract_riskometer_text(body_text: str) -> str:
    patterns = [
        r"Riskometer\s+(Very High|Moderately High|High|Moderate|Low)",
        r"This fund has\s+(Very High|Moderately High|High|Moderate|Low)\s+risk",
    ]

    for pattern in patterns:
        match = re.search(pattern, body_text, flags=re.IGNORECASE)
        if match:
            return normalize_risk_label(match.group(1))
    return ""


def main():
    scheme_name = (
        " ".join(sys.argv[1:]).strip()
        if len(sys.argv) > 1
        else "Groww Silver ETF FOF - Regular Growth"
    )

    print(f"Scheme name: {scheme_name}")
    google_query = f"{scheme_name} riskometer"
    google_url = f"https://www.google.com/search?q={quote(google_query)}&hl=en"
    print(f"Google query URL: {google_url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        print("\nStep 1: Open Google search results")
        page.goto(google_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2500)

        vr_url = find_value_research_url(page)
        print(f"First Value Research URL found: {vr_url or 'NONE'}")

        if not vr_url:
            print("No Value Research fund URL found in search results.")
            browser.close()
            return

        print("\nStep 2: Open Value Research page")
        page.goto(vr_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        body_text = page.locator("body").inner_text(timeout=10000)
        risk_level = extract_riskometer_text(body_text)

        print(f"Current page URL: {page.url}")
        print(f"Extracted risk label: {risk_level or 'NOT FOUND'}")

        if not risk_level:
            print("\nCould not extract Riskometer text from the page body.")
            print("Manual hint: look for the section labeled 'Riskometer' on the open page.")
        else:
            print("\nSuccess.")

        print("\nPress Enter in this terminal to close the browser...")
        input()
        browser.close()


if __name__ == "__main__":
    main()
