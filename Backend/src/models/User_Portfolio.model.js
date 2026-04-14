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
    },

    risk_level: {
      type: String,
      default: ""
    },

    risk_source_type: {
      type: String,
      default: ""
    },

    risk_source_url: {
      type: String,
      default: ""
    },

    risk_last_verified_at: {
      type: Date,
      default: null
    },

    risk_match_confidence: {
      type: Number,
      default: 0
    },

    risk_lookup_status: {
      type: String,
      default: ""
    },

    risk_lookup_query: {
      type: String,
      default: ""
    },

    category: {
    type: String,
    enum: ["ETF", "FLEXI", "SMALL","OTHER"],// optional, can be filled later
    required: false
  }
  },
  { timestamps: true }
);

const UserPortfolio = mongoose.model(
  "UserPortfolio",
  UserPortfolioSchema
);

export default UserPortfolio;
