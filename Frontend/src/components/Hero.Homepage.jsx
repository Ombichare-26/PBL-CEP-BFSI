import "./Hero.Homepage.css";


export default function Hero() {
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
          <button className="primary-btn" onClick={console}>Get Your CAS</button>
          <button className="secondary-btn" onClick={handleClick}>Get Recommendation</button>
        </div>
      </div>

      <div className="hero-image">
        <div className="image-box">📊</div>
      </div>
    </section>
  );
}
