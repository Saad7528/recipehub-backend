import express from "express";
import { authenticate } from "../middleware/auth.js";
import Recipe from "../models/Recipe.js";
import Favorite from "../models/Favorite.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";

const router = express.Router();

// GET /api/dashboard/stats - User stats
router.get("/stats", authenticate, async (req, res) => {
  try {
    const totalRecipes = await Recipe.countDocuments({ authorId: req.user._id });
    const totalFavorites = await Favorite.countDocuments({ userId: req.user._id });
    
    const userRecipes = await Recipe.find({ authorId: req.user._id }).select("likesCount");
    const likesReceived = userRecipes.reduce((sum, recipe) => sum + (recipe.likesCount || 0), 0);

    return res.json({
      totalRecipes,
      totalFavorites,
      likesReceived,
      isPremium: req.user.isPremium || false,
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/my-recipes - Logged-in user's recipes
router.get("/my-recipes", authenticate, async (req, res) => {
  try {
    const recipes = await Recipe.find({ authorId: req.user._id }).sort({ createdAt: -1 }).lean();

    const serializedRecipes = recipes.map((recipe) => ({
      ...recipe,
      _id: recipe._id.toString(),
      authorId: recipe.authorId.toString(),
    }));

    return res.json({ recipes: serializedRecipes });
  } catch (error) {
    console.error("Get My Recipes Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/purchased - Purchased paid recipes
router.get("/purchased", authenticate, async (req, res) => {
  try {
    const payments = await Payment.find({
      userId: req.user._id,
      recipeId: { $ne: null },
      paymentStatus: "paid",
    }).lean();

    const recipeIds = payments.map((p) => p.recipeId);
    const recipes = await Recipe.find({ _id: { $in: recipeIds } }).lean();

    const serializedRecipes = recipes.map((recipe) => ({
      ...recipe,
      _id: recipe._id.toString(),
      authorId: recipe.authorId.toString(),
    }));

    return res.json({ recipes: serializedRecipes });
  } catch (error) {
    console.error("Get Purchased Recipes Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/dashboard/profile - Update user profile
router.put("/profile", authenticate, async (req, res) => {
  try {
    const { name, image } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.name = name;
    if (image) {
      user.image = image;
    }
    await user.save();

    return res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        isPremium: user.isPremium,
      },
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
