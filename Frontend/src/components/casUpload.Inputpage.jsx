import "./CasUpload.css";

export default function CasUpload({ onFileSelect }) {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Basic validation: PDF only
    if (file.type !== "application/pdf") {
      alert("Please upload a valid CAS PDF file");
      return;
    }

    onFileSelect(file);
  };

  
  return (
    <div className="cas-upload">
      <label className="cas-label">Upload CAS File</label>

      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        className="cas-input"
      />

      <p className="cas-hint">
        Supported format: PDF (Downloaded CAS statement)
      </p>
    </div>
  );
}
