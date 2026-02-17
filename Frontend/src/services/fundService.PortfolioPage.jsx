import axios from "axios";

const BASE_URL = "http://localhost:8000/api/v1";

/**
 * Get fund details (live price, day change) by AMFI code
 * Fetches from backend which uses AMFI India and MFapi.in for real data
 */
export const getFundDetails = async (amfiCode) => {
  const res = await axios.get(`${BASE_URL}/fund/${amfiCode}`);
  return res.data;
};

/**
 * Get historical NAV data for a fund by AMFI code
 * Fetches real historical data from MFapi.in (Indian Mutual Fund API)
 * Falls back to synthetic data if API fails
 * 
 * @param {string} amfiCode - AMFI code of the fund
 * @param {string} period - One of: "1d", "1m", "3m", "1y", "5y"
 */
export const getFundHistoricalNav = async (amfiCode, period = "1m") => {
  const res = await axios.get(`${BASE_URL}/fund/${amfiCode}/historical`, {
    params: { period }
  });
  return res.data;
};
