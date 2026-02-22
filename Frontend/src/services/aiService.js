import axios from "axios";

const BASE_URL = "http://localhost:8000/api/v1";

export const evaluateChoice = async (payload) => {
  const res = await axios.post(`${BASE_URL}/ai/evaluate-choice`, payload);
  return res.data;
};

