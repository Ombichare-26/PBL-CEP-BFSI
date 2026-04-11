import "./HowWeWork.Homepage.css";

export default function HowWeWork() {
  return (
    <section className="how" id="how-it-works">
      <span className="section-tag">Simple flow</span>
      <h2>How We Work</h2>
      <p className="how-subtitle">
        A short guided flow from raw CAS data to an actionable allocation review.
      </p>

      <div className="steps">
        <div className="step">
          <h3>1</h3>
          <p>Upload your CAS</p>
          <span>Securely import your current portfolio snapshot.</span>
        </div>

        <div className="step">
          <h3>2</h3>
          <p>Analyse your portfolio</p>
          <span>Break holdings into categories and detect concentration.</span>
        </div>

        <div className="step">
          <h3>3</h3>
          <p>Get AI recommendations</p>
          <span>See target allocation and refine it through chatbot follow-up.</span>
        </div>
      </div>
    </section>
  );
}
