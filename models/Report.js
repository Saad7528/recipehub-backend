import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema({
  recipeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Recipe",
    required: true,
  },
  reporterEmail: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    enum: ["Spam", "Offensive Content", "Copyright Issue"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "resolved", "dismissed"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Report || mongoose.model("Report", ReportSchema);
