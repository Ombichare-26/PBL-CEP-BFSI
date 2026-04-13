import feedparser
feeds = {
    "ETF": "https://finance.yahoo.com/rss/search?q=ETF+India+Index+Fund",
    "Small Cap": "https://finance.yahoo.com/rss/search?q=Small+Cap+Mutual+Fund+India",
    "Flexi Cap": "https://finance.yahoo.com/rss/search?q=Flexi+Cap+Mutual+Fund+India"
}
for name, url in feeds.items():
    f = feedparser.parse(url)
    print(f"{name} count: {len(f.entries)}")
    if f.entries:
        print(f"  First title: {f.entries[0].title}")
