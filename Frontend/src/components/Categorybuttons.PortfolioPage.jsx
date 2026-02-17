const CATEGORIES = [
  { code: "ALL", label: "All" },
  { code: "SMALL", label: "Small Cap" },
  { code: "FLEXI", label: "Flexi Cap" },
  { code: "ETF", label: "ETF" },
  { code: "OTHER", label: "Other" }
];

function CategoryButtons({ selected, onSelect }) {
  return (
    <div className="category-buttons">
      {CATEGORIES.map(({ code, label }) => (
        <button
          key={code}
          className={selected === code ? "active" : ""}
          onClick={() => onSelect(code)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
  
  export default CategoryButtons;
  