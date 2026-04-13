# Financial News Aggregator Service

A Python-based backend service that fetches and analyzes financial news related to ETFs, Flexi-Cap, and Small-Cap funds.

## Features
- **Data Aggregation**: Fetches news from Yahoo Finance RSS and ticker-specific news using `yfinance`.
- **Categorization**: Automatically classifies news into ETF, Small Cap, and Flexi Cap categories.
- **Sentiment Analysis**: Performs basic sentiment analysis (positive, negative, neutral) using `TextBlob`.
- **FastAPI**: High-performance API with cross-origin support (CORS).
- **Caching**: Thread-safe in-memory caching to minimize external API calls.

## Tech Stack
- Python 3.9+
- FastAPI
- yfinance
- feedparser
- TextBlob

## Setup Instructions
1. Navigate to this directory:
   ```bash
   cd news-service
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Download NLTK corpora for TextBlob:
   ```bash
   python -m textblob.download_corpora lite
   ```
5. Run the service:
   ```bash
   python main.py
   ```

The API will be available at `http://localhost:9001/news`.
EOF
