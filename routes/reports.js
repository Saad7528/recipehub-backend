import express from "express";
import { authenticate, authorizeAdmin } from "../middleware/auth.js";
import Report from "../models/Report.js";
import Recipe from "../models/Recipe.js";

const router = express.Router();

// POST /api/reports - Report a recipe
router.post("/", authenticate, async (req, res) => {
  try {
    const { recipeId, reason } = req.body;
    if (!recipeId || !reason) {
      return res.status(400).json({ error: "Recipe ID and reason are required" });
    }

    if (!["Spam", "Offensive Content", "Copyright Issue"].includes(reason)) {
      return res.status(400).json({ error: "Invalid report reason" });
    }

    // Check if recipe exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    const report = await Report.create({
      recipeId,
      reporterEmail: req.user.email,
      reason,
      status: "pending",
      createdAt: new Date(),
    });

    return res.status(201).json({ message: "Recipe reported successfully", reportId: report._id });
  } catch (error) {
    console.error("Report Recipe Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports - Get all reports (Admin only)
router.get("/", authenticate, authorizeAdmin, async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 }).lean();

    const populatedReports = [];
    for (let r of reports) {
      const recipe = await Recipe.findById(r.recipeId).select("recipeName recipeImage authorEmail").lean();
      populatedReports.push({
        ...r,
        _id: r._id.toString(),
        recipeId: r.recipeId.toString(),
        recipeName: recipe?.recipeName || "Unknown/Deleted Recipe",
        recipeImage: recipe?.recipeImage || "",
        recipeAuthorEmail: recipe?.authorEmail || "N/A",
      });
    }

    return res.json({ reports: populatedReports });
  } catch (error) {
    console.error("Get Reports Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/reports/:reportId - Update report status (Admin only)
router.put("/:reportId", authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;
    if (!status || !["resolved", "dismissed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const report = await Report.findByIdAndUpdate(
      reportId,
      { status },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.json({ message: `Report status updated to ${status}` });
  } catch (error) {
    console.error("Update Report Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/reports/:reportId - Delete report (Admin only)
router.delete("/:reportId", authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await Report.findByIdAndDelete(reportId);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error("Delete Report Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
