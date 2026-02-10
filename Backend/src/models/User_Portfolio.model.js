import mongoose from "mongoose";

const UserPortfolioSchema = new mongoose.Schema(
  {
    session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true
    },

    scheme_name: {
      type: String,
      required: true
    },

    units: {
      type: Number,
      required: true
    },

    amfi_code: {
      type: String   // optional, can be filled later
    }
  },
  { timestamps: true }
);

const UserPortfolio = mongoose.model(
  "UserPortfolio",
  UserPortfolioSchema
);

export default UserPortfolio;
