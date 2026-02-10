import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import UserPortfolio from "../models/User_Portfolio.model.js";

const saveUserPortfolio = asyncHandler(async (req, res) => {
  const { session_id, scheme_name, units, amfi_code } = req.body;

  if (!session_id) {
    throw new ApiError(400, "Session ID is required");
  }

  if (!scheme_name || units === undefined) {
    throw new ApiError(400, "Scheme name and units are required");
  }

  const portfolioInput = await UserPortfolio.create({
    session_id,
    scheme_name,
    units,
    amfi_code // optional
  });

    if (!portfolioInput) {
    throw new ApiError(500, "Failed to save portfolio data");
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
