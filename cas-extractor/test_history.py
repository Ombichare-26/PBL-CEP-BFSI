import requests
from datetime import datetime, timedelta
from math import sqrt

AMFI_CODE = "101762"
url = f"https://api.mfapi.in/mf/{AMFI_CODE}"
print(f"Fetching {url}...")
res = requests.get(url, timeout=10)
print(f"Status: {res.status_code}")
data = res.json()
historical = data.get("data", [])
print(f"Historical data points: {len(historical)}")

if historical:
    for item in historical:
        item["date_obj"] = datetime.strptime(item["date"], "%d-%m-%Y")
    
    historical.sort(key=lambda x: x["date_obj"])
    print(f"Latest nav: {historical[-1]['nav']}")

