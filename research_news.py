import yfinance as yf
import feedparser

def test_yf():
    ticker = yf.Ticker("NIFTYBEES.NS")
    news = ticker.news
    print(f"YF News count: {len(news)}")
    if news:
        print(f"First title: {news[0]['title']}")

def test_rss():
    url = "https://finance.yahoo.com/rss/search?q=ETF+India+small+cap+flexi+cap+mutual+fund"
    feed = feedparser.parse(url)
    print(f"RSS Feed items: {len(feed.entries)}")
    if feed.entries:
        print(f"First item: {feed.entries[0].title}")

if __name__ == "__main__":
    test_yf()
    test_rss()
