import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import UserPortfolio from "../models/User_Portfolio.model.js";

const saveUserPortfolio = asyncHandler(async (req, res) => {
  const { session_id, funds } = req.body;

  if (!session_id) {
    throw new ApiError(400, "Session ID is required");
  }

  if(!Array.isArray(funds) || funds.length==0)
  {
    throw new ApiError("PORTFOLIO INPUT FAILED!! Fund array is required!!")
  }

  const insertedFunds=[];

  for(const fund of funds)
  {
    if(!fund.scheme_name || fund.units==undefined)
    {
      throw new ApiError("NULL values found for scheme name or units..those values are required")
    }

   

    await UserPortfolio.create(
      {
        session_id,
        scheme_name:fund.scheme_name,
        units:fund.units,
        amfi_code:fund.amfi_code,
      });
    
    insertedFunds.push(fund);
  }
  


    return res.status(201).json(
    new ApiResponse(
      201,
      insertedFunds,
      "CAS portfolio data saved successfully"
    ));
  
  });

export { saveUserPortfolio };
