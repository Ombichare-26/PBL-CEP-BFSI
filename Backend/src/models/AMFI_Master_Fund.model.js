import mongoose from "mongoose";

const AMFIMasterSchema = new mongoose.Schema({
  amfi_code: {
    type: String,
    unique: true,
    required: true,
    index: true,
    trim: true,
  },
  schema_name: {
    type: String,
    required: true,
    trim: true,
  },
  isin: {
    type: String,
    default: "",
    trim: true,
  },
  fund_house: {
    type: String,
    default: "",
    trim: true,
  },
  category: {
    type: String,
    default: "",
    trim: true,
  },
  expense_ratio: {
    type: Number,
    default: null,
  },
  risk_level: {
    type: String,
    default: "",
    trim: true,
  },
  risk_source_type: {
    type: String,
    default: "",
    trim: true,
  },
  risk_source_url: {
    type: String,
    default: "",
    trim: true,
  },
  risk_as_of_date: {
    type: Date,
    default: null,
  },
  risk_last_verified_at: {
    type: Date,
    default: null,
  },
  risk_notes: {
    type: String,
    default: "",
    trim: true,
  },
  curr_nav: {
    type: Number,
    default: null,
  },
  nav_last_updated: {
    type: Date,
    default: null,
  },
  last_master_sync_at: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

export default mongoose.model("AMFIMaster", AMFIMasterSchema);
