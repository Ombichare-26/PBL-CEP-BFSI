import yfinance as yf
tickers = ["NIFTYBEES.NS", "SPY", "VTI"]
for t in tickers:
    tick = yf.Ticker(t)
    print(f"{t} news count: {len(tick.news)}")
    if tick.news:
        print(f"First title: {tick.news[0]['title']}")
