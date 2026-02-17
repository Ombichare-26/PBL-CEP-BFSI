export default function CasUpload({ setPdfFile }) {
  return (
    <div>
      <h3>Upload CAS PDF</h3>
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setPdfFile(e.target.files[0])}
      />
    </div>
  );
}
