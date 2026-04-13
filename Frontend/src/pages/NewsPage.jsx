import { useState, useEffect } from "react";
import "./NewsPage.css";

const NEWS_API_URL = "http://localhost:9001/news";

const NewsPage = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await fetch(NEWS_API_URL);
      const data = await response.json();
      setNews(data);
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ["ALL", "ETF", "Small Cap", "Flexi Cap", "Mutual Fund"];

  const filteredNews = filter === "ALL" 
    ? news 
    : news.filter(item => item.category === filter);

  return (
    <div className="news-container">
      <header className="news-header">
        <h1>Market Intelligence</h1>
        <p>Latest insights on ETFs, Small Cap and Flexi Cap funds</p>
      </header>

      <div className="filter-bar">
        {categories.map(cat => (
          <button 
            key={cat}
            className={`filter-btn ${filter === cat ? "active" : ""}`}
            onClick={() => setFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loader-container">
          <div className="loader"></div>
          <p>Scouring the markets for latest news...</p>
        </div>
      ) : (
        <div className="news-grid">
          {filteredNews.map((item, index) => (
            <a 
              href={item.link} 
              key={index} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="news-card"
            >
              <div className="card-badge-container">
                <span className={`badge category-badge ${item.category.toLowerCase().replace(" ", "-")}`}>
                  {item.category}
                </span>
                <span className={`badge sentiment-badge ${item.sentiment}`}>
                  {item.sentiment}
                </span>
              </div>
              <h3>{item.title}</h3>
              <div className="card-footer">
                <span className="source">{item.source}</span>
                <span className="date">{item.published ? item.published.split(" ")[0] : "Recently"}</span>
              </div>
            </a>
          ))}
          {filteredNews.length === 0 && (
            <div className="no-news">
              <p>No news found for this category at the moment.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NewsPage;
