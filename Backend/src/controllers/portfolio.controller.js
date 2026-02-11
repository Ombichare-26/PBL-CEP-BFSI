import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import UserPortfolio from "../models/User_Portfolio.model.js";

const saveUserPortfolio = asyncHandler(async (req, res) => {
  const { session_id, funds } = req.body;

  if (!session_id) {
    throw new ApiError(400, "Session ID is required");
  }

  
  

    

    return res.status(201).json(
    new ApiResponse(
      201,
      portfolioInput,
      "CAS portfolio data saved successfully"
    )
  );
});

export { saveUserPortfolio };
