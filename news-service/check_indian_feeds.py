import feedparser

feeds = {
    "MoneyControl": "https://www.moneycontrol.com/rss/mfnews.xml",
    "EconomicTimes": "https://economictimes.indiatimes.com/mf/rssfeedsdefault.cms",
    "LiveMint": "https://www.livemint.com/rss/mutual-funds"
}

for name, url in feeds.items():
    print(f"Checking {name}...")
    f = feedparser.parse(url)
    print(f"  Entries: {len(f.entries)}")
    for i, entry in enumerate(f.entries[:5]):
        print(f"  {i+1}. {entry.title}")
