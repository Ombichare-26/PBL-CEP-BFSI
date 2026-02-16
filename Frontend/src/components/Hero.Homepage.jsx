import "./Hero.Homepage.css";
import {useNavigate} from "react-router-dom";

export default function Hero() {
  const navigate = useNavigate();
  return (
    <section className="hero">
      <div className="hero-text">
        <h1>Analyse Portfolio</h1>
        <h1>For Best Returns</h1>

        <p>
          Upload your CAS and get AI-driven insights for better investment
          decisions.
        </p>

        <div className="hero-buttons">
          <button className="primary-btn" onClick={() => navigate("/input")}>Get Your CAS</button>
          <button className="secondary-btn" onClick={console.log("Get Recommendation")}>Get Recommendation</button>
        </div>
      </div>

      <div className="hero-image">
        <div className="image-box">📊</div>
      </div>
    </section>
  );
}
