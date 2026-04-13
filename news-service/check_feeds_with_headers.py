import requests
import feedparser

headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}

feeds = {
    "MoneyControl": "https://www.moneycontrol.com/rss/mfnews.xml",
    "EconomicTimes": "https://economictimes.indiatimes.com/mf/rssfeedsdefault.cms",
}

for name, url in feeds.items():
    print(f"Checking {name}...")
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"  Status code: {response.status_code}")
        if response.status_code == 200:
            f = feedparser.parse(response.content)
            print(f"  Entries: {len(f.entries)}")
            for i, entry in enumerate(f.entries[:5]):
                print(f"  {i+1}. {entry.title}")
    except Exception as e:
        print(f"  Error: {e}")
