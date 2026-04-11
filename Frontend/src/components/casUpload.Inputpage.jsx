import "./casUpload.Inputpage.css";

export default function CasUpload({ setPdfFile, pdfFile }) {
  return (
    <div className="cas-upload">
      <div className="cas-upload__header">
        <span className="cas-upload__tag">Step 1</span>
        <h3>Upload CAS PDF</h3>
      </div>
      <p className="cas-hint">
        Upload the latest CAS file so we can extract your current portfolio and category allocation.
      </p>
      <input
        className="cas-input"
        type="file"
        accept=".pdf"
        onChange={(e) => setPdfFile(e.target.files[0])}
      />
      <div className="cas-file-state">
        {pdfFile ? `Selected: ${pdfFile.name}` : "No file selected yet"}
      </div>
    </div>
  );
}
