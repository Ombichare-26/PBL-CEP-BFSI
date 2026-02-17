const BACKEND_BASE = "http://localhost:8000/api/v1";
const CAS_BASE = "http://localhost:9000";

/* 1️⃣ Create session */
export async function createSession() {
  const res = await fetch(`${BACKEND_BASE}/session`, {
    method: "POST"
  });

  return res.json();
}

/* 2️⃣ Upload CAS PDF to Python service */
export async function uploadCASPdf(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${CAS_BASE}/extract-cas`, {
    method: "POST",
    body: formData
  });

  return res.json();
}

/* 3️⃣ Save investment input */
export async function saveInvestmentInput(sessionId, data) {
  const res = await fetch(`${BACKEND_BASE}/investments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      ...data
    })
  });

  return res.json();
}

/* 4️⃣ Save portfolio */
export async function savePortfolio(sessionId, funds) {
  const res = await fetch(`${BACKEND_BASE}/portfolio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      funds
    })
  });

  return res.json();
}
