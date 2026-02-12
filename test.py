import requests
import re

AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt"

USER_SCHEME_NAME = "Axis Banking & PSU Debt Fund - Direct Plan - Daily "


STOPWORDS = {"plan", "option"}

def normalize_tokens(text: str):
    text = (
        text.lower()
        .replace("–", "-")
        .replace("—", "-")
    )
    # split on non-alphanumeric
    tokens = re.split(r"[^a-z0-9]+", text)
    tokens = [t for t in tokens if t and t not in STOPWORDS]
    return set(tokens)

def is_direct(tokens):
    return "direct" in tokens

def fetch_amfi_lines():
    res = requests.get(AMFI_URL)
    res.raise_for_status()
    return res.text.splitlines()

def get_amfi_code(user_scheme_name):
    user_tokens = normalize_tokens(user_scheme_name)
    user_is_direct = is_direct(user_tokens)

    for line in fetch_amfi_lines():
        if not line or line.startswith("Scheme Code"):
            continue

        parts = line.split(";")
        if len(parts) < 4:
            continue

        amfi_code = parts[0].strip()
        amfi_name = parts[3].strip()

        amfi_tokens = normalize_tokens(amfi_name)
        amfi_is_direct = is_direct(amfi_tokens)

        # Plan consistency:
        # if user says Direct -> AMFI must be Direct
        # if user does NOT say Direct -> treat as Regular (AMFI must not be Direct)
        if user_is_direct != amfi_is_direct:
            continue

        # Core token match (order-independent)
        if user_tokens.issubset(amfi_tokens) or amfi_tokens.issubset(user_tokens):
            return amfi_code

    return None

if __name__ == "__main__":
    code = get_amfi_code(USER_SCHEME_NAME)
    print(code if code else "NOT FOUND")
