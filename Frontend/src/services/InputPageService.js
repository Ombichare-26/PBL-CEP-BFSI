import axios from "axios";

const BASE_URL = "http://localhost:8000/api/v1";

/** Create a new session. Returns { data: { session_id } } */
export const createSession = async () => {
  const res = await axios.post(`${BASE_URL}/session`);
  return res.data;
};

/** Upload CAS PDF and extract portfolio. FormData must include: cas_pdf (File), session_id (string) */
export const uploadCasAndExtract = async (formData) => {
  const res = await axios.post(`${BASE_URL}/portfolio/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return res.data;
};

/** Save user investment input for a session */
export const saveInvestmentInput = async (payload) => {
  const res = await axios.post(`${BASE_URL}/investments`, payload);
  return res.data;
};
