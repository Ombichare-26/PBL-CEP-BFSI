import axios from "axios";

const BASE_URL = "http://localhost:8000/api/v1";

export const getUserInput = async (sessionId) => {
  const res = await axios.get(`${BASE_URL}/investments/${sessionId}`);
  return res.data;
};

export const getPortfolio = async (sessionId) => {
  const res = await axios.get(`${BASE_URL}/portfolio/${sessionId}`);
  return res.data;
};
