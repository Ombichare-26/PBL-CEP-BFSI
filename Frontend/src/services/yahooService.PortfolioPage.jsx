import axios from "axios";

const BASE_URL = "http://localhost:8000/api/v1";

export const getFundDetails = async (ticker) => {
  const res = await axios.get(`${BASE_URL}/fund/${ticker}`);
  return res.data;
};
