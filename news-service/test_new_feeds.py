import requests
import feedparser

headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}

feeds = {
    "Freefincal": "https://freefincal.com/category/mutual-funds/feed/",
    "BasuNivesh": "https://basunivesh.com/category/mutual-funds/feed/",
    "Livemint": "https://www.livemint.com/rss/money"
}

for name, url in feeds.items():
    print(f"--- Checking {name} ---")
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            f = feedparser.parse(response.content)
            print(f"Entries found: {len(f.entries)}")
            for i, entry in enumerate(f.entries[:3]):
                print(f"  {i+1}. {entry.title}")
                # check if flexi or small cap keywords are in any of these
                text = (entry.title + " " + entry.get('summary', '')).lower()
                if 'flexi' in text: print("     >> FOUND FLEXI KEYWORD")
                if 'small' in text: print("     >> FOUND SMALL KEYWORD")
    except Exception as e:
        print(f"Error: {e}")
