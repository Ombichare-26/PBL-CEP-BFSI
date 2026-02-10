import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Session from "../models/Session.model.js";

export const createSession = asyncHandler(async (req, res) => {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 2);

  const session = await Session.create({
    expires_at: expiresAt,
  });

  if (!session) {
    throw new ApiError(500, "Failed to create session");
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      { session_id: session._id },
      "Session created successfully"
    )
  );
});
