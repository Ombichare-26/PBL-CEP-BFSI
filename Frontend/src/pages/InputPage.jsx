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
import Loader from "../components/Loader";
import "./InputPage.css";
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
        risk_level: fund.risk_level,
        risk_source_type: fund.risk_source_type,
        risk_source_url: fund.risk_source_url,
        risk_match_confidence: fund.risk_match_confidence,
        risk_lookup_status: fund.risk_lookup_status,
        risk_lookup_query: fund.risk_lookup_query,
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
    <div className="input-page">
    {loading && <Loader />} 

      <div className="input-page__shell">
        <section className="input-page__intro">
          <span className="input-page__eyebrow">Portfolio setup</span>
          <h1>Upload your CAS and set your investment goal</h1>
          <p>
            We’ll read your current holdings, combine them with your expected ROI and time horizon,
            and then prepare the portfolio analysis experience.
          </p>

          <div className="input-page__highlights">
            <div className="input-page__highlight">
              <strong>Current portfolio snapshot</strong>
              <span>Import your latest CAS to capture category exposure.</span>
            </div>
            <div className="input-page__highlight">
              <strong>Goal-based inputs</strong>
              <span>Add expected return, duration, and capital for a better recommendation.</span>
            </div>
          </div>
        </section>

        <section className="input-page__form-panel">
          <CasUpload setPdfFile={setPdfFile} pdfFile={pdfFile} />

          <InvestmentForm
            investmentData={investmentData}
            setInvestmentData={setInvestmentData}
          />

          <div className="input-page__actions">
            <button className="input-page__submit" onClick={handleSubmit} disabled={loading}>
              {loading ? "Processing..." : "Generate Portfolio View"}
            </button>

            {error && <p className="input-page__error">{error}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
