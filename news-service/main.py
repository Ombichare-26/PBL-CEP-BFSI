from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import feedparser
import requests
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
HEADERS = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

# Reliable Indian Mutual Fund RSS Feeds
RSS_FEEDS = {
    "The Economic Times": "https://economictimes.indiatimes.com/mf/rssfeedsdefault.cms",
    "Business Standard": "https://news.google.com/rss/search?q=mutual+funds+site:business-standard.com&hl=en-IN&gl=IN&ceid=IN:en"
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



    # 2. Fetch from RSS Feeds
    for source_name, feed_url in RSS_FEEDS.items():
        try:
            # Use requests with a valid User-Agent because Google News blocks Python's default urllib agent!
            response = requests.get(feed_url, headers=HEADERS, timeout=10)
            if response.status_code != 200:
                print(f"Skipping {source_name}, returned status {response.status_code}")
                continue

            feed = feedparser.parse(response.content)
            # Limit strictly to 15 articles per source so one feed doesn't consume the top 60 limit!
            for entry in feed.entries[:15]:
                link = getattr(entry, "link", None)
                title = getattr(entry, "title", "")
                summary = getattr(entry, "summary", "")
                if not link or not title or link in seen_urls: continue
                
                # Check timeframe (last 7 days)
                published_parsed = getattr(entry, "published_parsed", None)
                if published_parsed:
                    pub_dt = datetime.fromtimestamp(time.mktime(published_parsed))
                    if datetime.now() - pub_dt > timedelta(days=7):
                        continue
                
                final_cat = categorize(title, summary)
                
                # Trust the source query if category is ambiguous
                if final_cat == "Mutual Fund":
                    if "Flexi" in source_name:
                        final_cat = "Flexi Cap"
                    elif "Small" in source_name:
                        final_cat = "Small Cap"
                    elif "ETF" in source_name:
                        final_cat = "ETF"
                
                published_raw = getattr(entry, "published", None) or getattr(entry, "pubDate", None)
                if not published_raw:
                    published_date = datetime.now().strftime("%Y-%m-%d")
                else:
                    published_date = published_raw[:16]

                articles.append({
                    "title": title,
                    "source": source_name,
                    "link": link,
                    "published": published_date,
                    "category": final_cat,
                    "sentiment": get_sentiment(title + " " + summary)
                })
                seen_urls.add(link)
        except Exception as e:
            print(f"Error for RSS {source_name}: {e}")

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
