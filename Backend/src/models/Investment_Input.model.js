import mongoose from "mongoose";

const InvestmentInputSchema = new mongoose.Schema(
  {
    session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true
    },

    investable_amount: {
      type: Number,
      required: true
    },

    expected_roi: {
      type: Number,
      required: true
    },

    duration_months: {
      type: Number,
      required: true
    }
  },
  { timestamps: true }
);

const InvestmentInput = mongoose.model(
  "InvestmentInput",
  InvestmentInputSchema
);

export default InvestmentInput;
