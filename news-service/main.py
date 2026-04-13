from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import feedparser
from textblob import TextBlob
from datetime import datetime, timedelta
import time
import threading

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# Configuration
# -------------------------
# Tickers specifically for news proxies
TICKER_DATA = {
    "ETF": ["NIFTYBEES.NS", "SPY", "VTI", "IVV"],
    "Small Cap": ["IWM", "VB", "IJR", "SML.L"], 
    "Flexi Cap": ["VTI"] # Flexi-cap is very specific to India, using broad market as the closest news proxy
}

# Simplified queries to ensure data availability on Yahoo Finance
RSS_FEEDS = {
    "ETF": "https://finance.yahoo.com/rss/search?q=Exchanged+Traded+Fund",
    "Small Cap": "https://finance.yahoo.com/rss/search?q=Small+Cap+Fund",
    "Flexi Cap": "https://finance.yahoo.com/rss/search?q=Mutual+Fund+Market"
}

CACHE_TTL = 3600 * 6 
NEWS_CACHE = {
    "data": [],
    "last_updated": 0
}
CACHE_LOCK = threading.Lock()

# -------------------------
# Helpers
# -------------------------

def get_sentiment(text: str) -> str:
    if not text: return "neutral"
    analysis = TextBlob(text)
    score = analysis.sentiment.polarity
    if score > 0.05: return "positive"
    if score < -0.05: return "negative"
    return "neutral"

def categorize(title: str, summary: str = "") -> str:
    title_lower = title.lower()
    summary_lower = summary.lower()
    text = (title_lower + " " + summary_lower)
    
    # Precise keyword matching for prioritized categories
    if any(k in text for k in ["small cap", "small-cap", "smallcap"]):
        return "Small Cap"
    if any(k in text for k in ["flexi cap", "flexi-cap", "flexicap", "multicap", "multi cap"]):
        return "Flexi Cap"
    if any(k in text for k in ["etf", "niftybees", "spy", "vti", "nifty bees", "exchange traded"]):
        return "ETF"
        
    return "Mutual Fund"

# -------------------------
# Core Logic
# -------------------------

def fetch_news():
    articles = []
    seen_urls = set()

    # 1. Fetch from Tickers
    for cat_name, tickers in TICKER_DATA.items():
        for symbol in tickers:
            try:
                tick = yf.Ticker(symbol)
                yf_news = tick.news
                if not yf_news: continue
                
                for item in yf_news:
                    link = item.get("link")
                    title = item.get("title", "")
                    if not link or not title or link in seen_urls: continue
                    
                    published_ts = item.get("providerPublishTime")
                    published = datetime.fromtimestamp(published_ts).strftime("%Y-%m-%d") if published_ts else None

                    articles.append({
                        "title": title,
                        "source": item.get("publisher", "Financial News"),
                        "link": link,
                        "published": published,
                        "category": cat_name,
                        "sentiment": get_sentiment(title)
                    })
                    seen_urls.add(link)
            except Exception as e:
                print(f"Error for {symbol}: {e}")

    # 2. Fetch from RSS Feeds
    for feed_cat, feed_url in RSS_FEEDS.items():
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries:
                link = getattr(entry, "link", None)
                title = getattr(entry, "title", "")
                summary = getattr(entry, "summary", "")
                if not link or not title or link in seen_urls: continue
                
                # Manual matching
                matched_cat = categorize(title, summary)
                # If manual matching is "Market", but it came from a themed feed, trust the theme
                # unless it's the generic Flexi Cap feed which often returns broad news
                final_cat = matched_cat
                if final_cat == "Mutual Fund":
                    if feed_cat != "Flexi Cap": # Only trust specific themed feeds for ETF/Small Cap
                         final_cat = feed_cat
                    else:
                         final_cat = "Mutual Fund"
                
                articles.append({
                    "title": title,
                    "source": "Yahoo Finance",
                    "link": link,
                    "published": getattr(entry, "published", datetime.now().strftime("%d %b %Y")),
                    "category": final_cat,
                    "sentiment": get_sentiment(title + " " + summary)
                })
                seen_urls.add(link)
        except Exception as e:
            print(f"Error for RSS {feed_cat}: {e}")

    # Limit total news
    return articles[:60]

# -------------------------
# API Endpoints
# -------------------------

@app.get("/news")
async def get_news():
    global NEWS_CACHE
    with CACHE_LOCK:
        current_time = time.time()
        if current_time - NEWS_CACHE["last_updated"] > CACHE_TTL or not NEWS_CACHE["data"]:
            print("Refreshing news cache...")
            NEWS_CACHE["data"] = fetch_news()
            NEWS_CACHE["last_updated"] = current_time
    return NEWS_CACHE["data"]

@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9001)
