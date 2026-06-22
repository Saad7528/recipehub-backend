import express from "express";
import { authenticate } from "../middleware/auth.js";
import Favorite from "../models/Favorite.js";
import Recipe from "../models/Recipe.js";

const router = express.Router();

// GET /api/favorites - Get all favorites of authenticated user
router.get("/", authenticate, async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.user._id }).lean();
    const recipeIds = favorites.map((f) => f.recipeId);

    const recipes = await Recipe.find({ _id: { $in: recipeIds }, status: "published" }).lean();
    
    const serializedRecipes = recipes.map((recipe) => ({
      ...recipe,
      _id: recipe._id.toString(),
      authorId: recipe.authorId.toString(),
    }));

    return res.json({ recipes: serializedRecipes });
  } catch (error) {
    console.error("Get Favorites Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/favorites - Add a recipe to favorites
router.post("/", authenticate, async (req, res) => {
  try {
    const { recipeId } = req.body;
    if (!recipeId) {
      return res.status(400).json({ error: "Recipe ID is required" });
    }

    const existingFav = await Favorite.findOne({
      userId: req.user._id,
      recipeId,
    });

    if (existingFav) {
      return res.json({ message: "Already in favorites" });
    }

    await Favorite.create({
      userEmail: req.user.email,
      userId: req.user._id,
      recipeId,
      addedAt: new Date(),
    });

    return res.status(201).json({ message: "Added to favorites" });
  } catch (error) {
    console.error("Add Favorite Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/favorites/:recipeId - Remove a recipe from favorites
router.delete("/:recipeId", authenticate, async (req, res) => {
  try {
    const { recipeId } = req.params;
    await Favorite.findOneAndDelete({
      userId: req.user._id,
      recipeId,
    });

    return res.json({ message: "Removed from favorites" });
  } catch (error) {
    console.error("Delete Favorite Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
