import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import InvestmentInput from "../models/Investment_Input.model.js";

const saveInvestmentInput = asyncHandler(async (req, res) => {
  const { session_id, investable_amount, expected_roi, duration_months } =
    req.body;

  if (!session_id) {
    throw new ApiError(400, "Session ID is required");
  }

  if (
    investable_amount === undefined ||
    expected_roi === undefined ||
    duration_months === undefined
  ) {
    throw new ApiError(400, "Investment amount, ROI and duration are required");
  }

  const investmentInput = await InvestmentInput.create({
    session_id,
    investable_amount,
    expected_roi,
    duration_months
  });

  if (!investmentInput) {
    throw new ApiError(500, "Failed to save investment input");
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      investmentInput,
      "Investment input saved successfully"
    )
  );
});

const getInvestmentBySession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    throw new ApiError(400, "Session ID is required");
  }

  const investmentInput = await InvestmentInput.findOne({
    session_id: sessionId
  });

  if (!investmentInput) {
    throw new ApiError(404, "Investment input not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      investmentInput,
      "Investment input fetched successfully"
    )
  );
});

export { saveInvestmentInput, getInvestmentBySession };
