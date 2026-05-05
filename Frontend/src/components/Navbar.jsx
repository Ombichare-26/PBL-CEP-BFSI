import { useState } from "react";
import "./Navbar.css";

export default function Navbar() {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <nav className="navbar">
        <h2 className="logo">FineRcom</h2>
        <button className="nav-btn" onClick={() => setShowHelp(true)}>
          Get Help
        </button>
      </nav>

      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div
            className="help-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="help-modal-header">
              <span className="help-icon">💡</span>
              <h3>Need Help?</h3>
              <button
                className="help-close-btn"
                onClick={() => setShowHelp(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="help-modal-body">
              <div className="help-disclaimer-banner">
                <span className="disclaimer-icon">⚠️</span>
                <p>
                  <strong>Disclaimer:</strong> The information and insights
                  provided here are for <strong>guidance purposes only</strong>{" "}
                  and should not be solely relied upon. It is advisable to{" "}
                  <strong>make financial decisions with caution.</strong>{" "}
                  
                </p>
              </div>
            </div>

            <div className="help-modal-footer">
              <button
                className="help-got-it-btn"
                onClick={() => setShowHelp(false)}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
