import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema(
  {
    expires_at: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

const Session = mongoose.model("Session", SessionSchema);

export default Session;