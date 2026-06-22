import express from "express";
import { authenticate } from "../middleware/auth.js";
import Recipe from "../models/Recipe.js";
import User from "../models/User.js";
import Payment from "../models/Payment.js";
import { verifyToken } from "../utils/jwt.js";

const router = express.Router();

// GET /api/recipes - Fetch all recipes with filtering, search & pagination
router.get("/", async (req, res) => {
  try {
    const search = req.query.search || "";
    const categoryParam = req.query.category || "";
    const cuisine = req.query.cuisine || "";
    const difficulty = req.query.difficulty || "";
    
    // Pagination parameters
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "8", 10);
    const skip = (page - 1) * limit;

    // Build DB Query
    const query = { status: "published" };

    if (req.query.featured === "true") {
      query.isFeatured = true;
    }

    if (search) {
      query.$or = [
        { recipeName: { $regex: search, $options: "i" } },
        { cuisineType: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    if (categoryParam) {
      const categories = categoryParam.split(",").map((c) => c.trim()).filter(Boolean);
      if (categories.length > 0) {
        query.category = { $in: categories };
      }
    }

    if (cuisine) {
      query.cuisineType = { $regex: `^${cuisine}$`, $options: "i" };
    }

    if (difficulty) {
      query.difficultyLevel = difficulty;
    }

    let sort = { createdAt: -1 };
    if (req.query.sort === "likes") {
      sort = { likesCount: -1 };
    }

    const total = await Recipe.countDocuments(query);
    const recipes = await Recipe.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const serializedRecipes = recipes.map((recipe) => ({
      ...recipe,
      _id: recipe._id.toString(),
      authorId: recipe.authorId.toString(),
    }));

    return res.json({
      recipes: serializedRecipes,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get Recipes Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/recipes - Create a new recipe
router.post("/", authenticate, async (req, res) => {
  try {
    const user = req.user;

    const {
      recipeName,
      recipeImage,
      category,
      cuisineType,
      difficultyLevel,
      preparationTime,
      ingredients,
      instructions,
      price,
    } = req.body;

    if (
      !recipeName ||
      !recipeImage ||
      !category ||
      !cuisineType ||
      !difficultyLevel ||
      !preparationTime ||
      !ingredients ||
      !instructions
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Limit check for normal users: max 2 recipes
    if (!user.isPremium) {
      const recipeCount = await Recipe.countDocuments({ authorId: user._id });
      if (recipeCount >= 2) {
        return res.status(400).json({
          error: "Normal users can publish a maximum of 2 recipes. Upgrade to Premium to publish unlimited recipes!",
          limitReached: true,
        });
      }
    }

    const newRecipe = await Recipe.create({
      recipeName,
      recipeImage,
      category,
      cuisineType,
      difficultyLevel,
      preparationTime: Number(preparationTime),
      ingredients: Array.isArray(ingredients) ? ingredients : ingredients.split(",").map((i) => i.trim()),
      instructions,
      price: price ? Number(price) : 0,
      authorId: user._id,
      authorName: user.name,
      authorEmail: user.email,
      likesCount: 0,
      isFeatured: false,
      status: "published",
    });

    return res.status(201).json({ message: "Recipe created successfully", recipeId: newRecipe._id });
  } catch (error) {
    console.error("Create Recipe Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/recipes/:id - Fetch details of a single recipe (with purchase check)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Check optional token cookie
    const token = req.cookies.token;
    let userId = null;
    let userRole = null;

    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        userId = payload.userId;
        userRole = payload.role;
      }
    }

    const isAuthor = userId && recipe.authorId.toString() === userId;
    const isAdmin = userRole === "admin";

    // Handle locked/paid recipe validation
    if (recipe.price > 0) {
      let isUnlocked = false;

      if (isAuthor || isAdmin) {
        isUnlocked = true;
      } else if (userId) {
        const purchase = await Payment.findOne({
          userId,
          recipeId: recipe._id,
          paymentStatus: "paid",
        });
        if (purchase) {
          isUnlocked = true;
        }
      }

      if (!isUnlocked) {
        const lockedRecipe = recipe.toObject();
        delete lockedRecipe.ingredients;
        delete lockedRecipe.instructions;

        return res.json({
          recipe: {
            ...lockedRecipe,
            _id: recipe._id.toString(),
            authorId: recipe.authorId.toString(),
          },
          isLocked: true,
        });
      }
    }

    return res.json({
      recipe: {
        ...recipe.toObject(),
        _id: recipe._id.toString(),
        authorId: recipe.authorId.toString(),
      },
      isLocked: false,
    });
  } catch (error) {
    console.error("Get Recipe Detail Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/recipes/:id - Update recipe details
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    const isAuthor = recipe.authorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const body = req.body;
    const allowedUpdates = [
      "recipeName",
      "recipeImage",
      "category",
      "cuisineType",
      "difficultyLevel",
      "preparationTime",
      "ingredients",
      "instructions",
      "price",
    ];

    allowedUpdates.forEach((field) => {
      if (body[field] !== undefined) {
        if (field === "ingredients" && !Array.isArray(body[field])) {
          recipe[field] = body[field].split(",").map((i) => i.trim());
        } else {
          recipe[field] = body[field];
        }
      }
    });

    await recipe.save();

    return res.json({
      message: "Recipe updated successfully",
      recipe: {
        ...recipe.toObject(),
        _id: recipe._id.toString(),
        authorId: recipe.authorId.toString(),
      },
    });
  } catch (error) {
    console.error("Update Recipe Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/recipes/:id - Delete a recipe
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    const isAuthor = recipe.authorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await Recipe.findByIdAndDelete(id);

    return res.json({ message: "Recipe deleted successfully" });
  } catch (error) {
    console.error("Delete Recipe Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/recipes/:id/like - Like a recipe
router.post("/:id/like", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const recipe = await Recipe.findByIdAndUpdate(
      id,
      { $inc: { likesCount: 1 } },
      { new: true }
    );

    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    return res.json({
      message: "Recipe liked",
      likesCount: recipe.likesCount,
    });
  } catch (error) {
    console.error("Like Recipe Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
