import "./Link.Homepage.css";

export default function LinkHomepage() {
  return (
    <section className="link-section">
      <div className="marquee">
        <div className="marquee-content">
          <span>
            To generate your CAS file visit MF CENTRAL →
          </span>

          <a
            href="https://www.mfcentral.com"
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"

          >
            LINK
          </a>

          
        </div>
      </div>
    </section>
  );
}
