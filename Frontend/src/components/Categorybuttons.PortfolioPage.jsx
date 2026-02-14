function CategoryButtons({ selected, onSelect }) {
    const categories = ["Small Cap", "Flexi Cap", "ETF", "Other"];
  
    return (
      <div className="category-buttons">
        {categories.map((cat) => (
          <button
            key={cat}
            className={selected === cat ? "active" : ""}
            onClick={() => onSelect(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
    );
  }
  
  export default CategoryButtons;
  