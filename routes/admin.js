import express from "express";
import { authenticate, authorizeAdmin } from "../middleware/auth.js";
import User from "../models/User.js";
import Recipe from "../models/Recipe.js";
import Report from "../models/Report.js";
import Payment from "../models/Payment.js";

const router = express.Router();

// Apply admin auth middlewares to all admin routes
router.use(authenticate, authorizeAdmin);

// GET /api/admin/stats - Overview statistics
router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalRecipes = await Recipe.countDocuments();
    const totalPremiumMembers = await User.countDocuments({ isPremium: true });
    const totalReports = await Report.countDocuments({ status: "pending" });

    return res.json({
      totalUsers,
      totalRecipes,
      totalPremiumMembers,
      totalReports,
    });
  } catch (error) {
    console.error("Admin Stats Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/users - List users
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select("-password").lean();
    
    const serializedUsers = users.map((u) => ({
      ...u,
      _id: u._id.toString(),
    }));

    return res.json({ users: serializedUsers });
  } catch (error) {
    console.error("Admin Get Users Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/users - Perform user status modification (block/unblock/promote/demote)
router.put("/users", async (req, res) => {
  try {
    const { targetUserId, action } = req.body;
    if (!targetUserId || !action) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Protect blocking self
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: "You cannot block yourself" });
    }

    if (action === "block") {
      user.isBlocked = true;
    } else if (action === "unblock") {
      user.isBlocked = false;
    } else if (action === "promote") {
      user.role = "admin";
    } else if (action === "demote") {
      user.role = "user";
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    await user.save();
    return res.json({ message: "User state updated successfully" });
  } catch (error) {
    console.error("Admin Update User Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/recipes - Manage recipes catalog
router.get("/recipes", async (req, res) => {
  try {
    const recipes = await Recipe.find().sort({ createdAt: -1 }).lean();

    const serializedRecipes = recipes.map((r) => ({
      ...r,
      _id: r._id.toString(),
      authorId: r.authorId.toString(),
    }));

    return res.json({ recipes: serializedRecipes });
  } catch (error) {
    console.error("Admin Get Recipes Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/recipes - Update feature status
router.put("/recipes", async (req, res) => {
  try {
    const { recipeId, isFeatured } = req.body;
    if (!recipeId) {
      return res.status(400).json({ error: "Recipe ID is required" });
    }

    const recipe = await Recipe.findByIdAndUpdate(
      recipeId,
      { isFeatured },
      { new: true }
    );

    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    return res.json({
      message: `Recipe featured status updated to ${isFeatured}`,
      recipe: {
        ...recipe.toObject(),
        _id: recipe._id.toString(),
        authorId: recipe.authorId.toString(),
      },
    });
  } catch (error) {
    console.error("Admin Update Recipe Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/transactions - Transaction history log
router.get("/transactions", async (req, res) => {
  try {
    const payments = await Payment.find().sort({ paidAt: -1 }).lean();

    const serializedPayments = payments.map((p) => ({
      ...p,
      _id: p._id.toString(),
      userId: p.userId.toString(),
      recipeId: p.recipeId ? p.recipeId.toString() : null,
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    }));

    return res.json({ payments: serializedPayments });
  } catch (error) {
    console.error("Admin Get Transactions Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
