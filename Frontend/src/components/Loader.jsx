import "./Loader.css";

export default function Loader() {
  return (
    <div className="loader-wrapper">
      <div className="spinner"></div>
      <p>Extracting portfolio... Please wait</p>
    </div>
  );
}