// import { asyncHandler } from "../utils/asyncHandler.js";
// import { ApiError } from "../utils/ApiError.js";
// import { ApiResponse } from "../utils/ApiResponse.js";
// import UserPortfolio from "../models/User_Portfolio.model.js";

// const saveUserPortfolio = asyncHandler(async (req, res) => {
//   const { session_id, funds } = req.body;

//   if (!session_id) {
//     throw new ApiError(400, "Session ID is required");
//   }

//   if(!Array.isArray(funds) || funds.length==0)
//   {
//     throw new ApiError("PORTFOLIO INPUT FAILED!! Fund array is required!!")
//   }

//   const insertedFunds=[];

//   for(const fund of funds)
//   {
//     if(!fund.scheme_name || fund.units==undefined)
//     {
//       throw new ApiError("NULL values found for scheme name or units..those values are required")
//     }

   

//     await UserPortfolio.create(
//       {
//         session_id,
//         scheme_name:fund.scheme_name,
//         units:fund.units,
//         amfi_code:fund.amfi_code,
//       });
    
//     insertedFunds.push(fund);
//   }
  


//     return res.status(201).json(
//     new ApiResponse(
//       201,
//       insertedFunds,
//       "CAS portfolio data saved successfully"
//     ));
  
//   });

// export { saveUserPortfolio };








import fs from "fs";
import path from "path";
import UserPortfolio from "../models/User_Portfolio.model.js";

export const uploadPortfolioFromJSON = async (req, res) => {
  try {
    // Replace with actual session id
    const sessionId = "698d66ebfedf8904359dfbef";

    // Get absolute path to backend root JSON file
    const filePath = path.join(process.cwd(), "portfolio_holdings.json");

    // Read JSON file
    const rawData = fs.readFileSync(filePath, "utf-8");
    const extractedData = JSON.parse(rawData);

    // Format data according to schema
    const formattedData = extractedData.map((fund) => ({
      session_id: sessionId,
      scheme_name: fund.scheme_name,
      units: fund.units,
      amfi_code: fund.amfi_code || null
    }));

    // Optional: Remove old portfolio for same session
    await UserPortfolio.deleteMany({ session_id: sessionId });

    // Insert into MongoDB
    const savedData = await UserPortfolio.insertMany(formattedData);

    return res.status(200).json({
      success: true,
      message: "Portfolio uploaded successfully",
      data: savedData
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error uploading portfolio",
      error: error.message
    });
  }
};
