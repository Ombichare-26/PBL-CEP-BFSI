import "./Hero.Homepage.css";
import {useNavigate} from "react-router-dom";

export default function Hero() {
  const navigate = useNavigate();
  return (
    <section className="hero">
      <div className="hero-text">
        <span className="hero-eyebrow">AI-assisted mutual fund review</span>
        <h1>Analyse your portfolio with more clarity</h1>
        <h1>and act with more confidence</h1>

        <p>
          Upload your CAS, understand concentration risks, and get practical
          allocation guidance tailored to your investment goals.
        </p>

        <div className="hero-buttons">
          <button
            className="primary-btn"
            onClick={() => window.open("https://www.mfcentral.com", "_blank", "noopener,noreferrer")}
          >
            Get Your CAS
          </button>
          <button
            className="secondary-btn"
            onClick={() => navigate("/input")}
          >
            Get Recommendation
          </button>
        </div>

        <div className="hero-metrics">
          <div className="hero-metric">
            <strong>CAS Upload</strong>
            <span>Bring your existing holdings into one view</span>
          </div>
          <div className="hero-metric">
            <strong>AI Allocation Review</strong>
            <span>Spot overconcentration and rebalance direction</span>
          </div>
        </div>
      </div>

      <div className="hero-image">
        <div className="image-box">
          <div className="image-box__ring" />
          <div className="image-box__content">
            <img src="/hero_3d_avatar.png" alt="Hero 3D Avatar" className="image-box__icon" />
            <div className="image-box__card image-box__card--top">Balanced view</div>
            <div className="image-box__card image-box__card--bottom">AI insights</div>
          </div>
        </div>
      </div>
    </section>
  );
}
