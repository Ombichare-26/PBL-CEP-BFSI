import React, { useState } from "react";
import Papa from "papaparse";

function PortfolioUpload() {
  const [portfolioData, setPortfolioData] = useState(null);
  const [error, setError] = useState("");

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError("");

    if (file.type === "text/csv") {
      handleCSV(file);
    } else if (file.type === "application/pdf") {
        
      handlePDF(file);
    } else {
      setError("Unsupported file type. Upload CSV or PDF only.");
    }
  };

  return (
    <div>
      <h3>Upload CAS File</h3>

      <input
        type="file"
        accept=".csv,.pdf"
        onChange={handleFileUpload}
      />

      {error && <p style={{ color: "red" }}>{error}</p>}

      {portfolioData && (
        <pre>{JSON.stringify(portfolioData, null, 2)}</pre>
      )}
    </div>
  );
}

export default PortfolioUpload;
