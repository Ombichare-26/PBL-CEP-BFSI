import { useState } from "react";
import InvestmentForm from "../components/Investmentform.Inputpage";
import CasUpload from "../components/casUpload.Inputpage";
import {
  createSession,
  uploadCASPdf,
  saveInvestmentInput,
  savePortfolio
} from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Input() {
  // -------------------------
  // State
  // -------------------------
  const [pdfFile, setPdfFile] = useState(null);

  const [investmentData, setInvestmentData] = useState({
    amount: "",
    roi: "",
    duration: ""
  });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // -------------------------
  // Submit Handler
  // -------------------------
  const handleSubmit = async () => {
    try {
      setError("");

      // 🔒 Validation
      if (!pdfFile) {
        setError("Please upload CAS PDF");
        return;
      }

      if (
        !investmentData.amount ||
        !investmentData.roi ||
        !investmentData.duration
      ) {
        setError("Please fill all investment details");
        return;
      }

      setLoading(true);

      // 1️⃣ Create session
      const sessionRes = await createSession();
      const sessionId = sessionRes.data.session_id;

      // 2️⃣ Upload CAS → Python microservice
      const funds = await uploadCASPdf(pdfFile);

      if (!Array.isArray(funds) || funds.length === 0) {
        throw new Error("CAS extraction returned no portfolio data");
      }

      // 3️⃣ Sanitize portfolio payload (important)
      const sanitizedFunds = funds.map((fund) => ({
        scheme_name: fund.scheme_name,
        units: fund.units,
        amfi_code: fund.amfi_code,
        nav: fund.nav,                // ✅ ADD
        current_value: fund.current_value,  // ✅ ADD
        category: fund.category
      }));

      // 4️⃣ Save investment input
      await saveInvestmentInput(sessionId, {
        investable_amount: Number(investmentData.amount),
        expected_roi: Number(investmentData.roi),
        duration_months: Number(investmentData.duration)
      });

      // 5️⃣ Save portfolio
      await savePortfolio(sessionId, sanitizedFunds);

      // alert("Portfolio uploaded successfully 🚀");
// Save session in localStorage (for PortfolioPage fallback)
localStorage.setItem("chai_portfolio_session_id", sessionId);

// Navigate to portfolio page
navigate(`/portfolio?session_id=${sessionId}`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <>
      <CasUpload setPdfFile={setPdfFile} />

      <InvestmentForm
        investmentData={investmentData}
        setInvestmentData={setInvestmentData}
      />

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Processing..." : "Submit"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </>
  );
}
